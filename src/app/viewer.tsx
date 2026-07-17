import { File } from "expo-file-system";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/build/react-navigation/elements";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  MarkdownWebView,
  type MarkdownWebViewHandle,
} from "@/components/markdown-web-view";
import { NetworkBanner } from "@/components/network-banner";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "@/hooks/use-theme";
import { type CmTheme } from "@/lib/cm/html";
import { classifyFileLocation, isInPlaceEditable } from "@/lib/file-location";
import {
  createIcloudCopy,
  IcloudUnavailableError,
  NameInUseError,
  renameIcloudCopy,
  toMarkdownFileName,
} from "@/lib/icloud-copy";
import {
  recordRecentFile,
  removeRecentFile,
  renameRecentFile,
} from "@/lib/recent-files";
import { FONT_SIZE_BASE } from "@/lib/settings";
import { normalizeMarkdown } from "@/lib/text";
import { Spacing } from "@/theme";

type Mode = "preview" | "edit";

export default function ViewerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  // Base body size from the font-size setting; headings/code derive from it so
  // the whole document scales together (FR-10).
  const base = FONT_SIZE_BASE[settings.fontSize];
  const router = useRouter();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const {
    fileUri,
    fileName,
    initialMode,
    openInPending,
    source,
    matchFrom,
    matchTo,
    newNotePending,
  } = useLocalSearchParams<{
    fileUri?: string;
    fileName: string;
    initialMode?: string;
    openInPending?: string;
    // How the viewer was reached: "picker" (in-app Open File), "history"
    // (recent-files tap), or "icloudCopy" (a copy we just created). Open-In /
    // share-sheet launches carry no source. Drives whether we record history.
    source?: string;
    // FR-15: when opened from a search result, the char range of the match to
    // scroll to and highlight once the editor is ready.
    matchFrom?: string;
    matchTo?: string;
    // FR-23: a brand-new note. There is no file yet — we start with an empty
    // buffer and only create it in iCloud › Modrift on the first keystroke, so a
    // mis-tap on "+" never leaves an empty note behind.
    newNotePending?: string;
  }>();

  const isOpenInPending = openInPending === "true";
  const isNewNotePending = newNotePending === "true";

  // A new note starts with an empty buffer (no file to read yet); everything
  // else loads from disk in the effect below.
  const [content, setContent] = useState<string | null>(
    isNewNotePending ? "" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(
    initialMode === "edit" ? "edit" : "preview",
  );
  const [copying, setCopying] = useState(false);
  // The name shown in the header. Starts from the route param; for a new note it
  // updates to the deduped filename once the file is actually created.
  const [displayName, setDisplayName] = useState(fileName ?? "");

  // The file this screen reads/writes. Equals fileUri for a normal open; null
  // for a not-yet-created new note (FR-23), set to the created URI on first
  // keystroke. All file I/O goes through the ref so lazy creation needs no
  // remount; the state mirror re-renders the header so its rename affordance
  // (only for our own iCloud copies) appears once the file exists.
  const activeUriRef = useRef<string | null>(fileUri ?? null);
  const [activeUri, setActiveUri] = useState<string | null>(fileUri ?? null);
  const setActiveFile = useCallback((uri: string) => {
    activeUriRef.current = uri;
    setActiveUri(uri);
  }, []);
  // Guards the one-shot new-note creation against back-to-back keystrokes.
  const creatingNoteRef = useRef(false);
  // FR-22×FR-23: a rename issued before the new note's file exists (lazy
  // creation hasn't fired or is still in flight). Holds the chosen filename so
  // the creation uses it instead of the default "Untitled.md".
  const pendingNameRef = useRef<string | null>(null);
  // True once this screen has unmounted — the lazy creation may still be in
  // flight then, and its .then must not record an abandoned note (FR-23).
  const departedRef = useRef(false);

  const contentRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The editor (WebView) handle, for undo/redo and preview⇄edit toggling.
  const editorRef = useRef<MarkdownWebViewHandle | null>(null);
  // The file's modificationTime (epoch ms) as of our last read/write — the
  // baseline for conflict detection (FR-13). If the on-disk mtime grows past
  // this before we save, the file was changed externally (another device's
  // cloud sync, another app) and a blind auto-save would clobber it.
  const baselineMtimeRef = useRef<number | null>(null);
  // Guards against stacking conflict dialogs when saves fire back to back.
  const conflictOpenRef = useRef(false);
  // Bumped to remount the editor after a wholesale buffer replacement (file
  // open, "load latest" — FR-13), so it re-seeds from the new text.
  const [reloadNonce, setReloadNonce] = useState(0);
  // True once an Open-In Inbox file has been copied to iCloud, so the unmount
  // cleanup doesn't try to delete an already-consumed source.
  const inboxConsumedRef = useRef(false);
  // FR-15: guard so we jump to the search match only on the first editor-ready
  // (the initial open), not again after a "load latest" reload remounts it.
  const revealedRef = useRef(false);

  // FR-14 undo/redo is handled inside CodeMirror; these mirror its reported
  // availability so the header buttons enable/disable.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    // FR-23: a brand-new note has no file to read — content is initialized empty
    // above. The file is created on the first keystroke (handleChange), so
    // nothing is written or recorded until the user actually types.
    if (isNewNotePending) return;
    // Every entry path lands in preview first (preview-first model). Inbox
    // Open-In files load and render like any other source — they're just not
    // in-place editable, so editing them goes through the copy-to-iCloud button.
    const uri = fileUri as string;
    let cancelled = false;
    (async () => {
      try {
        const file = new File(uri);
        const text = await file.text();
        const normalized = normalizeMarkdown(text);
        if (cancelled) return;
        setContent(normalized);
        // Record the baseline for conflict detection right after the read, so a
        // later external change is detectable at save time (FR-13).
        baselineMtimeRef.current = file.modificationTime;
        // Record history only for files we can reliably re-open: opened via the
        // in-app picker, reopened from history, or an iCloud copy we made. Files
        // arriving through iOS Open-In / share are deliberately not recorded —
        // third-party providers (Google Drive) can't be re-opened by bookmark,
        // and Inbox copies are throwaway, so an entry would just be a dead link.
        const recordable =
          source === "picker" ||
          source === "history" ||
          classifyFileLocation(uri).kind === "icloudCopy";
        if (recordable) {
          recordRecentFile({ uri, name: fileName ?? "" }).catch(() => {
            // Non-fatal: history is for display only.
          });
        }
      } catch {
        if (!cancelled) setError(t("picker.errorReadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri, fileName, t, source, isNewNotePending]);

  const writeFile = useCallback((text: string) => {
    // No file yet (a new note before its first keystroke created it) — nothing
    // to write. Guards the brief window before lazy creation resolves.
    const uri = activeUriRef.current;
    if (uri === null) return;
    try {
      new File(uri).write(text);
      // Re-read after writing so our own save becomes the new baseline and
      // isn't mistaken for an external change on the next save.
      baselineMtimeRef.current = new File(uri).modificationTime;
      isDirtyRef.current = false;
    } catch {
      // Silent per FR-04. Next edit will retry.
    }
  }, []);

  // FR-13: true when the on-disk file changed after our recorded baseline,
  // i.e. another device or app wrote to it while we held it open.
  const hasExternalChange = useCallback((): boolean => {
    const uri = activeUriRef.current;
    if (uri === null) return false;
    const baseline = baselineMtimeRef.current;
    if (baseline === null) return false;
    const current = new File(uri).modificationTime;
    if (current === null) return false;
    return current > baseline;
  }, []);

  const reloadFromDisk = useCallback(async () => {
    const uri = activeUriRef.current;
    if (uri === null) return;
    try {
      const file = new File(uri);
      const text = await file.text();
      const normalized = normalizeMarkdown(text);
      contentRef.current = normalized;
      isDirtyRef.current = false;
      baselineMtimeRef.current = file.modificationTime;
      setContent(normalized);
      // Remount the editor so it re-seeds from the reloaded text (and its undo
      // history resets, since the buffer was replaced wholesale).
      setReloadNonce((n) => n + 1);
    } catch {
      // Non-fatal — keep the current buffer if the reread fails.
    }
  }, []);

  const promptConflict = useCallback(() => {
    if (conflictOpenRef.current) return;
    conflictOpenRef.current = true;
    Alert.alert(
      t("screens.viewer.conflictTitle"),
      t("screens.viewer.conflictMessage"),
      [
        {
          text: t("screens.viewer.conflictKeepMine"),
          onPress: () => {
            conflictOpenRef.current = false;
            if (contentRef.current !== null) writeFile(contentRef.current);
          },
        },
        {
          text: t("screens.viewer.conflictLoadLatest"),
          style: "destructive",
          onPress: () => {
            conflictOpenRef.current = false;
            reloadFromDisk();
          },
        },
      ],
      { cancelable: false },
    );
  }, [t, writeFile, reloadFromDisk]);

  const saveNow = useCallback(
    // allowPrompt is false for background/unmount saves, where a modal can't be
    // shown — there we hold the write on conflict instead of clobbering.
    (allowPrompt = true) => {
      if (!isDirtyRef.current || contentRef.current === null) return;
      if (hasExternalChange()) {
        if (allowPrompt) promptConflict();
        return;
      }
      writeFile(contentRef.current);
    },
    [hasExternalChange, promptConflict, writeFile],
  );

  // Re-check on return to foreground (FR-13). iOS often hasn't downloaded a
  // sibling device's change by the time we save — but by the next time the app
  // is foregrounded the sync has usually landed, so re-checking here catches the
  // realistic multi-device flow (edit elsewhere → background → return). With
  // unsaved edits it's a real conflict → prompt; otherwise just adopt the newer
  // version since there's nothing local to lose.
  const recheckExternalChange = useCallback(() => {
    if (!hasExternalChange()) return;
    if (isDirtyRef.current) {
      promptConflict();
    } else {
      reloadFromDisk();
    }
  }, [hasExternalChange, promptConflict, reloadFromDisk]);

  // Restart the 3s auto-save debounce (FR-04).
  const scheduleSave = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = setTimeout(() => {
      pendingTimeoutRef.current = null;
      saveNow();
    }, 3000);
  }, [saveNow]);

  // The editor reports each edit here — keep the live buffer in a ref (no
  // re-render, so the WebView is never reloaded mid-typing) and debounce a save.
  const handleChange = useCallback(
    (next: string) => {
      contentRef.current = next;
      isDirtyRef.current = true;
      // FR-23: the first non-empty keystroke on a new note creates the file in
      // iCloud › Modrift. createIcloudCopy writes `next` immediately; from then
      // on activeUriRef is set so ordinary auto-save persists further edits. A
      // guard keeps back-to-back keystrokes from creating duplicates.
      if (
        isNewNotePending &&
        activeUriRef.current === null &&
        !creatingNoteRef.current &&
        next.length > 0
      ) {
        creatingNoteRef.current = true;
        createIcloudCopy(next, pendingNameRef.current ?? fileName ?? "Untitled.md")
          .then(({ uri, name }) => {
            // A rename confirmed while the creation was in flight didn't make
            // it into the created name — apply it now (best-effort).
            const pending = pendingNameRef.current;
            if (pending !== null && pending !== name) {
              try {
                ({ uri, name } = renameIcloudCopy(uri, pending));
              } catch {
                // Keep the created name; the user can rename again.
              }
            }
            if (departedRef.current) {
              // The user left before the creation finished. An empty buffer
              // means the note was abandoned — remove the just-created file so
              // no orphan "Untitled.md" lingers. Otherwise persist the latest
              // text and record it so what they typed isn't lost.
              const latest = contentRef.current ?? "";
              if (latest.trim() === "") {
                try {
                  new File(uri).delete();
                } catch {
                  // Non-fatal — worst case an empty note lingers.
                }
              } else {
                try {
                  new File(uri).write(latest);
                } catch {
                  // Keep the initially-created content.
                }
                recordRecentFile({ uri, name }).catch(() => {});
              }
              return;
            }
            setActiveFile(uri);
            baselineMtimeRef.current = new File(uri).modificationTime;
            setDisplayName(name);
            recordRecentFile({ uri, name }).catch(() => {});
            // Flush anything typed while the create was in flight.
            scheduleSave();
          })
          .catch((err) => {
            // Let a later keystroke retry the creation.
            creatingNoteRef.current = false;
            const message =
              err instanceof IcloudUnavailableError
                ? t("screens.viewer.copyToIcloudErrorIcloudUnavailable")
                : t("screens.viewer.copyToIcloudErrorFailed");
            Alert.alert(t("screens.viewer.copyToIcloudErrorTitle"), message);
          });
        return;
      }
      scheduleSave();
    },
    [scheduleSave, isNewNotePending, fileName, t, setActiveFile],
  );

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);

  const handleToggleMode = useCallback(() => {
    setMode((m) => (m === "edit" ? "preview" : "edit"));
  }, []);

  // FR-22: rename lives here now (not on a list swipe) — long-pressing the file
  // name renames a Modrift-generated iCloud copy in place. Renames the file in
  // iCloud › Modrift and re-points activeUriRef so ongoing edits keep saving to
  // the new name without a remount; the history entry follows via
  // renameRecentFile. Only reachable when the open file is such a copy.
  const handleRename = useCallback(() => {
    const uri = activeUriRef.current;
    // Renameable targets: our own iCloud copies, plus a new note whose file
    // doesn't exist yet (FR-23 lazy creation — possibly still in flight). For
    // the latter we just remember the chosen name and let the creation use it.
    const isPendingNewNote = uri === null && isNewNotePending;
    if (
      !isPendingNewNote &&
      (uri === null || classifyFileLocation(uri).kind !== "icloudCopy")
    ) {
      return;
    }
    Alert.prompt(
      t("screens.recentFiles.renameTitle"),
      t("screens.recentFiles.renameMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("screens.recentFiles.renameConfirm"),
          onPress: (value?: string) => {
            if (!value || !value.trim()) return;
            // Re-read: the lazy creation may have completed while the prompt
            // was up, in which case this is a normal file rename after all.
            const currentUri = activeUriRef.current;
            if (currentUri === null) {
              const name = toMarkdownFileName(value);
              pendingNameRef.current = name;
              setDisplayName(name);
              return;
            }
            // Flush pending edits to the current file first so the rename
            // carries the latest content across to the new name.
            if (isDirtyRef.current && contentRef.current !== null) {
              writeFile(contentRef.current);
            }
            try {
              const result = renameIcloudCopy(currentUri, value);
              setActiveFile(result.uri);
              setDisplayName(result.name);
              baselineMtimeRef.current = new File(result.uri).modificationTime;
              renameRecentFile(currentUri, result).catch(() => {});
            } catch (err) {
              const message =
                err instanceof NameInUseError
                  ? t("screens.recentFiles.renameErrorInUse")
                  : t("screens.recentFiles.renameErrorFailed");
              Alert.alert(t("screens.recentFiles.renameErrorTitle"), message);
            }
          },
        },
      ],
      "plain-text",
      displayName.replace(/\.md$/i, ""),
    );
  }, [displayName, t, writeFile, setActiveFile, isNewNotePending]);

  // FR-15: once the editor is ready after opening a search result, scroll to and
  // flash the matched range. Fires only for the first ready of this file open.
  const handleReady = useCallback(() => {
    if (revealedRef.current) return;
    const from = Number(matchFrom);
    const to = Number(matchTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    revealedRef.current = true;
    editorRef.current?.reveal(from, to);
  }, [matchFrom, matchTo]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        if (pendingTimeoutRef.current !== null) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
        saveNow(false);
      } else if (next === "active") {
        recheckExternalChange();
      }
    });
    return () => subscription.remove();
  }, [saveNow, recheckExternalChange]);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      saveNow(false);
    };
  }, [saveNow]);

  useEffect(() => {
    // An Open-In Inbox copy is a throwaway sandbox file. If the user reads it
    // and leaves without turning it into an iCloud copy, delete it so we don't
    // leave a stale sandbox file behind. When it was copied, performCopy already
    // removed it (inboxConsumedRef guards against a double delete).
    return () => {
      if (isOpenInPending && fileUri && !inboxConsumedRef.current) {
        try {
          new File(fileUri).delete();
        } catch {
          // Non-fatal — iOS reclaims the Inbox eventually anyway.
        }
      }
    };
  }, [isOpenInPending, fileUri]);

  // FR-23: a new note whose buffer is empty when the user leaves (typed
  // something, then deleted it all) is as good as never created — remove the
  // file and its history entry so empty "Untitled.md" files don't accumulate
  // in iCloud › Modrift. Mirrors the lazy-creation promise that a new note
  // only exists once there's actual content.
  const cleanupEmptyNewNote = useCallback(() => {
    if (!isNewNotePending) return;
    const uri = activeUriRef.current;
    if (uri === null) return;
    if ((contentRef.current ?? "").trim() !== "") return;
    if (classifyFileLocation(uri).kind !== "icloudCopy") return;
    try {
      new File(uri).delete();
    } catch {
      // Non-fatal — worst case an empty note lingers in iCloud › Modrift.
      return;
    }
    removeRecentFile(uri).catch(() => {});
    // Null the active file so the unmount save can't resurrect the deletion.
    activeUriRef.current = null;
  }, [isNewNotePending]);

  useEffect(() => {
    // Run the empty-note cleanup on 'beforeRemove' — the moment the back
    // navigation is dispatched, BEFORE Home regains focus and reloads the
    // recent list — so a just-deleted note never flashes there. The unmount
    // cleanup below is a fallback (idempotent: activeUriRef is nulled) for the
    // window where the lazy creation resolves between the two.
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      cleanupEmptyNewNote();
    });
    return unsubscribe;
  }, [navigation, cleanupEmptyNewNote]);

  useEffect(() => {
    return () => {
      // Flag for the lazy-creation .then: the screen is gone, don't record or
      // keep an abandoned note (see handleChange).
      departedRef.current = true;
      cleanupEmptyNewNote();
    };
  }, [cleanupEmptyNewNote]);

  const performCopy = useCallback(async () => {
    if (content === null) return;
    setCopying(true);
    try {
      const result = await createIcloudCopy(content, fileName ?? "note.md");
      if (isOpenInPending && fileUri) {
        // Source was a throwaway Inbox copy — remove it now that a durable
        // iCloud copy exists.
        try {
          new File(fileUri).delete();
        } catch {
          // Non-fatal — iOS reclaims the Inbox eventually anyway.
        }
        inboxConsumedRef.current = true;
      }
      // The editable iCloud copy supersedes the original — drop the source from
      // history so the user isn't shown both the read-only original and the
      // copy. Awaited before navigating so the new screen's record (the copy)
      // doesn't race this removal on the same AsyncStorage key.
      if (fileUri) await removeRecentFile(fileUri).catch(() => {});
      router.replace({
        pathname: "/viewer",
        params: {
          fileUri: result.uri,
          fileName: result.name,
          initialMode: "edit",
          source: "icloudCopy",
        },
      });
    } catch (err) {
      const message =
        err instanceof IcloudUnavailableError
          ? t("screens.viewer.copyToIcloudErrorIcloudUnavailable")
          : t("screens.viewer.copyToIcloudErrorFailed");
      Alert.alert(t("screens.viewer.copyToIcloudErrorTitle"), message);
      setCopying(false);
    }
  }, [content, fileName, router, t, isOpenInPending, fileUri]);

  const handleCopyToIcloud = useCallback(() => {
    if (content === null || copying) return;
    Alert.alert(
      t("screens.viewer.copyToIcloudDialogTitle"),
      t("screens.viewer.copyToIcloudDialogMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("screens.viewer.copyToIcloudDialogConfirm"),
          onPress: () => performCopy(),
        },
      ],
    );
  }, [content, copying, performCopy, t]);

  const cmTheme: CmTheme = useMemo(
    () => ({
      bg: theme.background,
      fg: theme.text,
      tint: theme.tint,
      link: theme.accent,
      codeMono: theme.codeMono,
      sel: theme.backgroundSelected,
      codeBg: theme.backgroundElement,
      muted: theme.textSecondary,
      h1: theme.heading1,
      h2: theme.heading2,
      h3: theme.heading3,
      h4: theme.heading4,
      base,
    }),
    [theme, base],
  );

  // A new note is editable from the start (it becomes an in-place iCloud copy on
  // the first keystroke); otherwise editability follows the file's location.
  const editable = isNewNotePending || isInPlaceEditable(fileUri ?? "");
  // Rename (via long-press on the header title) is only for our own iCloud
  // copies — a user's own file can't be renamed (file-scope permission only).
  // A new note is renameable from the start: before its file exists the chosen
  // name is stored and applied at lazy creation (see handleRename).
  const renameable =
    isNewNotePending ||
    (activeUri !== null &&
      classifyFileLocation(activeUri).kind === "icloudCopy");
  const loaded = content !== null && !error;
  const canToggle = loaded && editable;
  const showCopyButton = loaded && !editable;
  const toggleLabel =
    mode === "preview" ? t("screens.viewer.edit") : t("screens.viewer.preview");

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          // Keep the custom title centered. Without this, native-stack centers a
          // custom headerTitle only on first layout and left-aligns it on any
          // re-layout (e.g. the first keystroke enabling the undo button), so the
          // title visibly jumps left. Pin it to center to match a normal title.
          headerTitleAlign: "center",
          // Custom title so a long-press can rename a Modrift copy (FR-22). For
          // non-renameable files it's a plain, non-interactive label.
          headerTitle: () => (
            <Pressable
              onLongPress={renameable ? handleRename : undefined}
              disabled={!renameable}
              hitSlop={8}
              accessibilityRole="header"
              accessibilityLabel={displayName}
              accessibilityHint={
                renameable ? t("screens.recentFiles.renameTitle") : undefined
              }
            >
              <ThemedText numberOfLines={1} style={styles.headerTitle}>
                {displayName}
              </ThemedText>
            </Pressable>
          ),
          // Replace the system back button with our own chevron so it renders
          // at the exact same size/weight/tint as the headerRight icon — the
          // native back chevron ignores size and draws larger.
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <SymbolView
                name="chevron.backward"
                size={20}
                weight="semibold"
                tintColor={theme.text}
              />
            </Pressable>
          ),
          headerRight: canToggle
            ? () => (
                <View style={styles.headerActions}>
                  {mode === "edit" && (
                    <>
                      <Pressable
                        onPress={() => editorRef.current?.undo()}
                        disabled={!canUndo}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canUndo }}
                        accessibilityLabel={t("screens.viewer.undo")}
                      >
                        <SymbolView
                          name="arrow.uturn.backward"
                          size={22}
                          weight="semibold"
                          tintColor={canUndo ? theme.text : theme.textSecondary}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => editorRef.current?.redo()}
                        disabled={!canRedo}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canRedo }}
                        accessibilityLabel={t("screens.viewer.redo")}
                      >
                        <SymbolView
                          name="arrow.uturn.forward"
                          size={22}
                          weight="semibold"
                          tintColor={canRedo ? theme.text : theme.textSecondary}
                        />
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    onPress={handleToggleMode}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={toggleLabel}
                  >
                    <SymbolView
                      name={mode === "preview" ? "square.and.pencil" : "eye"}
                      size={26}
                      weight="semibold"
                      tintColor={theme.text}
                    />
                  </Pressable>
                </View>
              )
            : showCopyButton
              ? () => (
                  <Pressable
                    onPress={handleCopyToIcloud}
                    hitSlop={8}
                    disabled={copying}
                    accessibilityRole="button"
                    accessibilityLabel={t("screens.viewer.copyToIcloudButton")}
                  >
                    <SymbolView
                      name="square.and.pencil"
                      size={26}
                      weight="semibold"
                      tintColor={theme.text}
                    />
                  </Pressable>
                )
              : undefined,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <NetworkBanner />
        {error ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {error}
          </ThemedText>
        ) : content === null ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t("screens.viewer.loading")}
          </ThemedText>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={headerHeight}
          >
            <MarkdownWebView
              // Remount per file (and on "load latest") so it re-seeds the
              // buffer; preview⇄edit toggles in place via the editable prop. A
              // new note keeps a stable key so lazy creation never remounts it.
              key={isNewNotePending ? `newnote:${reloadNonce}` : `${fileUri}:${reloadNonce}`}
              ref={editorRef}
              initialContent={content}
              editable={canToggle && mode === "edit"}
              theme={cmTheme}
              imagePlaceholder={t("screens.viewer.imagePlaceholder", {
                filename: "__F__",
              })}
              taskInteractive={editable}
              onChange={handleChange}
              onHistoryChange={handleHistoryChange}
              onReady={handleReady}
              onLinkPress={(url) => {
                Linking.openURL(url).catch(() => {
                  // Malformed or unsupported scheme — nothing actionable.
                });
              }}
              style={[styles.flex, { backgroundColor: theme.background }]}
            />
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
  },
  // Match the iOS navigation title so the custom (long-pressable) title looks
  // identical to a default one.
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    maxWidth: 220,
    textAlign: "center",
  },
});
