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
} from "react-native";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { classifyFileLocation, isInPlaceEditable } from "@/lib/file-location";
import { createIcloudCopy, IcloudUnavailableError } from "@/lib/icloud-copy";
import { recordRecentFile, removeRecentFile } from "@/lib/recent-files";
import { Fonts, Spacing } from "@/theme";

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

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
  // True once an Open-In Inbox file has been copied to iCloud, so the unmount
  // cleanup doesn't try to delete an already-consumed source.
  const inboxConsumedRef = useRef(false);

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

  const saveNow = useCallback(() => {
    if (!isDirtyRef.current || contentRef.current === null) return;
    try {
      new File(fileUri).write(contentRef.current);
      isDirtyRef.current = false;
    } catch {
      // Silent per FR-04. Next edit will retry.
    }
  }, [fileUri]);

  const handleEdit = useCallback(
    (next: string) => {
      // Uncontrolled editor: write straight to the ref without setContent, so
      // the TextInput isn't re-rendered (and re-scrolled) on every keystroke —
      // that re-render is what made the Japanese IME jump the view mid-input.
      // The preview pulls the latest text from the ref on mode switch.
      contentRef.current = next;
      isDirtyRef.current = true;
      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
      }
      pendingTimeoutRef.current = setTimeout(() => {
        pendingTimeoutRef.current = null;
        saveNow();
      }, 3000);
    },
    [saveNow],
  );

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
        saveNow();
      }
    });
    return () => subscription.remove();
  }, [saveNow]);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      saveNow();
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
    () => ({
      paragraph: { color: theme.text },
      h1: { color: theme.text },
      h2: { color: theme.text },
      h3: { color: theme.text },
      h4: { color: theme.text },
      h5: { color: theme.text },
      h6: { color: theme.text },
      strong: { color: theme.text },
      em: { color: theme.text },
      list: {
        color: theme.text,
        bulletColor: theme.text,
        markerColor: theme.text,
        // The library has no per-item margin; widening lineHeight is how we
        // give consecutive list items vertical breathing room.
        lineHeight: 28,
      },
      blockquote: {
        color: theme.text,
        borderColor: theme.textSecondary,
        // Without an explicit background the library's default fill renders the
        // quote text unreadable (looked inverted). Pin it to the element tint.
        backgroundColor: theme.backgroundElement,
      },
      link: { color: theme.tint, underline: true },
      code: {
        color: theme.text,
        backgroundColor: theme.backgroundElement,
        // Drop the default outline so inline code reads as a tint, not a box.
        borderColor: "transparent",
      },
      codeBlock: {
        color: theme.text,
        backgroundColor: theme.backgroundElement,
      },
      table: {
        color: theme.text,
        headerTextColor: theme.text,
        headerBackgroundColor: theme.background,
        rowEvenBackgroundColor: theme.background,
        rowOddBackgroundColor: theme.background,
        borderColor: theme.textSecondary,
      },
    }),
    [theme],
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
                // Remount per file so the uncontrolled defaultValue re-seeds.
                key={fileUri}
                multiline
                autoFocus
                defaultValue={content}
                onChangeText={handleEdit}
                style={[styles.editor, { color: theme.text }]}
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
  editor: {
    flex: 1,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 22,
  },
});
