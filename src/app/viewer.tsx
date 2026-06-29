import { File } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import { SafeAreaView } from "react-native-safe-area-context";

import { NetworkBanner } from "@/components/network-banner";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "@/hooks/use-theme";
import { classifyFileLocation, isInPlaceEditable } from "@/lib/file-location";
import { createIcloudCopy, IcloudUnavailableError } from "@/lib/icloud-copy";
import { buildMarkdownStyle } from "@/lib/markdown-style";
import { recordRecentFile, removeRecentFile } from "@/lib/recent-files";
import { FONT_SIZE_BASE } from "@/lib/settings";
import { Fonts, Spacing } from "@/theme";

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// FR-14: edits within this many ms of each other are one undo step (so a burst
// of typing reverts together), and the undo history is capped to bound memory.
const UNDO_COALESCE_MS = 700;
const MAX_UNDO_STEPS = 100;

// Where the two strings first differ — used to place the cursor at the point an
// undo/redo changed, instead of jumping it to the end of the document.
function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function replaceLocalImages(
  md: string,
  placeholder: (filename: string) => string,
): string {
  return md.replace(IMAGE_RE, (match, _alt, url) => {
    if (url.startsWith("https://")) return match;
    const filename = url.split("/").pop() || url;
    return placeholder(filename);
  });
}

type Mode = "preview" | "edit";

