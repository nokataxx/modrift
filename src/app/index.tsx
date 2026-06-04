import * as DocumentPicker from 'expo-document-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { loadRecentFiles, removeRecentFile, type RecentFile } from '@/lib/recent-files';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

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
              <Pressable
                onPress={() => handleRecentPress(item)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText numberOfLines={1}>{item.name}</ThemedText>
              </Pressable>
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
    marginHorizontal: -Spacing.two,
    borderRadius: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
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
