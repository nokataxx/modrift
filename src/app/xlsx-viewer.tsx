// Spreadsheet (.xlsx) viewer (FR-43). View-only, like every v2 format (FR-21).
//
// SheetJS parses the workbook inside the WebView and renders one sheet at a
// time as an HTML table; the page supplies the borders, the header row and the
// sheet tabs, since sheet_to_html emits none of them.
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
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { useViewerOrientation } from '@/hooks/use-viewer-orientation';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { recordRecentFile } from '@/lib/recent-files';
import { FONT_SIZE_BASE } from '@/lib/settings';
import { buildXlsxHtml } from '@/lib/xlsx/html';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

export default function XlsxViewerScreen() {
  const { fileUri, fileName } = useLocalSearchParams<{
    fileUri: string;
    fileName?: string;
  }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  const { isPro } = useProEntitlement();

  // FR-36: the case that wants landscape most — a wide sheet gets roughly twice
  // the columns on screen, which is the only mitigation this viewer offers for
  // a table many screens wide (freeze panes are a non-goal, FR-43).
  useViewerOrientation();

  // Keyed by URI, as with the other v2 viewers: opening a second file reuses
  // this screen, so untied state would show the previous file's error.
  type LoadState =
    | { status: 'loading'; uri: string }
    | { status: 'ready'; uri: string; html: string }
    | { status: 'error'; uri: string };
  const [load, setLoad] = useState<LoadState>({ status: 'loading', uri: fileUri });
  const [reloadNonce, setReloadNonce] = useState(0);

  const current: LoadState = load.uri === fileUri ? load : { status: 'loading', uri: fileUri };

  const base = FONT_SIZE_BASE[settings.fontSize];

  useEffect(() => {
    if (!isPro || !fileUri) return;
    let cancelled = false;
    (async () => {
      try {
        const localUri = await FileBookmarkModule.materializeFileCoordinated(fileUri);
        const base64 = await new File(localUri).base64();
        if (cancelled) return;
        setLoad({
          status: 'ready',
          uri: fileUri,
          html: buildXlsxHtml({
            base64,
            loadingLabel: t('screens.viewer.loading'),
            // The row cap is applied in the page, where the row count is known,
            // so the strings go in as templates rather than finished text.
            labels: {
              rows: t('screens.xlsx.rows'),
              rowsTruncated: t('screens.xlsx.rowsTruncated'),
              showAll: t('screens.xlsx.showAll'),
            },
            theme: {
              bg: theme.background,
              fg: theme.text,
              muted: theme.textSecondary,
              codeBg: theme.backgroundElement,
              tint: theme.tint,
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

  const body = !isPro ? (
    <ThemedText themeColor="textSecondary" style={styles.message}>
      {t('screens.pro.locked')}
    </ThemedText>
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
      decelerationRate="normal"
      // A large workbook is the likeliest thing to kill the content process,
      // which must surface as an error rather than a black screen (FR-40).
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
