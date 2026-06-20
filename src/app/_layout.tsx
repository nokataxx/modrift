import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/i18n';
import { SettingsProvider } from '@/hooks/use-settings';
import { useResolvedColorScheme } from '@/hooks/use-theme';
import IcloudContainerModule from '@modules/icloud-container';

export const unstable_settings = {
  initialRouteName: 'index',
};

function ThemedStack() {
  // Follows the user's appearance setting (system / light / dark) so the
  // navigation chrome matches the in-app theme.
  const scheme = useResolvedColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          // Hide the parent screen's title next to the back arrow — iOS
          // otherwise shows "< Recent Files" or just "<" depending on
          // header width and we want the chevron alone every time.
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Touch the iCloud ubiquity container on startup so iOS creates the user-visible
    // "Modrift" folder under iCloud Drive (NSUbiquitousContainerIsDocumentScopePublic).
    // Without this the folder only appears the first time the user performs a copy.
    IcloudContainerModule.getContainerDocumentsURL().catch(() => {
      // Non-fatal: copy flow handles unavailability with its own error path.
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SettingsProvider>
        <ThemedStack />
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
