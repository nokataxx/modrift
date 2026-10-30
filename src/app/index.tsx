import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { classifyFileLocation, type FileLocationKind } from '@/lib/file-location';
import { isSupportedFile } from '@/lib/file-types';
import {
  loadRecentFiles,
  normalizeUri,
  removeRecentFile,
  type RecentFile,
} from '@/lib/recent-files';
import { MaxContentWidth, Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

const LOCATION_KEY: Record<FileLocationKind, string> = {
  icloudDrive: 'screens.recentFiles.locationIcloudDrive',
  appSandbox: 'screens.recentFiles.locationAppSandbox',
  external: 'screens.recentFiles.locationExternal',
};

// Where a recent file lives, so same-named files from different clouds can be
// told apart. iOS won't name third-party clouds reliably, so those fall back to
// a generic label when no provider name was detected.
function locationLabel(file: RecentFile, t: (key: string) => string): string {
  const location = classifyFileLocation(file.uri);
  if (location.kind === 'external') {
    return file.providerName ?? location.providerName ?? t(LOCATION_KEY.external);
  }
  // iCloud Drive files get their containing folder as a breadcrumb
  // ("iCloud Drive › Notes"); files at the iCloud Drive root show the plain label.
  if (location.kind === 'icloudDrive' && location.folder) {
    return `${t(LOCATION_KEY.icloudDrive)} › ${location.folder}`;
  }
  return t(LOCATION_KEY[location.kind]);
}

// Format the opened time as a plain localized date for a row subtitle.
function formatShortDate(ms: number, language: string): string {
  const locale = language.startsWith('ja') ? 'ja-JP' : 'en-US';
  try {
    return new Date(ms).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '';
  }
}

// One history row. Tap opens the file; long-press offers "remove from list",
// which never touches the file itself.
function RecentRow({
  item,
  onPress,
  onRemove,
}: {
  item: RecentFile;
  onPress: (item: RecentFile) => void;
  onRemove: (item: RecentFile) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const handleLongPress = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: item.name,
        options: [t('screens.recentFiles.removeFromListAction'), t('common.cancel')],
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) onRemove(item);
      },
    );
  };

  const subtitle = [formatShortDate(item.openedAt, i18n.language), locationLabel(item, t)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.background },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <SymbolView
        name="doc.text"
        size={22}
        weight="regular"
        tintColor={theme.text}
        style={styles.rowIcon}
      />
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.rowSubtitle}>
          {subtitle}
        </ThemedText>
      </View>
    </Pressable>
  );
}

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

  // FR-01 経路A: the system picker.
  const handleOpen = async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        // Keep the original file URL (don't copy into the app cache).
        // copyToCacheDirectory:true was worse — the copy itself throws "no such
        // file" on a placeholder the provider won't materialize. Instead the
        // viewer reads via FileBookmarkModule.readFileCoordinated, whose
        // NSFileCoordinator read makes the provider download the file first, so
        // un-materialized Google Drive / iCloud files open (verified 2026-07-27).
        copyToCacheDirectory: false,
        multiple: false,
        // public.text (UTType.text): Markdown, plain text and, later, JSON /
        // source code all conform to it, so everything else is greyed out in
        // the picker instead of being rejected after the user picks it.
        type: 'text/*',
      });
    } catch {
      Alert.alert(t('picker.errorTitle'), t('picker.errorOpenFailed'));
      return;
    }

    if (result.canceled) return;

    const asset = result.assets[0];
    // public.text is wider than what Modrift renders (e.g. .csv, .html), so the
    // extension check still has the final say.
    if (!isSupportedFile(asset.name)) {
      Alert.alert(t('picker.errorTitle'), t('picker.unsupportedType'));
      return;
    }

    router.push({
      pathname: '/viewer',
      params: { fileUri: asset.uri, fileName: asset.name, source: 'picker' },
    });
  };

  // FR-04: reopen from history.
  const handleRecentPress = async (item: RecentFile) => {
    // Prefer the bookmark so the resolved URI carries a current security scope —
    // needed for files outside our sandbox (iCloud Drive, third-party clouds).
    if (item.bookmark) {
      const resolved = await FileBookmarkModule.resolveBookmark(item.bookmark).catch(() => null);
      if (resolved !== null) {
        // Bookmarks track the file across external (Files App) renames, so the
        // resolved URI may differ from the stored one. Derive the current name
        // from it, and retire the stale entry first — otherwise the viewer
        // would record a fresh entry under the new URI while the old one (with
        // the old name) lingers, leaving two same-looking history rows.
        const currentName = decodeURIComponent(resolved.uri.split('/').pop() ?? '') || item.name;
        if (normalizeUri(resolved.uri) !== normalizeUri(item.uri)) {
          await removeRecentFile(item.uri);
        }
        router.push({
          pathname: '/viewer',
          params: { fileUri: resolved.uri, fileName: currentName, source: 'history' },
        });
        return;
      }
    }
    // No usable bookmark: try the raw URI before giving up, so an entry that
    // simply has no bookmark isn't dropped while still reachable.
    if (new File(item.uri).exists) {
      router.push({
        pathname: '/viewer',
        params: { fileUri: item.uri, fileName: item.name, source: 'history' },
      });
      return;
    }
    // Genuinely unreachable (moved, deleted, or not yet downloaded). Drop the
    // dead entry so it can't be tapped again, and tell the user without
    // asserting the file is gone for good.
    await removeRecentFile(item.uri);
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    Alert.alert(t('screens.recentFiles.reopenFailedTitle'), t('screens.recentFiles.reopenFailedMessage'));
  };

  const handleRemove = useCallback(async (item: RecentFile) => {
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    await removeRecentFile(item.uri);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: t('app.name'),
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleOpen}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('picker.open')}
                style={styles.headerIcon}>
                <SymbolView name="folder" size={22} weight="semibold" tintColor={theme.text} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('screens.settings.title')}
                style={styles.headerIcon}>
                <SymbolView name="gearshape" size={22} weight="semibold" tintColor={theme.text} />
              </Pressable>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {/* Cap width and centre on iPad / large screens; a no-op on phones
            since the column is narrower than the cap. */}
        <View style={styles.content}>
          <FlatList
            data={recent ?? []}
            keyExtractor={(item) => item.uri}
            // SDK 58: on iOS 26+ the Stack header is transparent (Liquid Glass)
            // and the screen runs under it; this insets the list below it.
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            // Bounce even when the list is shorter than the screen, so a drag
            // anywhere (including the empty area below the rows) responds.
            alwaysBounceVertical
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            )}
            // Inside the list (not beside it) so it gets the same header inset.
            ListEmptyComponent={
              recent === null ? undefined : (
                <View style={styles.empty}>
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    {t('screens.recentFiles.recentEmpty')}
                  </ThemedText>
                  <Pressable
                    onPress={handleOpen}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.openButton,
                      { backgroundColor: theme.tint },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <ThemedText style={styles.openButtonLabel}>{t('picker.open')}</ThemedText>
                  </Pressable>
                </View>
              )
            }
            renderItem={({ item }) => (
              <RecentRow item={item} onPress={handleRecentPress} onRemove={handleRemove} />
            )}
            style={styles.list}
          />
        </View>
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
    paddingTop: Spacing.three,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.four,
    paddingTop: Spacing.five,
  },
  emptyText: {
    textAlign: 'center',
  },
  openButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
  },
  openButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing.three,
    // Fill the list's frame even when there are few rows, so the empty area
    // below them is part of the scrollable content and responds to drags
    // (with alwaysBounceVertical). Without this the touch-catching content is
    // only as tall as the rows, so the empty area below is dead.
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    // Align to the top so the icon lines up with the file-name row, not the
    // vertical centre of the name + date/location block.
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  // marginTop nudges the 22pt glyph to sit centred on the 24pt file-name line.
  rowIcon: {
    width: 22,
    marginTop: 1,
  },
  rowText: {
    flex: 1,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Even padding around each header glyph so both keep a comfortable tap target.
  headerIcon: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
