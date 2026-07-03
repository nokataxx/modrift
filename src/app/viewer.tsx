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
import { createIcloudCopy, IcloudUnavailableError } from "@/lib/icloud-copy";
import { recordRecentFile, removeRecentFile } from "@/lib/recent-files";
import { FONT_SIZE_BASE } from "@/lib/settings";
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

  // FR-14 undo/redo is handled inside CodeMirror; these mirror its reported
  // availability so the header buttons enable/disable.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
  }, [fileUri, fileName, t, source]);

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
      // Remount the editor so it re-seeds from the reloaded text (and its undo
      // history resets, since the buffer was replaced wholesale).
      setReloadNonce((n) => n + 1);
    } catch {
      // Non-fatal — keep the current buffer if the reread fails.
    }
  }, [fileUri]);

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
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);

  const handleToggleMode = useCallback(() => {
    setMode((m) => (m === "edit" ? "preview" : "edit"));
  }, []);

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

  const cmTheme: CmTheme = useMemo(
    () => ({
      bg: theme.background,
      fg: theme.text,
      tint: theme.tint,
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
              // buffer; preview⇄edit toggles in place via the editable prop.
              key={`${fileUri}:${reloadNonce}`}
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
});
