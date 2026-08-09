// Image viewer (FR-45). View-only, like every v2 format (FR-21) — but unlike
// PDF/docx/xlsx this one is FREE and must never consult useProEntitlement():
// 5.9 puts the paywall above images, not below them.
//
// Zooming is the ScrollView's own, not a gesture library's. iOS gives a scroll
// view pinch, double-tap, inertia and rubber-banding for the price of two
// props, and matching that by hand is a lot of code to arrive back where the OS
// already was.
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { NetworkBanner } from '@/components/network-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useViewerOrientation } from '@/hooks/use-viewer-orientation';
import { useTheme } from '@/hooks/use-theme';
import { recordRecentFile } from '@/lib/recent-files';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

export default function ImageViewerScreen() {
  const { fileUri, fileName } = useLocalSearchParams<{
    fileUri: string;
    fileName?: string;
  }>();
  const { t } = useTranslation();
  const theme = useTheme();

  // FR-36: a landscape photo is the obvious case for turning the phone.
  useViewerOrientation();

  // Keyed by URI for the same reason as the other v2 viewers: opening a second
  // file reuses this screen, so state that isn't tied to a URI would show the
  // previous file's error under the new title. `localUri` is the materialised
  // path — a cloud image may be a placeholder, and the decoder does no
  // coordination of its own (FR-21).
  type LoadState =
    | { status: 'loading'; uri: string }
    | { status: 'ready'; uri: string; localUri: string }
    | { status: 'error'; uri: string };
  const [load, setLoad] = useState<LoadState>({ status: 'loading', uri: fileUri });
  const [reloadNonce, setReloadNonce] = useState(0);

  const current: LoadState = load.uri === fileUri ? load : { status: 'loading', uri: fileUri };

  useEffect(() => {
    if (!fileUri) return;
    let cancelled = false;
    FileBookmarkModule.materializeFileCoordinated(fileUri)
      .then((uri) => {
        if (cancelled) return;
        setLoad({ status: 'ready', uri: fileUri, localUri: uri });
        // Only once it resolved, so a failed open leaves no history row that
        // fails again on every tap.
        recordRecentFile({ uri: fileUri, name: fileName ?? '' }).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', uri: fileUri });
      });
    return () => {
      cancelled = true;
    };
  }, [fileUri, fileName, reloadNonce]);

  const body =
    current.status === 'error' ? (
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
      <ScrollView
        style={styles.flex}
        // flexGrow with the default `stretch` alignment: the image fills exactly
        // the scroll view's visible box, whatever that turns out to be.
        //
        // Two wrong versions came before this one. Centring the container
        // (alignItems: 'center') left the image's cross-axis width at auto — an
        // <Image> has no intrinsic layout size, so that is zero, and the screen
        // renders blank in a way that looks like a decode failure. Measuring the
        // scroll view with onLayout fixed the width but pushed the picture below
        // centre on device, because the measured box does not account for the
        // content inset iOS adds underneath. Letting the layout do it needs
        // neither measurement nor inset arithmetic, and follows rotation for
        // free.
        contentContainerStyle={styles.zoomContent}
        maximumZoomScale={5}
        minimumZoomScale={1}
        // The header already sits above us; a second, automatic adjustment is
        // what shifted the image down.
        contentInsetAdjustmentBehavior="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: current.localUri }}
          style={styles.flex}
          // contain, never cover: a viewer must not crop what it is showing.
          // This is also what centres the picture inside the box.
          contentFit="contain"
          // Animated GIFs play on their own; nothing to opt into.
          onError={() => setLoad({ status: 'error', uri: fileUri })}
          accessibilityLabel={fileName}
        />
      </ScrollView>
    );

  return (
    <ThemedView style={styles.container}>
      {/* Stock native header, as with the other v2 viewers: FR-38's
          hide-on-scroll reads its offset from CodeMirror's injected JS. */}
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
  zoomContent: { flexGrow: 1 },
  message: { padding: Spacing.four },
  retryButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
  },
});
