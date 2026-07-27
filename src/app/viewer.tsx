import { File } from "expo-file-system";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { EditToolbar } from "@/components/edit-toolbar";
import { ViewerHeader } from "@/components/viewer-header";
import {
  type EditCommand,
  MarkdownWebView,
  type MarkdownWebViewHandle,
} from "@/components/markdown-web-view";
import { NetworkBanner } from "@/components/network-banner";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "@/hooks/use-theme";
import { type CmTheme } from "@/lib/cm/html";
import { classifyFileLocation, isHomeFile } from "@/lib/file-location";
import { allowLandscapeOnPhone, lockPortraitOnPhone } from "@/lib/orientation";
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
import FileBookmarkModule from "@modules/file-bookmark";

type Mode = "preview" | "edit";

// FR-38 hide-on-scroll tuning: how far (px) the document must move past the
// anchor before the header toggles, the minimum offset before hiding is allowed
// (so short docs near the top keep their header), and the nav-bar row height
// under the status bar (iOS standard) — used since the native header is off and
// its height would report 0.
const HEADER_SCROLL_THRESHOLD = 64;
const HEADER_HIDE_MIN_OFFSET = 96;
const HEADER_BAR_HEIGHT = 44;
// Upper bound on reading a file before we give up and show the read-error
// message. A materialized file reads in well under a second; a not-yet-
// downloaded File Provider placeholder can otherwise hang forever.
const READ_TIMEOUT_MS = 15000;

