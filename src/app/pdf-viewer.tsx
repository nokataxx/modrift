// PDF viewer (FR-41). View-only, like every v2 format (FR-21).
//
// Rendering is Apple PDFKit via react-native-pdf-renderer, whose iOS side is a
// direct PDFView subclass — so paging, pinch zoom and text selection are the
// OS implementations rather than anything of ours. That is why this file is
// mostly about getting the file onto disk, not about drawing it.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import PdfRendererView from 'react-native-pdf-renderer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { NetworkBanner } from '@/components/network-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Paywall } from '@/components/paywall';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { useViewerOrientation } from '@/hooks/use-viewer-orientation';
import { useTheme } from '@/hooks/use-theme';
import { recordRecentFile } from '@/lib/recent-files';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

export default function PdfViewerScreen() {
  const { fileUri, fileName } = useLocalSearchParams<{
    fileUri: string;
    fileName?: string;
  }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { isPro, isLoading: isProLoading } = useProEntitlement();

  // FR-36: a PDF page is wider than it is tall on a phone, so landscape is
  // where a scanned or A4 page becomes readable without zooming.
  useViewerOrientation();

  // What we know about the file we were asked to show. `uri` is part of the
  // state on purpose: opening a second PDF reuses this screen (same route, new
  // params) rather than mounting a fresh one, so state that isn't tied to a URI
  // leaks across — the previous file's error would sit under the new title.
  // `localUri` is the path PDFKit actually reads: a cloud file may not be on the
  // device yet, and PDFKit does no coordination of its own, so handing it a
  // provider URI fails on a placeholder exactly as File.text() did before FR-40.
  type LoadState =
    | { status: 'loading'; uri: string }
    | { status: 'ready'; uri: string; localUri: string }
    | { status: 'error'; uri: string };
  const [load, setLoad] = useState<LoadState>({ status: 'loading', uri: fileUri });
  // Bumped by "retry" to re-run the effect in place (FR-21, mirroring FR-40) —
  // a provider that was transiently unavailable usually recovers.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Anything we know about a different file is stale by definition, so it reads
  // as loading. Derived rather than reset in the effect, which would be a
  // cascading render (and would flash the old state first).
  const current: LoadState = load.uri === fileUri ? load : { status: 'loading', uri: fileUri };

  useEffect(() => {
    if (!isPro || !fileUri) return;
    let cancelled = false;
    FileBookmarkModule.materializeFileCoordinated(fileUri)
      .then((uri) => {
        if (cancelled) return;
        setLoad({ status: 'ready', uri: fileUri, localUri: uri });
        // Record only once the file actually resolved, so a failed open does
        // not leave a history row that fails again on every tap.
        recordRecentFile({ uri: fileUri, name: fileName ?? '' }).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', uri: fileUri });
      });
    return () => {
      cancelled = true;
    };
  }, [fileUri, fileName, isPro, reloadNonce]);

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
    <PdfRendererView
      style={styles.pdf}
      source={current.localUri}
      maxZoom={5}
      onError={() => setLoad({ status: 'error', uri: fileUri })}
    />
  );

  return (
    <ThemedView style={styles.container}>
      {/* The stock native header, unlike the Markdown viewer's custom one:
          FR-38's hide-on-scroll reads its scroll offset from CodeMirror's
          injected JS, which a native PDF view has no equivalent of. */}
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
  pdf: { flex: 1 },
  message: { padding: Spacing.four },
  retryButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
  },
});
