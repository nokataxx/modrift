import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/theme';

export default function ViewerScreen() {
  const { t } = useTranslation();
  const { fileUri, fileName } = useLocalSearchParams<{ fileUri: string; fileName: string }>();

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = new File(fileUri);
        const text = await file.text();
        if (!cancelled) setContent(text);
      } catch {
        if (!cancelled) setError(t('picker.errorReadFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri, t]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: fileName ?? '' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {error ? (
          <ThemedText themeColor="textSecondary">{error}</ThemedText>
        ) : content === null ? (
          <ThemedText themeColor="textSecondary">{t('screens.viewer.loading')}</ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ThemedText type="small">{content}</ThemedText>
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
});