export default function ViewerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  // Base body size from the font-size setting; headings/code derive from it so
  // the whole document scales together (FR-10).
  const base = FONT_SIZE_BASE[settings.fontSize];
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + HEADER_BAR_HEIGHT;
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
  // FR-37: the formatting toolbar rides above the software keyboard, so it shows
  // only while the keyboard is up (i.e. actively editing). Tracked from the
  // keyboard events rather than `mode` so dismissing the keyboard hides it too.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // FR-38 hide-on-scroll: the header slides via a reanimated shared value
  // (0 shown → 1 hidden) driven straight from the scroll handler, so scrolling
  // never triggers a React re-render or native-nav change. headerTargetRef
  // mirrors the current target so we don't restart the animation every frame;
  // lastScrollY is the anchor the next move is measured against.
  const headerProgress = useSharedValue(0);
  const headerTargetRef = useRef(0);
  const lastScrollY = useRef(0);
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

  // FR-36: this is the one screen a phone may rotate on — landscape roughly
  // doubles the measure so long lines wrap far less. Applies to preview and
  // edit alike, so toggling modes never snaps the device back upright. The
  // cleanup re-locks portrait on leaving, and no-ops on iPad (always free).
  useFocusEffect(
    useCallback(() => {
      allowLandscapeOnPhone();
      return () => {
        lockPortraitOnPhone();
      };
    }, []),
  );

  // FR-37: track the keyboard so the formatting toolbar appears only while it's
  // up. "Will" events fire ahead of the frame so the toolbar rides in with the
  // keyboard rather than trailing it.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // FR-37: run a toolbar command against the live editor selection.
  const runCommand = useCallback((cmd: EditCommand) => {
    editorRef.current?.runCommand(cmd);
  }, []);

  // FR-38 hide-on-scroll. Compare the offset to an anchor: crossing it downward
  // past the threshold hides the header, upward shows it, the top always shows.
  // Only the shared value is touched (no setState) so the fling is never
  // interrupted; the slide runs on the UI thread. headerTargetRef guards against
  // restarting the animation every frame. Applies to preview AND edit — edit is
  // where the keyboard shrinks the view most, so reclaiming the header matters
  // most there (the edit-mode fling stall was a separate, now-fixed bug).
  const setHeaderTarget = useCallback(
    (target: 0 | 1) => {
      if (headerTargetRef.current === target) return;
      headerTargetRef.current = target;
      // eslint-disable-next-line react-hooks/immutability
      headerProgress.value = withTiming(target, { duration: 200 });
    },
    [headerProgress],
  );
  const handleScroll = useCallback(
    (y: number) => {
      const anchor = lastScrollY.current;
      if (y <= 0) {
        lastScrollY.current = 0;
        setHeaderTarget(0);
        return;
      }
      if (y > anchor + HEADER_SCROLL_THRESHOLD && y > HEADER_HIDE_MIN_OFFSET) {
        lastScrollY.current = y;
        setHeaderTarget(1);
      } else if (y < anchor - HEADER_SCROLL_THRESHOLD) {
        lastScrollY.current = y;
        setHeaderTarget(0);
      }
    },
    [setHeaderTarget],
  );
  // Reveal the header when switching modes or loading a different file, so it's
  // never left hidden after a context change.
  useEffect(() => {
    lastScrollY.current = 0;
    setHeaderTarget(0);
  }, [mode, fileUri, reloadNonce, setHeaderTarget]);

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
        // Read through a coordinated read (native module) so a not-yet-
        // downloaded File Provider placeholder (Google Drive, iCloud) is
        // materialized before reading — a plain File.text() throws "no such
        // file" or hangs on such files. Still capped by a timeout: if the
        // provider can't deliver, fall through to the actionable error message
        // instead of "Loading…" forever.
        const text = await Promise.race([
          FileBookmarkModule.readFileCoordinated(uri),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("read-timeout")), READ_TIMEOUT_MS),
          ),
        ]);
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
        createIcloudCopy(
          next,
          pendingNameRef.current ?? fileName ?? "Untitled.md",
          settings.homeLocation,
        )
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
    [scheduleSave, isNewNotePending, fileName, t, setActiveFile, settings.homeLocation],
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
    // An Open-In Inbox copy is a throwaway sandbox file. Delete it when the
    // viewer unmounts so we don't leave a stale sandbox file behind. This holds
    // whether or not the user copied it to home (FR-34) — the home copy is an
    // independent file, so the Inbox source is always disposable on leave.
    return () => {
      if (isOpenInPending && fileUri) {
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

  // FR-34 (Policy A): take an explicit copy of a view-only file into the home
  // folder (iCloud › Modrift). Per decision ⑤ we copy and return to Home — we do
  // NOT open the copy in edit mode. The original file stays untouched and in
  // place (still viewable if re-picked); the new copy appears under the Home view
  // because Home reloads its list on focus. This replaces the old FR-03 implicit
  // "copy to iCloud and start editing" flow.
  const performCopyToHome = useCallback(async () => {
    if (content === null) return;
    setCopying(true);
    try {
      const copy = await createIcloudCopy(content, fileName ?? "note.md", settings.homeLocation);
      // v1.5 (④): the document now lives in Home. Move its history entry from the
      // external source to the home copy — record the copy so 履歴 keeps a working,
      // editable entry, then drop the source's entry so the same file doesn't
      // linger as a second, view-only record from e.g. Google Drive. Removal is a
      // no-op when the source was never recorded (Open-In / share); that Inbox
      // source is also a throwaway sandbox file the unmount cleanup deletes on
      // leave, so nothing else is needed here.
      await recordRecentFile({ uri: copy.uri, name: copy.name }).catch(() => {});
      await removeRecentFile(fileUri ?? "").catch(() => {});
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (err) {
      const message =
        err instanceof IcloudUnavailableError
          ? t("screens.viewer.copyToIcloudErrorIcloudUnavailable")
          : t("screens.viewer.copyToIcloudErrorFailed");
      Alert.alert(t("screens.viewer.copyToIcloudErrorTitle"), message);
      setCopying(false);
    }
  }, [content, fileName, fileUri, router, t, settings.homeLocation]);

  const handleCopyToHome = useCallback(() => {
    if (content === null || copying) return;
    Alert.alert(
      t("screens.viewer.copyToHomeDialogTitle"),
      t("screens.viewer.copyToHomeDialogMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("screens.viewer.copyToHomeDialogConfirm"),
          onPress: () => performCopyToHome(),
        },
      ],
    );
  }, [content, copying, performCopyToHome, t]);

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

  // Policy A (v1.4): editing is limited to home-folder files (iCloud › Modrift).
  // A new note is editable from the start (it becomes a home file on the first
  // keystroke); every other location is view-only until copied to home (FR-34).
  const editable = isNewNotePending || isHomeFile(fileUri ?? "");
  // Rename (via long-press on the header title) is only for our own iCloud
  // copies — a user's own file can't be renamed (file-scope permission only).
  // A new note is renameable from the start: before its file exists the chosen
  // name is stored and applied at lazy creation (see handleRename).
  const renameable =
    isNewNotePending ||
    (activeUri !== null &&
      classifyFileLocation(activeUri).kind === "icloudCopy");
  const loaded = content !== null && !error;
  // Editing is always available in the home-folder-centric model: home files
  // (editable) get the mode toggle, everything else gets "copy to home".
  const canToggle = loaded && editable;
  const showCopyButton = loaded && !editable;
  const toggleLabel =
    mode === "preview" ? t("screens.viewer.edit") : t("screens.viewer.preview");

  // Right-side header action: the preview⇄edit toggle for editable files, else
  // the "copy to home" button for view-only files. undo/redo live in the edit
  // toolbar (FR-37).
  const headerRightNode = canToggle ? (
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
  ) : showCopyButton ? (
    <Pressable
      onPress={handleCopyToHome}
      hitSlop={8}
      disabled={copying}
      accessibilityRole="button"
      accessibilityLabel={t("screens.viewer.copyToHomeButton")}
    >
      <SymbolView name="folder.badge.plus" size={26} weight="semibold" tintColor={theme.text} />
    </Pressable>
  ) : null;

  return (
    <ThemedView style={styles.container}>
      {/* The native header is disabled; FR-38 renders its own header (below) so
          hide-on-scroll can slide it via a shared value without a re-render. */}
      <Stack.Screen options={{ headerShown: false }} />
      {/* No top edge: content runs full-height under the floating header (whose
          own top inset it carries); the editor's topInset keeps text clear. */}
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        {/* Overlay the offline banner just below the header so it never adds
            layout height to the full-height editor (that would resize it). */}
        <View style={[styles.bannerOverlay, { top: headerHeight }]} pointerEvents="box-none">
          <NetworkBanner />
        </View>
        {error ? (
          <ThemedText
            themeColor="textSecondary"
            style={[styles.message, { paddingTop: headerHeight + Spacing.three }]}
          >
            {error}
          </ThemedText>
        ) : content === null ? (
          <ThemedText
            themeColor="textSecondary"
            style={[styles.message, { paddingTop: headerHeight + Spacing.three }]}
          >
            {t("screens.viewer.loading")}
          </ThemedText>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            // Content starts at the top of the screen (the header floats over
            // it), so no header-height offset is needed.
            keyboardVerticalOffset={0}
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
              // Clear the floating header so the first lines aren't hidden behind
              // it; scrolls away with the content past the top.
              topInset={headerHeight}
              onChange={handleChange}
              onHistoryChange={handleHistoryChange}
              onReady={handleReady}
              onScroll={handleScroll}
              onError={() => setError(t("picker.errorReadFailed"))}
              onLinkPress={(url) => {
                Linking.openURL(url).catch(() => {
                  // Malformed or unsupported scheme — nothing actionable.
                });
              }}
              style={[styles.flex, { backgroundColor: theme.background }]}
            />
            {canToggle && mode === "edit" && keyboardVisible && (
              <EditToolbar
                onCommand={runCommand}
                onUndo={() => editorRef.current?.undo()}
                onRedo={() => editorRef.current?.redo()}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            )}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
      {/* FR-38: our own header, floating over the full-height content and slid
          by the shared value on scroll. Painted last so it sits on top. */}
      <ViewerHeader
        progress={headerProgress}
        insetTop={insets.top}
        barHeight={HEADER_BAR_HEIGHT}
        title={displayName}
        renameable={renameable}
        onRename={handleRename}
        onBack={() => router.back()}
        right={headerRightNode}
      />
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
  // Offline banner overlay, pinned just below the floating header so it never
  // adds layout height to the full-height editor beneath it.
  bannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1,
  },
});
