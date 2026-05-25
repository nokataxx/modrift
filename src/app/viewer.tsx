import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/build/react-navigation/elements';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Fonts, Spacing } from '@/theme';

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function replaceLocalImages(md: string, placeholder: (filename: string) => string): string {
  return md.replace(IMAGE_RE, (match, _alt, url) => {
    if (url.startsWith('https://')) return match;
    const filename = url.split('/').pop() || url;
    return placeholder(filename);
  });
}

type Mode = 'preview' | 'edit';

export default function ViewerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { fileUri, fileName } = useLocalSearchParams<{ fileUri: string; fileName: string }>();

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('preview');

  const contentRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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

  const saveNow = useCallback(() => {
    if (!isDirtyRef.current || contentRef.current === null) return;
    try {
      new File(fileUri).write(contentRef.current);
      isDirtyRef.current = false;
    } catch {
      // Silent per FR-04. Next edit will retry.
    }
  }, [fileUri]);

  const handleEdit = useCallback(
    (next: string) => {
      setContent(next);
      isDirtyRef.current = true;
      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
      }
      pendingTimeoutRef.current = setTimeout(() => {
        pendingTimeoutRef.current = null;
        saveNow();
      }, 3000);
    },
    [saveNow],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (pendingTimeoutRef.current !== null) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
        saveNow();
      }
    });
    return () => subscription.remove();
  }, [saveNow]);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current !== null) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      saveNow();
    };
  }, [saveNow]);

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

  const canToggle = content !== null && !error;
  const toggleLabel =
    mode === 'preview' ? t('screens.viewer.edit') : t('screens.viewer.preview');

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: fileName ?? '',
          headerRight: canToggle
            ? () => (
                <Pressable
                  onPress={() => setMode((m) => (m === 'preview' ? 'edit' : 'preview'))}
                  hitSlop={8}>
                  <ThemedText type="link">{toggleLabel}</ThemedText>
                </Pressable>
              )
            : undefined,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {error ? (
          <ThemedText themeColor="textSecondary">{error}</ThemedText>
        ) : mode === 'edit' ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={headerHeight}>
            <TextInput
              multiline
              autoFocus
              value={content ?? ''}
              onChangeText={handleEdit}
              style={[styles.editor, { color: theme.text }]}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </KeyboardAvoidingView>
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
  flex: {
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
  editor: {
    flex: 1,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 22,
  },
});
