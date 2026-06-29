import { Directory } from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { loadVaultFolder } from '@/lib/vault-folder';
import { Spacing } from '@/theme';

// Only Markdown/plain-text files are openable; mirror the picker's accepted
// shapes (FR-01) so the browser shows the same set.
const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt', '.text'] as const;

function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

type Entry = { kind: 'dir' | 'file'; name: string; uri: string };

// List a folder's children: subfolders plus openable files, with dotfiles
// (e.g. Obsidian's .obsidian) hidden. Folders sort first, then alphabetical.
function listEntries(folderUri: string): Entry[] {
  const items = new Directory(folderUri).list();
  const entries: Entry[] = [];
  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    if (item instanceof Directory) {
      entries.push({ kind: 'dir', name: item.name, uri: item.uri });
    } else if (isSupportedFile(item.name)) {
      entries.push({ kind: 'file', name: item.name, uri: item.uri });
    }
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

// FR-24: browse the granted Vault folder in Modrift's own UI, without the
// system Document Picker. Subfolders push another instance of this screen
// (Files-app style), and files push the viewer. The folder's security scope is
// held app-wide via activateVaultScope (see _layout), so reads work at any depth.
export default function VaultScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { path, name } = useLocalSearchParams<{ path?: string; name?: string }>();

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);
  const [title, setTitle] = useState(name ?? '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Root entry (from home) may omit params; fall back to the stored Vault.
        let folderUri = path;
        let display = name;
        if (!folderUri) {
          const folder = await loadVaultFolder();
          if (!folder) {
            if (!cancelled) {
              setError(true);
              setEntries([]);
            }
            return;
          }
          folderUri = folder.uri;
          display = folder.name;
        }
        if (display && !cancelled) setTitle(display);
        const list = listEntries(folderUri);
        if (!cancelled) setEntries(list);
      } catch {
        if (!cancelled) {
          setError(true);
          setEntries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, name]);

  const handlePress = (entry: Entry) => {
    if (entry.kind === 'dir') {
      router.push({ pathname: '/vault', params: { path: entry.uri, name: entry.name } });
    } else {
      router.push({
        pathname: '/viewer',
        params: { fileUri: entry.uri, fileName: entry.name, source: 'vault' },
      });
    }
  };

  const isEmpty = entries !== null && entries.length === 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {error ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('screens.vault.unavailable')}
          </ThemedText>
        ) : isEmpty ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('screens.vault.empty')}
          </ThemedText>
        ) : (
          <FlatList
            data={entries ?? []}
            keyExtractor={(item) => item.uri}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePress(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.background },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}
                accessibilityRole="button">
                <SymbolView
                  name={item.kind === 'dir' ? 'folder.fill' : 'doc.text'}
                  size={20}
                  weight="regular"
                  tintColor={item.kind === 'dir' ? theme.tint : theme.textSecondary}
                />
                <ThemedText numberOfLines={1} style={styles.rowName}>
                  {item.name}
                </ThemedText>
                {item.kind === 'dir' ? (
                  <SymbolView
                    name="chevron.right"
                    size={14}
                    weight="semibold"
                    tintColor={theme.textSecondary}
                  />
                ) : null}
              </Pressable>
            )}
          />
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
  },
  listContent: {
    paddingBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  rowName: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  message: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
