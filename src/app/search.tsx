import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import {
  findMatches,
  loadSearchableFiles,
  type SearchableFile,
  type SearchMatch,
} from '@/lib/search';
import { MaxContentWidth, Spacing } from '@/theme';

type Section = { file: SearchableFile; fileIndex: number; data: SearchMatch[] };

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();

  const [files, setFiles] = useState<SearchableFile[] | null>(null);
  const [query, setQuery] = useState('');
  // Debounced query — reading is done once at mount, so this only re-runs the
  // in-memory match scan, but debouncing still avoids work on every keystroke.
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    loadSearchableFiles(settings.homeLocation).then((loaded) => {
      if (!cancelled) setFiles(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.homeLocation]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(id);
  }, [query]);

  const { sections, total, truncated } = useMemo(() => {
    if (files === null || debounced.trim() === '') {
      return { sections: [] as Section[], total: 0, truncated: false };
    }
    const result = findMatches(files, debounced);
    // Matches come out file-then-position ordered, so group runs of the same
    // fileIndex into contiguous sections without re-sorting.
    const grouped: Section[] = [];
    for (const m of result.matches) {
      const last = grouped[grouped.length - 1];
      if (last && last.fileIndex === m.fileIndex) {
        last.data.push(m);
      } else {
        grouped.push({ file: files[m.fileIndex], fileIndex: m.fileIndex, data: [m] });
      }
    }
    return { sections: grouped, total: result.matches.length, truncated: result.truncated };
  }, [files, debounced]);

  const openMatch = (file: SearchableFile, match: SearchMatch) => {
    router.push({
      pathname: '/viewer',
      params: {
        fileUri: file.uri,
        fileName: file.name,
        source: 'history',
        matchFrom: String(match.from),
        matchTo: String(match.to),
      },
    });
  };

  const hasQuery = debounced.trim() !== '';
  const loading = files === null;
  const showEmpty = !loading && hasQuery && total === 0;
  const showHint = !loading && !hasQuery;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('screens.search.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {/* FR-16: cap width and centre on iPad / large screens (no-op on phones). */}
        <View style={styles.content}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView
            name="magnifyingglass"
            size={17}
            weight="regular"
            tintColor={theme.textSecondary}
          />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t('screens.search.placeholder')}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[styles.input, { color: theme.text }]}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        ) : showHint ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('screens.search.hint')}
          </ThemedText>
        ) : showEmpty ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('screens.search.noResults')}
          </ThemedText>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item, i) => `${item.fileIndex}:${item.from}:${i}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={
              truncated ? (
                <ThemedText themeColor="textSecondary" style={styles.truncated}>
                  {t('screens.search.truncated')}
                </ThemedText>
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
                <ThemedText numberOfLines={1} style={styles.sectionName}>
                  {section.file.name}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sectionCount}>
                  {section.data.length}
                </ThemedText>
              </View>
            )}
            renderItem={({ item, section }) => (
              <Pressable
                onPress={() => openMatch(section.file, item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.background },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText themeColor="textSecondary" style={styles.lineNo}>
                  {item.line}
                </ThemedText>
                <ThemedText numberOfLines={2} style={styles.snippet}>
                  {item.before}
                  <Text style={[styles.matchText, { color: theme.tint }]}>{item.matchText}</Text>
                  {item.after}
                </ThemedText>
              </Pressable>
            )}
            renderSectionFooter={() => <View style={styles.sectionGap} />}
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
    paddingTop: Spacing.three,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 17,
    padding: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  truncated: {
    fontSize: 12,
    marginBottom: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  sectionName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 13,
  },
  sectionCount: {
    fontSize: 13,
  },
  sectionGap: {
    height: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  lineNo: {
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    minWidth: 28,
    textAlign: 'right',
  },
  snippet: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  matchText: {
    fontWeight: '700',
  },
});
