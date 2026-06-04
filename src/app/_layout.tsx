import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import '@/i18n';
import IcloudContainerModule from '@modules/icloud-container';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Touch the iCloud ubiquity container on startup so iOS creates the user-visible
    // "Modrift" folder under iCloud Drive (NSUbiquitousContainerIsDocumentScopePublic).
    // Without this the folder only appears the first time the user performs a copy.
    IcloudContainerModule.getContainerDocumentsURL().catch(() => {
      // Non-fatal: copy flow handles unavailability with its own error path.
    });
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack />
    </ThemeProvider>
  );
}
