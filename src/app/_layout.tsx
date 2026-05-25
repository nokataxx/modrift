import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import '@/i18n';

const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt'] as const;

function useOpenInHandler() {
  const router = useRouter();

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url || !url.startsWith('file://')) return;
      const fileName = decodeURIComponent(url.split('/').pop() ?? 'file');
      const lower = fileName.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return;
      router.push({ pathname: '/viewer', params: { fileUri: url, fileName } });
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [router]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useOpenInHandler();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack />
    </ThemeProvider>
  );
}
