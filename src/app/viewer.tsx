import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function replaceLocalImages(md: string, placeholder: (filename: string) => string): string {
  return md.replace(IMAGE_RE, (match, _alt, url) => {
    if (url.startsWith('https://')) return match;
    const filename = url.split('/').pop() || url;
    return placeholder(filename);
  });
}

export default function ViewerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { fileUri, fileName } = useLocalSearchParams<{ fileUri: string; fileName: string }>();

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = new File(fileUri);
        const text = await file.text();
        const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
        if (!cancelled) setContent(normalized);
      } catch {
        if (!cancelled) setError(t('picker.errorReadFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri, t]);

  const processedMarkdown = useMemo(() => {
    if (content === null) return null;
    return replaceLocalImages(content, (filename) =>
      t('screens.viewer.imagePlaceholder', { filename }),
    );
  }, [content, t]);

  const markdownStyle: MarkdownStyle = useMemo(
    () => ({
      paragraph: { color: theme.text },
      h1: { color: theme.text },
      h2: { color: theme.text },
      h3: { color: theme.text },
      h4: { color: theme.text },
      h5: { color: theme.text },
      h6: { color: theme.text },
      strong: { color: theme.text },
      emphasis: { color: theme.text },
      unorderedList: { color: theme.text },
      orderedList: { color: theme.text },
      blockquote: { color: theme.text, borderColor: theme.textSecondary },
      codeBlock: { color: theme.text, backgroundColor: theme.backgroundElement },
    }),
    [theme],
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: fileName ?? '' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {error ? (
          <ThemedText themeColor="textSecondary">{error}</ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <EnrichedMarkdownText
              key={fileUri}
              markdown={processedMarkdown ?? ''}
              flavor="github"
              markdownStyle={markdownStyle}
              selectable
            />
            {processedMarkdown === null && (
              <ThemedText themeColor="textSecondary" style={styles.loading}>
                {t('screens.viewer.loading')}
              </ThemedText>
            )}
          </ScrollView>
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
    paddingTop: Spacing.three,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  loading: {
    marginTop: Spacing.three,
  },
});
