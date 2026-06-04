import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/build/react-navigation/elements';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { isIcloudCopyLocation, isInPlaceEditable } from '@/lib/file-location';
import {
  createIcloudCopy,
  IcloudUnavailableError,
} from '@/lib/icloud-copy';
import { recordRecentFile } from '@/lib/recent-files';
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
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { fileUri, fileName, initialMode } = useLocalSearchParams<{
    fileUri: string;
    fileName: string;
    initialMode?: string;
  }>();

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode === 'edit' ? 'edit' : 'preview');
  const [copying, setCopying] = useState(false);

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
        if (cancelled) return;
        setContent(normalized);
        recordRecentFile({ uri: fileUri, name: fileName ?? '' }).catch(() => {
          // Non-fatal: history is for display only.
        });
      } catch {
        if (!cancelled) setError(t('picker.errorReadFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri, fileName, t]);

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

  const performCopy = useCallback(async () => {
    if (content === null) return;
    setCopying(true);
    try {
      const result = await createIcloudCopy(content, fileName ?? 'note.md');
      router.replace({
        pathname: '/viewer',
        params: { fileUri: result.uri, fileName: result.name, initialMode: 'edit' },
      });
    } catch (err) {
      const message =
        err instanceof IcloudUnavailableError
          ? t('screens.viewer.copyToIcloudErrorIcloudUnavailable')
          : t('screens.viewer.copyToIcloudErrorFailed');
      Alert.alert(t('screens.viewer.copyToIcloudErrorTitle'), message);
      setCopying(false);
    }
  }, [content, fileName, router, t]);

  const handleCopyToIcloud = useCallback(() => {
    if (content === null || copying) return;
    Alert.alert(
      t('screens.viewer.copyToIcloudDialogTitle'),
      t('screens.viewer.copyToIcloudDialogMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.viewer.copyToIcloudDialogConfirm'),
          onPress: () => performCopy(),
        },
      ],
    );
  }, [content, copying, performCopy, t]);

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
      em: { color: theme.text },
      list: {
        color: theme.text,
        bulletColor: theme.text,
        markerColor: theme.text,
        // The library has no per-item margin; widening lineHeight is how we
        // give consecutive list items vertical breathing room.
        lineHeight: 28,
      },
      blockquote: { color: theme.text, borderColor: theme.textSecondary },
      code: { color: theme.text, backgroundColor: theme.backgroundElement },
      codeBlock: { color: theme.text, backgroundColor: theme.backgroundElement },
      table: {
        color: theme.text,
        headerTextColor: theme.text,
        headerBackgroundColor: theme.backgroundElement,
        rowEvenBackgroundColor: theme.background,
        rowOddBackgroundColor: theme.backgroundElement,
        borderColor: theme.textSecondary,
      },
    }),
    [theme],
  );

  const editable = isInPlaceEditable(fileUri);
  const loaded = content !== null && !error;
  const canToggle = loaded && editable;
  const showCopyButton = loaded && !editable;
  const showIcloudCopyBanner = loaded && mode === 'edit' && isIcloudCopyLocation(fileUri);
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
            : showCopyButton
              ? () => (
                  <Pressable
                    onPress={handleCopyToIcloud}
                    hitSlop={8}
                    disabled={copying}>
                    <ThemedText type="link">
                      {t('screens.viewer.copyToIcloudButton')}
                    </ThemedText>
                  </Pressable>
                )
              : undefined,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {showIcloudCopyBanner && (
          <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor="textSecondary" style={styles.bannerText}>
              {t('screens.viewer.icloudCopyBanner')}
            </ThemedText>
          </View>
        )}
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
  banner: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
  bannerText: {
    fontSize: 13,
    textAlign: 'center',
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
