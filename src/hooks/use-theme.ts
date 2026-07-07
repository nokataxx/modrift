/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, StyleThemes } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/hooks/use-settings';

/**
 * Resolves the effective color scheme from the user's appearance setting:
 * 'system' follows the OS, 'light'/'dark' force a fixed scheme (FR-09).
 */
export function useResolvedColorScheme(): 'light' | 'dark' {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  if (settings.appearance === 'light') return 'light';
  if (settings.appearance === 'dark') return 'dark';
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const scheme = useResolvedColorScheme();
  const { settings } = useSettings();
  // FR-25: overlay the chosen style preset (heading1–4 + accent) onto the base
  // scheme colors. `accent` drives reading-surface links / checkboxes.
  const palette = (StyleThemes[settings.styleTheme] ?? StyleThemes.navy)[scheme];
  return { ...Colors[scheme], ...palette };
}
