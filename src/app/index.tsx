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
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { type CloudNames, loadCloudNames } from '@/lib/cloud-names';
import {
  classifyFileLocation,
  externalContainerKey,
  shortContainerTag,
  type FileLocationKind,
} from '@/lib/file-location';
import { deleteIcloudCopy } from '@/lib/icloud-copy';
import {
  loadRecentFiles,
  normalizeUri,
  removeRecentFile,
  type RecentFile,
} from '@/lib/recent-files';
import { MaxContentWidth, Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

const LOCATION_KEY: Record<FileLocationKind, string> = {
  icloudCopy: 'screens.recentFiles.locationIcloudCopy',
  icloudDrive: 'screens.recentFiles.locationIcloudDrive',
  appSandbox: 'screens.recentFiles.locationAppSandbox',
  external: 'screens.recentFiles.locationExternal',
};

// The one swipe action ("remove from list") is non-destructive, so it uses a
// neutral gray. Red is reserved for the destructive file delete, which lives
// only in the long-press action sheet.
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
  // For iCloud Drive originals, append the containing folder as a breadcrumb
  // ("iCloud Drive › Notes") to match the "iCloud Drive › Modrift" copy label;
  // files at the iCloud Drive root fall back to the plain label.
  if (location.kind === 'icloudDrive' && location.folder) {
    return `${t(LOCATION_KEY.icloudDrive)} › ${location.folder}`;
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
// Swipe reveals one non-destructive action: "remove from list" (history only)
// for every row. Renaming a Modrift copy now happens by long-pressing the file
// name in the viewer header (FR-22), not on the swipe. The one destructive
// operation — deleting a Modrift-generated copy's file body — still lives behind
// a deliberate long-press action sheet so a quick swipe can't trigger it.
function RecentRow({
  item,
  cloudNames,
  onPress,
  onRemoveHistory,
  onDeleteFile,
}: {
  item: RecentFile;
  cloudNames: CloudNames;
  onPress: (item: RecentFile) => void;
  onRemoveHistory: (item: RecentFile) => void;
  onDeleteFile: (item: RecentFile) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);
  const openRef = useRef(false);
  // A gesture-handler Swipeable fires a phantom press on the underlying RN
  // Pressable when the swipe releases. Without this guard that press hits the
  // row's onPress and (seeing the row now open) immediately closes it — so the
  // revealed action never stays. Set on open-drag, this absorbs that one press.
  const swipingRef = useRef(false);
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
        swipingRef.current = true;
      }}
      onSwipeableOpen={() => {
        // Open settled — the phantom release-press (if any) has already been
        // absorbed by now, so clear the guard for genuine taps.
        swipingRef.current = false;
      }}
      onSwipeableClose={() => {
        openRef.current = false;
        swipingRef.current = false;
      }}
      renderRightActions={() => (
        <View style={styles.actions}>
          {/* History-only removal for every row — never touches the file. */}
          <Pressable style={styles.removeAction} onPress={() => onRemoveHistory(item)}>
            <ThemedText numberOfLines={2} style={styles.actionText}>
              {t('screens.recentFiles.removeFromListAction')}
            </ThemedText>
          </Pressable>
        </View>
      )}>
      <Pressable
        onPress={() => {
          // Absorb the phantom press that fires when the swipe releases, so
          // revealing the actions doesn't immediately close them.
          if (swipingRef.current) {
            swipingRef.current = false;
            return;
          }
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
  const { settings } = useSettings();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentFile[] | null>(null);
  const [cloudNames, setCloudNames] = useState<CloudNames>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([loadRecentFiles(), loadCloudNames()]).then(([items, names]) => {
        if (cancelled) return;
        // Heal stale entries: a Modrift iCloud copy whose file no longer
        // exists (deleted on exit as an emptied new note, or removed from
        // another device / the Files app) would be a dead tap — drop it from
        // the list and prune it from storage. Only our own copies are checked:
        // their existence is a cheap local stat, and iCloud reports evicted
        // files as existing, so a merely-offloaded file is never pruned.
        const dead = items.filter((item) => {
          if (classifyFileLocation(item.uri).kind !== 'icloudCopy') return false;
          try {
            return !new File(item.uri).exists;
          } catch {
            return false;
          }
        });
        for (const item of dead) removeRecentFile(item.uri).catch(() => {});
        setRecent(dead.length === 0 ? items : items.filter((item) => !dead.includes(item)));
        setCloudNames(names);
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
      params: { fileUri: asset.uri, fileName: asset.name, source: 'picker' },
    });
  };

  // FR-23 (reduced form): open a new note in edit mode WITHOUT creating a file
  // yet. The viewer creates it in iCloud › Modrift on the first keystroke, so a
  // mis-tap on "+" never leaves an empty note behind. The file will be an
  // icloudCopy, so history/in-place-editing/rename/delete (FR-22) apply once it
  // exists. Auto-named "Untitled" (deduped); the user renames later via swipe.
  const handleNewNote = useCallback(() => {
    router.push({
      pathname: '/viewer',
      params: {
        newNotePending: 'true',
        fileName: `${t('screens.recentFiles.untitledNote')}.md`,
        initialMode: 'edit',
      },
    });
  }, [router, t]);

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
          // FR-28: new-note creation is an editing entry point — hidden until
          // the edit opt-in is turned on in Settings.
          headerLeft: settings.editEnabled
            ? () => (
                <Pressable
                  onPress={handleNewNote}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('screens.recentFiles.newNote')}>
                  <SymbolView name="plus" size={24} weight="semibold" tintColor={theme.text} />
                </Pressable>
              )
            : undefined,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/search')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('screens.search.title')}>
                <SymbolView
                  name="magnifyingglass"
                  size={20}
                  weight="semibold"
                  tintColor={theme.text}
                />
              </Pressable>
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
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {/* FR-16: cap width and centre on iPad / large screens; a no-op on
            phones since the column is narrower than the cap. */}
        <View style={styles.content}>
          <NetworkBanner />
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
                  onRemoveHistory={handleRecentDelete}
                  onDeleteFile={handleDeleteFile}
                />
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
    paddingTop: Spacing.four,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  // Compact, fixed-width swipe action (iOS-style). A narrow button means the row
  // only slides a little on open, so the file name stays as visible as possible.
  removeAction: {
    backgroundColor: REMOVE_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    paddingHorizontal: Spacing.two,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
});