export default function ViewerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  // Base body size from the font-size setting; headings/code derive from it so
  // the whole document scales together (FR-10).
  const base = FONT_SIZE_BASE[settings.fontSize];
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { fileUri, fileName, initialMode, openInPending, source } =
    useLocalSearchParams<{
      fileUri: string;
      fileName: string;
      initialMode?: string;
      openInPending?: string;
      // How the viewer was reached: "picker" (in-app Open File), "history"
      // (recent-files tap), or "icloudCopy" (a copy we just created). Open-In /
      // share-sheet launches carry no source. Drives whether we record history.
      source?: string;
    }>();

  const isOpenInPending = openInPending === "true";

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(
    initialMode === "edit" ? "edit" : "preview",
  );
  const [copying, setCopying] = useState(false);

  const contentRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The live editor instance, so undo/redo can restore the cursor after remount.
  const editorRef = useRef<TextInput>(null);
  // Cursor offset to apply after an undo/redo remount (null = leave at default).
  const pendingCursorRef = useRef<number | null>(null);
  // The file's modificationTime (epoch ms) as of our last read/write — the
  // baseline for conflict detection (FR-13). If the on-disk mtime grows past
  // this before we save, the file was changed externally (another device's
  // cloud sync, another app) and a blind auto-save would clobber it.
  const baselineMtimeRef = useRef<number | null>(null);
  // Guards against stacking conflict dialogs when saves fire back to back.
  const conflictOpenRef = useRef(false);
  // Bumped to remount the uncontrolled editor so it re-seeds defaultValue after
  // we replace the buffer — used by "load latest" (FR-13) and undo/redo (FR-14).
  const [reloadNonce, setReloadNonce] = useState(0);
  // True once an Open-In Inbox file has been copied to iCloud, so the unmount
  // cleanup doesn't try to delete an already-consumed source.
  const inboxConsumedRef = useRef(false);

  // FR-14 undo/redo. Snapshots of the buffer; continuous typing coalesces into
  // one step (see handleEdit). canUndo/canRedo drive the header buttons; the
  // ref mirrors let us flip them only on real transitions, never per keystroke,
  // so we don't re-render the uncontrolled editor mid-input (would jump the IME).
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastEditTimeRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canUndoRef = useRef(false);
  const canRedoRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Flip the undo/redo button availability only on real transitions (mirrors in
  // refs), so typing — which mutates the stacks but rarely changes these flags —
  // doesn't trigger re-renders that would jump the IME.
  const syncUndoRedo = useCallback(() => {
    const undo = undoStackRef.current.length > 0;
    const redo = redoStackRef.current.length > 0;
    if (canUndoRef.current !== undo) {
      canUndoRef.current = undo;
      setCanUndo(undo);
    }
    if (canRedoRef.current !== redo) {
      canRedoRef.current = redo;
      setCanRedo(redo);
    }
  }, []);

  const resetUndo = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastEditTimeRef.current = 0;
    syncUndoRedo();
  }, [syncUndoRedo]);

  useEffect(() => {
    // Every entry path lands in preview first (preview-first model). Inbox
    // Open-In files load and render like any other source — they're just not
    // in-place editable, so editing them goes through the copy-to-iCloud button.
    let cancelled = false;
    (async () => {
      try {
        const file = new File(fileUri);
        const text = await file.text();
        const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
        if (cancelled) return;
        setContent(normalized);
        // Record the baseline for conflict detection right after the read, so a
        // later external change is detectable at save time (FR-13).
        baselineMtimeRef.current = file.modificationTime;
        // Fresh file → fresh undo history (FR-14).
        resetUndo();
        // Record history only for files we can reliably re-open: opened via the
        // in-app picker, reopened from history, or an iCloud copy we made. Files
        // arriving through iOS Open-In / share are deliberately not recorded —
        // third-party providers (Google Drive) can't be re-opened by bookmark,
        // and Inbox copies are throwaway, so an entry would just be a dead link.
        const recordable =
          source === "picker" ||
          source === "history" ||
          classifyFileLocation(fileUri).kind === "icloudCopy";
        if (recordable) {
          recordRecentFile({ uri: fileUri, name: fileName ?? "" }).catch(() => {
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
  }, [fileUri, fileName, t, source, resetUndo]);

  const writeFile = useCallback(
    (text: string) => {
      try {
        new File(fileUri).write(text);
        // Re-read after writing so our own save becomes the new baseline and
        // isn't mistaken for an external change on the next save.
        baselineMtimeRef.current = new File(fileUri).modificationTime;
        isDirtyRef.current = false;
      } catch {
        // Silent per FR-04. Next edit will retry.
      }
    },
    [fileUri],
  );

  // FR-13: true when the on-disk file changed after our recorded baseline,
  // i.e. another device or app wrote to it while we held it open.
  const hasExternalChange = useCallback((): boolean => {
    const baseline = baselineMtimeRef.current;
    if (baseline === null) return false;
    const current = new File(fileUri).modificationTime;
    if (current === null) return false;
    return current > baseline;
  }, [fileUri]);

  const reloadFromDisk = useCallback(async () => {
    try {
      const file = new File(fileUri);
      const text = await file.text();
      const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
      contentRef.current = normalized;
      isDirtyRef.current = false;
      baselineMtimeRef.current = file.modificationTime;
      setContent(normalized);
      // The buffer was replaced wholesale — drop undo history (FR-14).
      resetUndo();
      // Remount the uncontrolled editor so it re-seeds from the reloaded text.
      setReloadNonce((n) => n + 1);
    } catch {
      // Non-fatal — keep the current buffer if the reread fails.
    }
  }, [fileUri, resetUndo]);

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

  // Restart the 3s auto-save debounce (FR-04). Shared by typing and undo/redo.
  const scheduleSave = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = setTimeout(() => {
      pendingTimeoutRef.current = null;
      saveNow();
    }, 3000);
  }, [saveNow]);

  const handleEdit = useCallback(
    (next: string) => {
      // Uncontrolled editor: write straight to the ref without setContent, so
      // the TextInput isn't re-rendered (and re-scrolled) on every keystroke —
      // that re-render is what made the Japanese IME jump the view mid-input.
      // The preview pulls the latest text from the ref on mode switch.
      const prev = contentRef.current ?? "";
      const now = Date.now();
      // Start a new undo step at the beginning of a typing burst (or the very
      // first edit); keystrokes within UNDO_COALESCE_MS fold into that step so
      // one undo reverts the whole burst rather than a single character.
      if (
        undoStackRef.current.length === 0 ||
        now - lastEditTimeRef.current > UNDO_COALESCE_MS
      ) {
        undoStackRef.current.push(prev);
        if (undoStackRef.current.length > MAX_UNDO_STEPS) {
          undoStackRef.current.shift();
        }
        redoStackRef.current = [];
        syncUndoRedo();
      }
      lastEditTimeRef.current = now;
      contentRef.current = next;
      isDirtyRef.current = true;
      scheduleSave();
    },
    [scheduleSave, syncUndoRedo],
  );

  // Apply an undo/redo target to the buffer. Remount the editor (reloadNonce) so
  // the fresh defaultValue reliably re-seeds the text — imperative setNativeProps
  // text swaps desync the New Architecture event count and corrupt the *next*
  // undo. The cursor is then restored to where the change happened (not the end)
  // via setSelection after the remount (see the reloadNonce effect below).
  const applyValue = useCallback(
    (value: string) => {
      pendingCursorRef.current = commonPrefixLength(
        contentRef.current ?? "",
        value,
      );
      contentRef.current = value;
      isDirtyRef.current = true;
      setContent(value);
      setReloadNonce((n) => n + 1);
      scheduleSave();
    },
    [scheduleSave],
  );

  // After an undo/redo remount, place the cursor at the change point. A fresh
  // mount has a clean event count, so setSelection applies reliably here (unlike
  // an imperative mid-edit text swap). Skipped for other remounts (file open,
  // "load latest") where pendingCursorRef is null and the cursor stays at end.
  useEffect(() => {
    const cursor = pendingCursorRef.current;
    if (cursor === null) return;
    pendingCursorRef.current = null;
    const id = requestAnimationFrame(() => {
      editorRef.current?.setSelection(cursor, cursor);
    });
    return () => cancelAnimationFrame(id);
  }, [reloadNonce]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(contentRef.current ?? "");
    const value = undoStackRef.current.pop() as string;
    // End any active typing burst so the next keystroke opens a fresh step.
    lastEditTimeRef.current = 0;
    syncUndoRedo();
    applyValue(value);
  }, [applyValue, syncUndoRedo]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(contentRef.current ?? "");
    const value = redoStackRef.current.pop() as string;
    lastEditTimeRef.current = 0;
    syncUndoRedo();
    applyValue(value);
  }, [applyValue, syncUndoRedo]);

  const handleToggleMode = useCallback(() => {
    if (mode === "edit") {
      // Leaving the uncontrolled editor — lift the live text into state so the
      // preview renders the latest edit.
      setContent(contentRef.current);
      setMode("preview");
    } else {
      setMode("edit");
    }
  }, [mode]);

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
      if (isOpenInPending && !inboxConsumedRef.current) {
        try {
          new File(fileUri).delete();
        } catch {
          // Non-fatal — iOS reclaims the Inbox eventually anyway.
        }
      }
    };
  }, [isOpenInPending, fileUri]);

  const performCopy = useCallback(async () => {
    if (content === null) return;
    setCopying(true);
    try {
      const result = await createIcloudCopy(content, fileName ?? "note.md");
      if (isOpenInPending) {
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
      await removeRecentFile(fileUri).catch(() => {});
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

  const processedMarkdown = useMemo(() => {
    if (content === null) return null;
    return replaceLocalImages(content, (filename) =>
      t("screens.viewer.imagePlaceholder", { filename }),
    );
  }, [content, t]);

  const markdownStyle: MarkdownStyle = useMemo(
    () => buildMarkdownStyle(theme, base),
    [theme, base],
  );

  const editable = isInPlaceEditable(fileUri);
  const loaded = content !== null && !error;
  const canToggle = loaded && editable;
  const showCopyButton = loaded && !editable;
  const toggleLabel =
    mode === "preview" ? t("screens.viewer.edit") : t("screens.viewer.preview");

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: fileName ?? "",
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
                        onPress={handleUndo}
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
                        onPress={handleRedo}
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
          <ThemedText themeColor="textSecondary">{error}</ThemedText>
        ) : mode === "edit" ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={headerHeight}
          >
            {content !== null && (
              <TextInput
                ref={editorRef}
                // Remount per file (and on "load latest" reload) so the
                // uncontrolled defaultValue re-seeds.
                key={`${fileUri}:${reloadNonce}`}
                multiline
                autoFocus
                defaultValue={content}
                onChangeText={handleEdit}
                style={[
                  styles.editor,
                  { color: theme.text, fontSize: base, lineHeight: Math.round(base * 1.4) },
                ]}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            )}
          </KeyboardAvoidingView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <EnrichedMarkdownText
              key={fileUri}
              markdown={processedMarkdown ?? ""}
              flavor="github"
              markdownStyle={markdownStyle}
              onLinkPress={({ url }) => {
                Linking.openURL(url).catch(() => {
                  // Malformed or unsupported scheme — nothing actionable to show.
                });
              }}
              selectable
            />
            {processedMarkdown === null && (
              <ThemedText themeColor="textSecondary" style={styles.loading}>
                {t("screens.viewer.loading")}
              </ThemedText>
            )}
          </ScrollView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  loading: {
    marginTop: Spacing.three,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
  },
  editor: {
    flex: 1,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    fontFamily: Fonts.mono,
    // fontSize / lineHeight are applied inline from the font-size setting.
  },
});
