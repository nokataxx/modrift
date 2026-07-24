import { MenuView } from '@react-native-menu/menu';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
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
  isHomeFile,
  shortContainerTag,
  type FileLocationKind,
} from '@/lib/file-location';
import { type HomeFile, listHomeFiles } from '@/lib/home-files';
import {
  deleteIcloudCopy,
  duplicateIcloudCopy,
  NameInUseError,
  renameIcloudCopy,
} from '@/lib/icloud-copy';
import {
  clearRecentFiles,
  loadRecentFiles,
  normalizeUri,
  removeRecentFile,
  renameRecentFile,
  sameFileKey,
  type RecentFile,
} from '@/lib/recent-files';
import { MaxContentWidth, Spacing } from '@/theme';
import FileBookmarkModule from '@modules/file-bookmark';

const LOCATION_KEY: Record<FileLocationKind, string> = {
  icloudCopy: 'screens.recentFiles.locationIcloudCopy',
  localHome: 'screens.recentFiles.locationLocalHome',
  icloudDrive: 'screens.recentFiles.locationIcloudDrive',
  appSandbox: 'screens.recentFiles.locationAppSandbox',
  external: 'screens.recentFiles.locationExternal',
};

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

// Subtitle for a history row. Home files (iCloud › Modrift or the on-device home)
// are the default workspace, so spelling out their location on every row is
// noise; instead we show "<modified date> · マイファイル" — the date is the
// useful bit and "マイファイル" keeps the two-line layout while still marking the
// file as living in the home (vs an external source). Non-home files keep the
// full location label, which is the provenance cue (FR-06) that lets the user
// tell same-named files from different clouds apart.
function recentSubtitle(
  file: RecentFile,
  modifiedAt: number | null,
  t: (key: string) => string,
  cloudNames: CloudNames,
  language: string,
): string {
  if (isHomeFile(file.uri)) {
    const date = formatModifiedDate(modifiedAt, language);
    const label = t('screens.recentFiles.tabMyFiles');
    return [date, label].filter(Boolean).join(' · ');
  }
  return locationLabel(file, t, cloudNames);
}

// Mirrors the public.plain-text UTI we declare in CFBundleDocumentTypes so the
// in-app picker accepts the same file shapes the Files App "Modrift で開く"
// path already does — notably .text, which iCloud sometimes assigns to plain
// text files instead of .txt.
const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt', '.text'] as const;

// A file-type icon shown at the left of each list row. Distinction is carried by
// the glyph SHAPE (not colour) — every icon uses the same neutral tint. There
// are no dedicated SF Symbols for PDF/Word/Excel, so each type maps to a clearly
// different doc-family shape (lined page / formatted page / solid page / grid).
// Covers the v2 formats (PDF/xlsx/docx, view-only then) as well as today's md.
type FileKind = 'markdown' | 'pdf' | 'sheet' | 'word' | 'other';

function fileKind(name: string): FileKind {
  const lower = name.toLowerCase();
  if (/\.(md|markdown|txt|text)$/.test(lower)) return 'markdown';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(xls|xlsx|csv)$/.test(lower)) return 'sheet';
  if (/\.(doc|docx)$/.test(lower)) return 'word';
  return 'other';
}

const FILE_ICON: Record<FileKind, SymbolViewProps['name']> = {
  markdown: 'doc.text', // page with text lines
  pdf: 'doc.fill', // solid page — a rendered/final document
  sheet: 'tablecells', // grid — spreadsheet
  word: 'doc.richtext', // page with a formatted header block — rich text
  other: 'doc', // blank page
};

function FileIcon({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <SymbolView
      name={FILE_ICON[fileKind(name)]}
      size={22}
      weight="regular"
      tintColor={theme.text}
      style={styles.rowIcon}
    />
  );
}

