import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt'] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

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
      params: { fileUri: asset.uri, fileName: asset.name },
    });
  };

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
          onPress={handleOpen}>
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
