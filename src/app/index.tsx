import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/components/network-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { type CloudNames, loadCloudNames } from '@/lib/cloud-names';
import {
  classifyFileLocation,
  externalContainerKey,
  shortContainerTag,
  type FileLocationKind,
} from '@/lib/file-location';
import {
  deleteIcloudCopy,
  NameInUseError,
  renameIcloudCopy,
} from '@/lib/icloud-copy';
import {
  loadRecentFiles,
  normalizeUri,
  removeRecentFile,
  renameRecentFile,
  type RecentFile,
} from '@/lib/recent-files';
import { loadVaultFolder, type VaultFolder } from '@/lib/vault-folder';
import { Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

const LOCATION_KEY: Record<FileLocationKind, string> = {
  icloudCopy: 'screens.recentFiles.locationIcloudCopy',
  icloudDrive: 'screens.recentFiles.locationIcloudDrive',
  appSandbox: 'screens.recentFiles.locationAppSandbox',
  external: 'screens.recentFiles.locationExternal',
};

// Rename edits the file body on disk, so it gets a distinct accent (iOS system
// green) rather than sharing the neutral gray of the harmless "remove from
// history" action. Red is reserved for the destructive file delete, which lives
// only in the long-press action sheet.
const RENAME_GREEN = '#34C759';
const REMOVE_GRAY = '#636366';

function locationLabel(
  file: RecentFile,
  t: (key: string) => string,
  cloudNames: CloudNames,
): string {
  const location = classifyFileLocation(file.uri);
  // Third-party clouds: iOS won't name them, so resolve in order of confidence —
  // a name the user gave this source, then any provider name we detected, else
  // the generic label plus a short stable tag ("他のクラウド · A348") so two
  // unnamed clouds stay visually distinct until the user names them.
  if (location.kind === 'external') {
    const key = externalContainerKey(file.uri);
    if (key && cloudNames[key]) return cloudNames[key];
    const detected = file.providerName ?? location.providerName;
    if (detected) return detected;
    const base = t(LOCATION_KEY.external);
    return key ? `${base} · ${shortContainerTag(key)}` : base;
  }
  return t(LOCATION_KEY[location.kind]);
}

// Mirrors the public.plain-text UTI we declare in CFBundleDocumentTypes so the
// in-app picker accepts the same file shapes the Files App "Modrift で開く"
// path already does — notably .text, which iCloud sometimes assigns to plain
// text files instead of .txt.
const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt', '.text'] as const;

// One history row. Each row owns its own swipe handle and an `openRef` flag so a
// tap while the actions are revealed closes the row instead of opening the file
// (iOS Mail behaviour). The flag is set the moment an open-drag starts — not on
// "will open" — so a release that both finishes the swipe and fires the row's
// press can't sneak a navigation through before the guard is in place.
//
// Swipe actions are non-destructive only: "remove from list" (history) for every
// row, plus "rename" for our own iCloud copies. The one destructive operation —
// deleting a Modrift-generated copy's file body (FR-22) — lives behind a
// deliberate long-press action sheet so it can't be triggered by a quick swipe.
function RecentRow({
  item,
  cloudNames,
  onPress,
  onRenameCopy,
  onRemoveHistory,
  onDeleteFile,
}: {
  item: RecentFile;
  cloudNames: CloudNames;
  onPress: (item: RecentFile) => void;
  onRenameCopy: (item: RecentFile) => void;
  onRemoveHistory: (item: RecentFile) => void;
  onDeleteFile: (item: RecentFile) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);
  const openRef = useRef(false);
  const isCopy = classifyFileLocation(item.uri).kind === 'icloudCopy';

  const handleLongPress = () => {
    // FR-22: file deletion is offered only for our own iCloud copies, and only
    // via this long-press. The action sheet's title/message plus its destructive
    // button is the required confirmation — no quick gesture deletes a file.
    if (!isCopy) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('screens.recentFiles.deleteFileTitle', { name: item.name }),
        message: t('screens.recentFiles.deleteFileMessage'),
        options: [t('screens.recentFiles.deleteFileAction'), t('common.cancel')],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) onDeleteFile(item);
      },
    );
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      onSwipeableOpenStartDrag={() => {
        openRef.current = true;
      }}
      onSwipeableClose={() => {
        openRef.current = false;
      }}
      renderRightActions={() => (
        <View style={styles.actions}>
          {/* Our own iCloud copies can be renamed in place (FR-22); rename is
              non-destructive so it stays on the swipe. */}
          {isCopy && (
            <Pressable style={styles.renameAction} onPress={() => onRenameCopy(item)}>
              <ThemedText style={styles.actionText}>
                {t('screens.recentFiles.renameAction')}
              </ThemedText>
            </Pressable>
          )}
          {/* History-only removal for every row — never touches the file. */}
          <Pressable style={styles.removeAction} onPress={() => onRemoveHistory(item)}>
            <ThemedText style={styles.actionText}>
              {t('screens.recentFiles.removeFromListAction')}
            </ThemedText>
          </Pressable>
        </View>
      )}>
      <Pressable
        onPress={() => {
          // Swiped open → tap closes the row rather than opening the file, so
          // the revealed actions stay reachable.
          if (openRef.current) {
            swipeRef.current?.close();
            return;
          }
          onPress(item);
        }}
        onLongPress={handleLongPress}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: theme.background },
          pressed && { backgroundColor: theme.backgroundElement },
        ]}>
        <ThemedText numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.rowSubtitle}>
          {locationLabel(item, t, cloudNames)}
        </ThemedText>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentFile[] | null>(null);
  const [cloudNames, setCloudNames] = useState<CloudNames>({});
  // FR-24: a set Vault folder is what flips the home into "Vault mode" — there's
  // no separate toggle. Reloaded on focus so changing it in settings reflects
  // here on return.
  const [vaultFolder, setVaultFolder] = useState<VaultFolder | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([loadRecentFiles(), loadCloudNames(), loadVaultFolder()]).then(
        ([items, names, folder]) => {
          if (cancelled) return;
          setRecent(items);
          setCloudNames(names);
          setVaultFolder(folder);
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleOpenVault = () => {
    if (!vaultFolder) return;
    router.push({
      pathname: '/vault',
      params: { path: vaultFolder.uri, name: vaultFolder.name },
    });
  };

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
      params: { fileUri: asset.uri, fileName: asset.name, source: 'picker' },
    });
  };

  const handleRecentPress = async (item: RecentFile) => {
    // Prefer the bookmark when present so the resolved URI carries a current
    // security scope — needed for files that live outside our sandbox
    // (iCloud Drive, third-party File Providers).
    if (item.bookmark) {
      const resolved = await FileBookmarkModule.resolveBookmark(item.bookmark).catch(() => null);
      if (resolved !== null) {
        // Bookmarks track the file across external (iCloud Files App) renames,
        // so the resolved URI may differ from the stored one. Derive the current
        // name from it, and retire the stale entry first — otherwise the viewer
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
    // No usable bookmark: our own iCloud copies (ubiquity container) open by URI
    // directly without a security scope, so try that before giving up — this
    // avoids dropping a perfectly valid entry that simply has no bookmark.
    if (new File(item.uri).exists) {
      router.push({
        pathname: '/viewer',
        params: { fileUri: item.uri, fileName: item.name, source: 'history' },
      });
      return;
    }
    // Genuinely unreachable (moved, deleted, or not yet downloaded from iCloud).
    // Drop the dead entry so it can't be tapped again, and tell the user without
    // asserting the file is gone for good.
    await removeRecentFile(item.uri);
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    Alert.alert(t('screens.recentFiles.reopenFailedTitle'), t('screens.recentFiles.reopenFailedMessage'));
  };

  const handleRecentDelete = useCallback(async (item: RecentFile) => {
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    await removeRecentFile(item.uri);
  }, []);

  // FR-22: rename a Modrift-generated iCloud copy (e.g. "Bookmarks-1.md" → a
  // meaningful name). Renames the file in iCloud Drive › Modrift and updates the
  // history entry to track its new uri/name. Only offered for icloudCopy rows.
  const handleRenameCopy = useCallback(
    (item: RecentFile) => {
      const currentBase = item.name.replace(/\.md$/i, '');
      Alert.prompt(
        t('screens.recentFiles.renameTitle'),
        t('screens.recentFiles.renameMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.recentFiles.renameConfirm'),
            onPress: (value?: string) => {
              if (!value || !value.trim()) return;
              try {
                const result = renameIcloudCopy(item.uri, value);
                // Reload from storage rather than patching state locally:
                // renameRecentFile may drop a duplicate destination entry, and
                // re-reading keeps the list in sync with that dedup.
                renameRecentFile(item.uri, result)
                  .then(() => loadRecentFiles())
                  .then((items) => setRecent(items))
                  .catch(() => {});
              } catch (err) {
                const message =
                  err instanceof NameInUseError
                    ? t('screens.recentFiles.renameErrorInUse')
                    : t('screens.recentFiles.renameErrorFailed');
                Alert.alert(t('screens.recentFiles.renameErrorTitle'), message);
              }
            },
          },
        ],
        'plain-text',
        currentBase,
      );
    },
    [t],
  );

  // FR-22: delete a Modrift-generated iCloud copy's file body. Reached only
  // through the long-press action sheet (RecentRow), which carries the required
  // confirmation, so this just performs the deletion and prunes the history
  // entry. If the file is already gone we still drop the now-dead entry.
  const handleDeleteFile = useCallback((item: RecentFile) => {
    try {
      deleteIcloudCopy(item.uri);
    } catch {
      // File may have been deleted externally — fall through and still remove
      // the now-dead history entry below.
    }
    removeRecentFile(item.uri)
      .then(() =>
        setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri))),
      )
      .catch(() => {});
  }, []);

  const isEmpty = recent !== null && recent.length === 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: t('screens.recentFiles.title'),
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('screens.settings.title')}>
              <SymbolView
                name="gearshape"
                size={22}
                weight="semibold"
                tintColor={theme.text}
              />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <NetworkBanner />
        {vaultFolder && (
          <Pressable
            onPress={handleOpenVault}
            style={({ pressed }) => [
              styles.vaultRow,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button">
            <SymbolView name="folder.fill" size={22} weight="regular" tintColor={theme.tint} />
            <View style={styles.vaultRowText}>
              <ThemedText numberOfLines={1}>{vaultFolder.name}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.vaultRowLabel}>
                {t('screens.recentFiles.vaultLabel')}
              </ThemedText>
            </View>
            <SymbolView
              name="chevron.right"
              size={14}
              weight="semibold"
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
        {isEmpty ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {t('screens.recentFiles.empty')}
          </ThemedText>
        ) : (
          <FlatList
            data={recent ?? []}
            keyExtractor={(item) => item.uri}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            )}
            renderItem={({ item }) => (
              <RecentRow
                item={item}
                cloudNames={cloudNames}
                onPress={handleRecentPress}
                onRenameCopy={handleRenameCopy}
                onRemoveHistory={handleRecentDelete}
                onDeleteFile={handleDeleteFile}
              />
            )}
            style={styles.list}
          />
        )}

        {vaultFolder ? (
          // Vault mode: Open File is the rare escape hatch for files outside the
          // Vault, so it's demoted to a small secondary link.
          <Pressable
            style={({ pressed }) => [styles.openElsewhere, pressed && styles.pressed]}
            onPress={handleOpen}
            accessibilityRole="button">
            <ThemedText themeColor="textSecondary" style={styles.openElsewhereText}>
              {t('screens.recentFiles.openElsewhere')}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.openButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
            onPress={handleOpen}>
            <ThemedText type="default">{t('picker.open')}</ThemedText>
          </Pressable>
        )}
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
  actions: {
    flexDirection: 'row',
  },
  renameAction: {
    backgroundColor: RENAME_GREEN,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  removeAction: {
    backgroundColor: REMOVE_GRAY,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  actionText: {
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
  // Vault mode (FR-24): primary "My Vault" entry above history.
  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  vaultRowText: {
    flex: 1,
  },
  vaultRowLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  // Demoted Open File link shown in Vault mode.
  openElsewhere: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  openElsewhereText: {
    fontSize: 14,
  },
});
