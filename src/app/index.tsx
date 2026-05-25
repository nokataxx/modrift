import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('screens.recentFiles.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {t('screens.recentFiles.empty')}
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.openButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            // TODO: launch document picker (FR-01)
          }}>
          <ThemedText type="default">{t('picker.open')}</ThemedText>
        </Pressable>
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
  openButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
