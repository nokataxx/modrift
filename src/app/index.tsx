import * as DocumentPicker from 'expo-document-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { classifyFileLocation, type FileLocationKind } from '@/lib/file-location';
import { loadRecentFiles, removeRecentFile, type RecentFile } from '@/lib/recent-files';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

const LOCATION_KEY: Record<FileLocationKind, string> = {
  icloudCopy: 'screens.recentFiles.locationIcloudCopy',
  icloudDrive: 'screens.recentFiles.locationIcloudDrive',
  appSandbox: 'screens.recentFiles.locationAppSandbox',
  external: 'screens.recentFiles.locationExternal',
};

const DELETE_RED = '#FF3B30';

function locationLabel(file: RecentFile, t: (key: string) => string): string {
  const location = classifyFileLocation(file.uri);
  // For files coming from a third-party File Provider, prefer the display
  // name that NSFileProviderManager handed us at record time — it knows
  // "Google Drive" / "Dropbox" reliably across install variants. Fall
  // back to URI-pattern detection only when the native lookup didn't
  // produce a name (e.g. for files opened before this code shipped).
  if (location.kind === 'external') {
    return file.providerName ?? location.providerName ?? t(LOCATION_KEY.external);
  }
  return t(LOCATION_KEY[location.kind]);
}

const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt'] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentFile[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadRecentFiles().then((items) => {
        if (!cancelled) setRecent(items);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleOpen = async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ['text/markdown', 'text/plain'],
        copyToCacheDirectory: false,
        multiple: false,
      });
    } catch {
      Alert.alert(t('picker.errorTitle'), t('picker.errorOpenFailed'));
      return;
    }

    if (result.canceled) return;

    const asset = result.assets[0];
    const lowerName = asset.name.toLowerCase();
    const isSupported = SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isSupported) {
      Alert.alert(t('picker.errorTitle'), t('picker.unsupportedType'));
      return;
    }

    router.push({
      pathname: '/viewer',
      params: { fileUri: asset.uri, fileName: asset.name },
    });
  };

  const handleRecentPress = async (item: RecentFile) => {
    // Prefer the bookmark when present so the resolved URI carries a current
    // security scope. If the bookmark is missing or fails to resolve, drop the
    // stale entry and tell the user to re-open via the picker.
    if (item.bookmark) {
      const resolved = await FileBookmarkModule.resolveBookmark(item.bookmark).catch(() => null);
      if (resolved !== null) {
        router.push({
          pathname: '/viewer',
          params: { fileUri: resolved.uri, fileName: item.name },
        });
        return;
      }
    }
    await removeRecentFile(item.uri);
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    Alert.alert(t('screens.recentFiles.reopenFailedTitle'), t('screens.recentFiles.reopenFailedMessage'));
  };

  const handleRecentDelete = useCallback(async (item: RecentFile) => {
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    await removeRecentFile(item.uri);
  }, []);

  const isEmpty = recent !== null && recent.length === 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('screens.recentFiles.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {isEmpty ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {t('screens.recentFiles.empty')}
          </ThemedText>
        ) : (
          <FlatList
            data={recent ?? []}
            keyExtractor={(item) => item.uri}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            )}
            renderItem={({ item }) => (
              <ReanimatedSwipeable
                friction={2}
                rightThreshold={40}
                renderRightActions={() => (
                  <Pressable
                    style={styles.deleteAction}
                    onPress={() => handleRecentDelete(item)}>
                    <ThemedText style={styles.deleteActionText}>
                      {t('common.delete')}
                    </ThemedText>
                  </Pressable>
                )}>
                <Pressable
                  onPress={() => handleRecentPress(item)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: theme.background },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText numberOfLines={1}>{item.name}</ThemedText>
                  <ThemedText
                    themeColor="textSecondary"
                    numberOfLines={1}
                    style={styles.rowSubtitle}>
                    {locationLabel(item, t)}
                  </ThemedText>
                </Pressable>
              </ReanimatedSwipeable>
            )}
            style={styles.list}
          />
        )}

        <Pressable
          style={({ pressed }) => [
            styles.openButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}
          onPress={handleOpen}>
          <ThemedText type="default">{t('picker.open')}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  empty: {
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing.three,
  },
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  deleteAction: {
    backgroundColor: DELETE_RED,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  openButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
