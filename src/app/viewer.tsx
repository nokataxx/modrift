import { File } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { MarkdownWebView } from "@/components/markdown-web-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ViewerHeader } from "@/components/viewer-header";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "@/hooks/use-theme";
import { useViewerOrientation } from "@/hooks/use-viewer-orientation";
import { type CmTheme } from "@/lib/cm/html";
import { recordRecentFile } from "@/lib/recent-files";
import { FONT_SIZE_BASE } from "@/lib/settings";
import { normalizeMarkdown } from "@/lib/text";
import { Spacing } from "@/theme";
import FileBookmarkModule from "@modules/file-bookmark";

// Hide-on-scroll tuning: how far (px) the document must move past the anchor
// before the header toggles, the minimum offset before hiding is allowed (so
// short docs near the top keep their header), and the nav-bar row height under
// the status bar (iOS standard) — used since the native header is off and its
// height would report 0.
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
  // the whole document scales together (FR-06).
  const base = FONT_SIZE_BASE[settings.fontSize];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + HEADER_BAR_HEIGHT;
  const { fileUri, fileName, openInPending, source } = useLocalSearchParams<{
    fileUri: string;
    fileName: string;
    openInPending?: string;
    // How the viewer was reached: "picker" (in-app Open File) or "history"
    // (recent-files tap). Open-In launches carry no source.
    // Drives whether we record history.
    source?: string;
  }>();
  const isOpenInPending = openInPending === "true";

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by "retry" to re-run the read and remount the viewer.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Hide-on-scroll: the header slides via a reanimated shared value (0 shown →
  // 1 hidden) driven straight from the scroll handler, so scrolling never
  // triggers a React re-render or native-nav change. headerTargetRef mirrors the
  // current target so we don't restart the animation every frame; lastScrollY
  // is the anchor the next move is measured against.
  const headerProgress = useSharedValue(0);
  const headerTargetRef = useRef(0);
  const lastScrollY = useRef(0);

  // FR-07: landscape roughly doubles the measure so long lines wrap far less.
  useViewerOrientation();

  // Compare the offset to an anchor: crossing it downward past the threshold
  // hides the header, upward shows it, the top always shows. Only the shared
  // value is touched (no setState) so the fling is never interrupted; the slide
  // runs on the UI thread.
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
  // Reveal the header when loading a different file, so it's never left hidden
  // after a context change.
  useEffect(() => {
    lastScrollY.current = 0;
    setHeaderTarget(0);
  }, [fileUri, reloadNonce, setHeaderTarget]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const withTimeout = (p: Promise<string>) =>
          Promise.race([
            p,
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error("read-timeout")), READ_TIMEOUT_MS),
            ),
          ]);
        // Prefer a coordinated read (native module) so a not-yet-downloaded File
        // Provider placeholder (Google Drive, iCloud) is materialized before
        // reading — a plain File.text() throws "no such file" or hangs on such
        // files. Fall back to a plain read if the coordinated read fails: it
        // still works for already-materialized / local files. Both are capped
        // by the timeout.
        let text: string;
        try {
          text = await withTimeout(FileBookmarkModule.readFileCoordinated(fileUri));
        } catch {
          text = await withTimeout(new File(fileUri).text());
        }
        if (cancelled) return;
        setContent(normalizeMarkdown(text));
        // FR-04: record history only for files we can reliably re-open — opened
        // via the in-app picker or reopened from history. Files arriving through
        // iOS Open-In are deliberately not recorded: third-party providers
        // (Google Drive) can't be re-opened by bookmark, and Inbox copies are
        // throwaway, so an entry would just be a dead link.
        if (source === "picker" || source === "history") {
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
  }, [fileUri, fileName, t, source, reloadNonce]);

  // FR-01: retry a failed read in place (no re-navigation) — a File Provider
  // that was transiently unavailable usually recovers.
  const handleRetry = useCallback(() => {
    setError(null);
    setContent(null);
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    // An Open-In Inbox copy is a throwaway sandbox file. Delete it
    // when the viewer unmounts so we don't leave a stale sandbox file behind.
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

  return (
    <ThemedView style={styles.container}>
      {/* The native header is disabled; we render our own (below) so
          hide-on-scroll can slide it via a shared value without a re-render. */}
      <Stack.Screen options={{ headerShown: false }} />
      {/* No top edge: content runs full-height under the floating header (whose
          own top inset it carries); the viewer's topInset keeps text clear. */}
      <SafeAreaView style={styles.flex} edges={["bottom", "left", "right"]}>
        {error ? (
          <View style={{ paddingTop: headerHeight + Spacing.three }}>
            <ThemedText themeColor="textSecondary" style={styles.message}>
              {error}
            </ThemedText>
            <Pressable
              onPress={handleRetry}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: theme.backgroundElement },
                pressed && { opacity: 0.6 },
              ]}
            >
              <ThemedText themeColor="tint">{t("common.retry")}</ThemedText>
            </Pressable>
          </View>
        ) : content === null ? (
          <ThemedText
            themeColor="textSecondary"
            style={[styles.message, { paddingTop: headerHeight + Spacing.three }]}
          >
            {t("screens.viewer.loading")}
          </ThemedText>
        ) : (
          <MarkdownWebView
            key={`${fileUri}:${reloadNonce}`}
            content={content}
            theme={cmTheme}
            imagePlaceholder={t("screens.viewer.imagePlaceholder", {
              filename: "__F__",
            })}
            // Clear the floating header so the first lines aren't hidden behind
            // it; scrolls away past the top.
            topInset={headerHeight}
            onScroll={handleScroll}
            onError={() => setError(t("picker.errorReadFailed"))}
            onLinkPress={(url) => {
              Linking.openURL(url).catch(() => {
                // Malformed or unsupported scheme — nothing actionable.
              });
            }}
            style={[styles.flex, { backgroundColor: theme.background }]}
          />
        )}
      </SafeAreaView>
      {/* Our own header, floating over the full-height content and slid by the
          shared value on scroll. Painted last so it sits on top. */}
      <ViewerHeader
        progress={headerProgress}
        insetTop={insets.top}
        insetLeft={insets.left}
        insetRight={insets.right}
        barHeight={HEADER_BAR_HEIGHT}
        title={fileName ?? ""}
        onBack={() => router.back()}
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
  message: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: Spacing.three,
    marginHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
});
