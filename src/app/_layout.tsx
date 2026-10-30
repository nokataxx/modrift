import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/i18n';
import { SettingsProvider } from '@/hooks/use-settings';
import { useResolvedColorScheme } from '@/hooks/use-theme';
import { lockPortraitOnPhone } from '@/lib/orientation';

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
    // FR-07: the phone starts (and stays) portrait; only the viewer opts into
    // landscape. Info.plist allows every orientation, so without this lock the
    // list screens would rotate too. No-op on iPad, which keeps all four.
    lockPortraitOnPhone();
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