// One history row. Tap opens the file; long-press opens an action sheet with a
// single, non-destructive "remove from list" action — unified with the My Files
// long-press UX (FR-32) so both lists behave the same way (no swipe). History
// never deletes the file itself: file deletion lives in My Files, where the home
// files actually reside.
function RecentRow({
  item,
  cloudNames,
  modifiedAt,
  onPress,
  onRemoveHistory,
}: {
  item: RecentFile;
  cloudNames: CloudNames;
  // Modification time (epoch ms) for a home file, statted in the focus effect;
  // null for non-home files or when the fs reported none. See recentSubtitle.
  modifiedAt: number | null;
  onPress: (item: RecentFile) => void;
  onRemoveHistory: (item: RecentFile) => void;
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
        if (index === 0) onRemoveHistory(item);
      },
    );
  };

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.background },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <FileIcon name={item.name} />
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.rowSubtitle}>
          {recentSubtitle(item, modifiedAt, t, cloudNames, i18n.language)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

// Format a home file's modification time as a plain localized date, for the row
// subtitle. Empty string when the filesystem reported no mtime (sinks silently).
function formatModifiedDate(ms: number | null, language: string): string {
  if (ms === null) return '';
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

// A home-folder file row (FR-32 マイファイル). These files live in the home
// folder, so a tap opens straight into the (editable) viewer — no bookmark or
// security scope needed. The subtitle shows the modification date, styled like
// the history row's location subtitle so both lists read the same.
function MyFileRow({
  item,
  onPress,
  onLongPress,
}: {
  item: HomeFile;
  onPress: (item: HomeFile) => void;
  onLongPress: (item: HomeFile) => void;
}) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const date = formatModifiedDate(item.modifiedAt, i18n.language);
  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.background },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <FileIcon name={item.name} />
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{item.name}</ThemedText>
        {date !== '' && (
          <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.rowSubtitle}>
            {date}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentFile[] | null>(null);
  const [myFiles, setMyFiles] = useState<HomeFile[] | null>(null);
  // FR-32: the home shows two views — マイファイル (the home folder, a place)
  // and 最近見た (everything recently opened, a timeline). マイファイル leads,
  // since the redesign makes the home folder the default workspace.
  const [tab, setTab] = useState<'files' | 'recent'>('files');
  // My Files sort order: newest-modified first (default) or by file name.
  const [sortMode, setSortMode] = useState<'date' | 'name'>('date');
  const [cloudNames, setCloudNames] = useState<CloudNames>({});
  // Modified date per home file shown in 最近見た, keyed by uri. Statted in the
  // focus effect (cheap for the local/iCloud-container home files); non-home
  // files aren't statted and fall back to their location label.
  const [homeDates, setHomeDates] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([loadRecentFiles(), loadCloudNames(), listHomeFiles(settings.homeLocation)]).then(
        ([items, names, home]) => {
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
          const live = dead.length === 0 ? items : items.filter((item) => !dead.includes(item));
          // Read the modification date for each home file so its history row can
          // show "<date> · マイファイル" instead of the redundant home location.
          const dates: Record<string, number> = {};
          for (const item of live) {
            if (!isHomeFile(item.uri)) continue;
            try {
              const m = new File(item.uri).modificationTime;
              if (m != null) dates[item.uri] = m;
            } catch {
              // Unreadable (evicted / moved) — omit the date, keep the label.
            }
          }
          setRecent(live);
          setHomeDates(dates);
          setCloudNames(names);
          setMyFiles(home);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [settings.homeLocation]),
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

  // FR-32: open a home-folder file. It lives in our iCloud container, so it
  // opens by URI directly (in-place editable, no bookmark). source 'history'
  // routes it through the viewer's normal record path so it also surfaces under
  // 最近見た afterwards.
  const handleHomeFilePress = useCallback(
    (file: HomeFile) => {
      // A My Files listing can momentarily include a file with no substance —
      // e.g. one deleted on another device that iCloud hasn't finished removing.
      // Rather than open the viewer only for it to show a read error inside,
      // catch it here: tell the user with a dialog and drop the dead row from
      // the list. `exists` (not a read) keeps a valid-but-evicted file — which
      // reports exists=true and downloads on open — from being wrongly removed.
      let exists = false;
      try {
        exists = new File(file.uri).exists;
      } catch {
        exists = false;
      }
      if (!exists) {
        setMyFiles((prev) => (prev === null ? prev : prev.filter((f) => f.uri !== file.uri)));
        Alert.alert(
          t('screens.recentFiles.reopenFailedTitle'),
          t('screens.recentFiles.reopenFailedMessage'),
        );
        return;
      }
      router.push({
        pathname: '/viewer',
        params: { fileUri: file.uri, fileName: file.name, source: 'history' },
      });
    },
    [router, t],
  );

  const refreshMyFiles = useCallback(async () => {
    setMyFiles(await listHomeFiles(settings.homeLocation));
  }, [settings.homeLocation]);

  // Apply the chosen sort to the home listing. Date is newest-first (matching
  // the default listHomeFiles order); name is a natural, case-insensitive sort
  // so "file2" < "file10".
  const sortedMyFiles = useMemo(() => {
    if (myFiles === null) return null;
    const arr = [...myFiles];
    if (sortMode === 'name') {
      arr.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      );
    } else {
      arr.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
    }
    return arr;
  }, [myFiles, sortMode]);

  // FR-35: copy a home file in place ("… copy.md"). No history impact — a
  // duplicate only surfaces under 最近見た once the user actually opens it.
  const duplicateMyFile = useCallback(
    (file: HomeFile) => {
      try {
        duplicateIcloudCopy(file.uri);
      } catch {
        Alert.alert(
          t('screens.recentFiles.duplicateErrorTitle'),
          t('screens.recentFiles.duplicateErrorFailed'),
        );
        return;
      }
      refreshMyFiles();
    },
    [t, refreshMyFiles],
  );

  // FR-22: rename a home file. iOS-only Alert.prompt is fine (the app is
  // iOS-only). The current base name is pre-filled and the .md extension is
  // re-applied by renameIcloudCopy, so the user edits just the name.
  const promptRenameMyFile = useCallback(
    (file: HomeFile) => {
      const currentBase = file.name.replace(/\.md$/i, '');
      Alert.prompt(
        t('screens.recentFiles.renameTitle'),
        t('screens.recentFiles.renameMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.recentFiles.renameConfirm'),
            onPress: (value?: string) => {
              const next = (value ?? '').trim();
              if (!next) return;
              try {
                const result = renameIcloudCopy(file.uri, next);
                // Keep any 最近見た entry pointing at the new uri/name — both in
                // storage and in the list currently on screen. Updating storage
                // alone left the visible row showing the old name until the
                // screen happened to be re-focused. Mirrors renameRecentFile's
                // shape: the bookmark is dropped because it no longer resolves.
                renameRecentFile(file.uri, result).catch(() => {});
                const renamedKey = sameFileKey(file.uri);
                setRecent((prev) =>
                  prev === null
                    ? prev
                    : prev.map((r) =>
                        sameFileKey(r.uri) === renamedKey
                          ? { uri: result.uri, name: result.name, openedAt: r.openedAt }
                          : r,
                      ),
                );
              } catch (err) {
                Alert.alert(
                  t('screens.recentFiles.renameErrorTitle'),
                  err instanceof NameInUseError
                    ? t('screens.recentFiles.renameErrorInUse')
                    : t('screens.recentFiles.renameErrorFailed'),
                );
                return;
              }
              refreshMyFiles();
            },
          },
        ],
        'plain-text',
        currentBase,
      );
    },
    [t, refreshMyFiles],
  );

  // FR-22: delete a home file. Irreversible, so it goes behind an explicit
  // confirmation Alert with a destructive button, and also prunes the file from
  // 最近見た so no dead entry lingers there.
  const confirmDeleteMyFile = useCallback(
    (file: HomeFile) => {
      Alert.alert(
        t('screens.recentFiles.deleteFileTitle', { name: file.name }),
        t('screens.recentFiles.deleteFileMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.recentFiles.deleteFileAction'),
            style: 'destructive',
            onPress: () => {
              try {
                deleteIcloudCopy(file.uri);
              } catch {
                // Already gone externally — still prune history and refresh.
              }
              // Compare by sameFileKey, not raw string: history uris are stored
              // normalized (/private/var) and may differ in percent-encoding
              // from the uri Directory.list() reports, so a raw !== left the
              // deleted file sitting in 最近見た even though storage was pruned.
              const deletedKey = sameFileKey(file.uri);
              removeRecentFile(file.uri).catch(() => {});
              setRecent((prev) =>
                prev === null ? prev : prev.filter((r) => sameFileKey(r.uri) !== deletedKey),
              );
              refreshMyFiles();
            },
          },
        ],
      );
    },
    [t, refreshMyFiles],
  );

  // FR-22/FR-35: long-press a home file for its management actions. These are
  // file operations (not content editing), so they stay available regardless of
  // the FR-28 edit opt-in — consistent with RecentRow's delete.
  const handleMyFileLongPress = useCallback(
    (file: HomeFile) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: file.name,
          options: [
            t('screens.recentFiles.renameTitle'),
            t('screens.recentFiles.duplicateAction'),
            t('screens.recentFiles.deleteFileAction'),
            t('common.cancel'),
          ],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (index) => {
          if (index === 0) promptRenameMyFile(file);
          else if (index === 1) duplicateMyFile(file);
          else if (index === 2) confirmDeleteMyFile(file);
        },
      );
    },
    [t, promptRenameMyFile, duplicateMyFile, confirmDeleteMyFile],
  );

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

  // FR-32: remove a file from 最近見た. Non-destructive — the file itself is
  // untouched (delete lives in My Files). Reached via the RecentRow long-press.
  const handleRecentDelete = useCallback(async (item: RecentFile) => {
    setRecent((prev) => (prev === null ? prev : prev.filter((r) => r.uri !== item.uri)));
    await removeRecentFile(item.uri);
  }, []);

  // Clear the whole 最近見た list (from the 3-dot menu, Recent tab). Confirmed
  // first; only the history entries go — the files themselves are untouched.
  const handleClearHistory = () => {
    Alert.alert(
      t('screens.recentFiles.clearHistoryTitle'),
      t('screens.recentFiles.clearHistoryMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.recentFiles.clearHistoryConfirm'),
          style: 'destructive',
          onPress: () => {
            clearRecentFiles().catch(() => {});
            setRecent([]);
          },
        },
      ],
    );
  };

  const filesEmpty = myFiles !== null && myFiles.length === 0;
  const recentEmpty = recent !== null && recent.length === 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: t('app.name'),
          // FR-23 new-note creation (＋). Editing is always available in the
          // home-folder-centric model, so this is shown unconditionally.
          headerLeft: () => (
            <Pressable
              onPress={handleNewNote}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('screens.recentFiles.newNote')}>
              <SymbolView name="plus" size={24} weight="semibold" tintColor={theme.text} />
            </Pressable>
          ),
          // Search sits as its own icon (used often enough to warrant one tap),
          // beside the FR-33 ⋯ pull-down menu that holds the secondary entry
          // points (sort — My Files only, the system picker, and settings).
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/search')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('screens.search.title')}
                style={styles.headerIcon}>
                <SymbolView
                  name="magnifyingglass"
                  size={20}
                  weight="semibold"
                  tintColor={theme.text}
                />
              </Pressable>
              <MenuView
                title=""
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === 'open') handleOpen();
                  else if (nativeEvent.event === 'settings') router.push('/settings');
                  else if (nativeEvent.event === 'sort-date') setSortMode('date');
                  else if (nativeEvent.event === 'sort-name') setSortMode('name');
                  else if (nativeEvent.event === 'clear-history') handleClearHistory();
                }}
                // imageColor is REQUIRED on New Architecture: the Fabric path
                // always sends imageColor (defaulting to 0 = transparent) and the
                // native side tints the SF Symbol with it whenever the key
                // exists, so omitting it renders the icon fully transparent
                // (invisible). The theme text colour makes icons match labels.
                actions={[
                  // Sort submenu — only for My Files (the home listing); the
                  // 最近見た history has its own fixed newest-first order, so it's
                  // omitted there. The checkmark (state 'on') shows the order.
                  ...(tab === 'files'
                    ? [
                        {
                          id: 'sort',
                          title: t('screens.recentFiles.sortTitle'),
                          image: 'arrow.up.arrow.down',
                          imageColor: theme.text,
                          subactions: [
                            {
                              id: 'sort-date',
                              title: t('screens.recentFiles.sortByDate'),
                              state: (sortMode === 'date' ? 'on' : 'off') as 'on' | 'off',
                            },
                            {
                              id: 'sort-name',
                              title: t('screens.recentFiles.sortByName'),
                              state: (sortMode === 'name' ? 'on' : 'off') as 'on' | 'off',
                            },
                          ],
                        },
                      ]
                    : []),
                  // Clear-all — the 最近見た tab's context action, mirroring the
                  // sort submenu's top spot on My Files. Normal colour (not
                  // destructive red): it clears only the list, never the files.
                  // Shown only when there is history to clear; confirmation lives
                  // in handleClearHistory.
                  ...(tab === 'recent' && recent !== null && recent.length > 0
                    ? [
                        {
                          id: 'clear-history',
                          title: t('screens.recentFiles.clearHistoryAction'),
                          image: 'trash',
                          imageColor: theme.text,
                        },
                      ]
                    : []),
                  { id: 'open', title: t('picker.open'), image: 'folder', imageColor: theme.text },
                  {
                    id: 'settings',
                    title: t('screens.settings.title'),
                    image: 'gearshape',
                    imageColor: theme.text,
                  },
                ]}
                shouldOpenOnLongPress={false}>
                <View
                  accessibilityRole="button"
                  accessibilityLabel={t('screens.recentFiles.menu')}
                  style={styles.headerIcon}>
                  <SymbolView name="ellipsis" size={24} weight="semibold" tintColor={theme.text} />
                </View>
              </MenuView>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {/* FR-16: cap width and centre on iPad / large screens; a no-op on
            phones since the column is narrower than the cap. */}
        <View style={styles.content}>
          <NetworkBanner />
          {/* FR-32: two-view segmented control — マイファイル (place) / 最近見た
              (time). Kept in the body (not the nav bar) so it reads as content,
              and so the ＋ and ⋮ header actions stay uncrowded. */}
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {(['files', 'recent'] as const).map((key) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.segmentItem,
                    active && [
                      styles.segmentItemActive,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                    ],
                  ]}>
                  <ThemedText
                    themeColor={active ? 'tint' : 'textSecondary'}
                    style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t(
                      key === 'files'
                        ? 'screens.recentFiles.tabMyFiles'
                        : 'screens.recentFiles.tabRecent',
                    )}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {tab === 'files' ? (
            filesEmpty ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {t('screens.recentFiles.myFilesEmpty')}
              </ThemedText>
            ) : (
              <FlatList
                data={sortedMyFiles ?? []}
                keyExtractor={(item) => item.uri}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => (
                  <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
                )}
                renderItem={({ item }) => (
                  <MyFileRow
                    item={item}
                    onPress={handleHomeFilePress}
                    onLongPress={handleMyFileLongPress}
                  />
                )}
                style={styles.list}
              />
            )
          ) : recentEmpty ? (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {t('screens.recentFiles.recentEmpty')}
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
                  modifiedAt={homeDates[item.uri] ?? null}
                  onPress={handleRecentPress}
                  onRemoveHistory={handleRecentDelete}
                />
              )}
              style={styles.list}
            />
          )}
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
    flexDirection: 'row',
    // Align to the top so the icon lines up with the file-name row, not the
    // vertical centre of the name + date/location block.
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  // Fixed width so every row's file name starts at the same x regardless of
  // which type glyph precedes it. marginTop nudges the 22pt glyph to sit centred
  // on the 24pt file-name line.
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
  // iOS-style segmented control: a rounded track (backgroundElement) with the
  // active pill raised on the base background.
  segment: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: 2,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two - 2,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    // Transparent border on the inactive item so adding a border to the active
    // pill doesn't shift layout (same box size either way).
    borderColor: 'transparent',
  },
  // The active pill: raised off the track with a hairline border + soft shadow
  // so the selection reads clearly even where the pill/track contrast is low
  // (e.g. white pill on a near-white track in light mode).
  segmentItemActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  // Header-right row: the search icon beside the ⋯ menu.
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Generous, even padding around each header glyph so it sits centred with room
  // inside its (native, for the menu) highlight box rather than touching its
  // edges, and so both icons keep a comfortable tap target.
  headerIcon: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
