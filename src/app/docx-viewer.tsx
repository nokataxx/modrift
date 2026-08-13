// Word (.docx) viewer (FR-42). View-only, like every v2 format (FR-21).
//
// mammoth converts the document to plain semantic HTML inside a WebView, and
// the page's CSS supplies everything Word's formatting does not survive as.
// The conversion runs in the WebView rather than in RN so the bundle it needs
// stays out of the Markdown path entirely.
import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { NetworkBanner } from '@/components/network-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Paywall } from '@/components/paywall';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { useViewerOrientation } from '@/hooks/use-viewer-orientation';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { buildDocxHtml } from '@/lib/docx/html';
import { recordRecentFile } from '@/lib/recent-files';
import { FONT_SIZE_BASE } from '@/lib/settings';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

export default function DocxViewerScreen() {
  const { fileUri, fileName } = useLocalSearchParams<{
    fileUri: string;
    fileName?: string;
  }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  const { isPro, isLoading: isProLoading } = useProEntitlement();

  // FR-36: landscape widens the measure, the same reason the Markdown viewer
  // allows it.
  useViewerOrientation();

  // Keyed by URI for the same reason as the PDF viewer: opening a second file
  // reuses this screen rather than mounting a fresh one, so state that isn't
  // tied to a URI would show the previous document's error under the new title.
  type LoadState =
    | { status: 'loading'; uri: string }
    | { status: 'ready'; uri: string; html: string }
    | { status: 'error'; uri: string };
  const [load, setLoad] = useState<LoadState>({ status: 'loading', uri: fileUri });
  const [reloadNonce, setReloadNonce] = useState(0);

  const current: LoadState = load.uri === fileUri ? load : { status: 'loading', uri: fileUri };

  // The HTML embeds the theme and text size, so a change to either has to
  // rebuild the page — hence they are dependencies, not props read at render.
  const base = FONT_SIZE_BASE[settings.fontSize];

  useEffect(() => {
    if (!isPro || !fileUri) return;
    let cancelled = false;
    (async () => {
      try {
        // Same coordinated read as every v2 format (FR-21): a File Provider
        // placeholder has to be materialized before its bytes can be read.
        const localUri = await FileBookmarkModule.materializeFileCoordinated(fileUri);
        const base64 = await new File(localUri).base64();
        if (cancelled) return;
        setLoad({
          status: 'ready',
          uri: fileUri,
          html: buildDocxHtml({
            base64,
            loadingLabel: t('screens.viewer.loading'),
            theme: {
              bg: theme.background,
              fg: theme.text,
              muted: theme.textSecondary,
              codeBg: theme.backgroundElement,
              base,
            },
          }),
        });
        recordRecentFile({ uri: fileUri, name: fileName ?? '' }).catch(() => {});
      } catch {
        if (!cancelled) setLoad({ status: 'error', uri: fileUri });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri, fileName, isPro, reloadNonce, theme, base, t]);

  const body = isProLoading ? (
    // Entitlement is not known synchronously. Showing the paywall here would
    // flash it at someone who has already paid, so wait it out (FR-44).
    <ThemedText themeColor="textSecondary" style={styles.message}>
      {t('screens.viewer.loading')}
    </ThemedText>
  ) : !isPro ? (
    <Paywall />
  ) : current.status === 'error' ? (
    <View>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {t('picker.errorReadFailed')}
      </ThemedText>
      <Pressable
        onPress={() => {
          setLoad({ status: 'loading', uri: fileUri });
          setReloadNonce((n) => n + 1);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.retryButton,
          { backgroundColor: theme.backgroundElement },
          pressed && { opacity: 0.6 },
        ]}
      >
        <ThemedText themeColor="tint">{t('common.retry')}</ThemedText>
      </Pressable>
    </View>
  ) : current.status === 'loading' ? (
    <ThemedText themeColor="textSecondary" style={styles.message}>
      {t('screens.viewer.loading')}
    </ThemedText>
  ) : (
    <WebView
      originWhitelist={['*']}
      source={{ html: current.html }}
      style={[styles.web, { backgroundColor: theme.background }]}
      // Without this the page scrolls with a foreign feel and long flicks stop
      // abruptly — same reason the Markdown editor sets it (v1.2.1).
      decelerationRate="normal"
      // A silent WebView failure (bundle exception, content process killed) has
      // to become a visible error rather than a black screen — FR-40's lesson,
      // which large documents are the likeliest to hit here.
      onError={() => setLoad({ status: 'error', uri: fileUri })}
      onContentProcessDidTerminate={() => setLoad({ status: 'error', uri: fileUri })}
      onMessage={(e) => {
        try {
          const message = JSON.parse(e.nativeEvent.data);
          if (message.type === 'error') setLoad({ status: 'error', uri: fileUri });
        } catch {
          // Not our message; ignore.
        }
      }}
    />
  );

  return (
    <ThemedView style={styles.container}>
      {/* Stock native header, as with the PDF viewer: FR-38's hide-on-scroll
          is wired to CodeMirror's injected JS and does not reach here. */}
      <Stack.Screen options={{ title: fileName ?? '' }} />
      <SafeAreaView style={styles.flex} edges={['bottom', 'left', 'right']}>
        <NetworkBanner />
        {body}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  web: { flex: 1 },
  message: { padding: Spacing.four },
  retryButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
  },
});
