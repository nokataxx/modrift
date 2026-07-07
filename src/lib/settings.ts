import AsyncStorage from '@react-native-async-storage/async-storage';

import { STYLE_THEME_KEYS, type StyleThemeKey } from '@/theme';

const STORAGE_KEY = 'modrift:settings';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type FontSizeKey = 'small' | 'medium' | 'large';

export interface Settings {
  appearance: AppearanceMode;
  fontSize: FontSizeKey;
  styleTheme: StyleThemeKey;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  fontSize: 'medium',
  styleTheme: 'navy',
};

const APPEARANCE_VALUES: readonly AppearanceMode[] = ['system', 'light', 'dark'];
const FONT_SIZE_VALUES: readonly FontSizeKey[] = ['small', 'medium', 'large'];

// Base body font size (pt) per preset. Heading / code sizes derive from this so
// the whole document scales proportionally (see viewer's markdownStyle).
export const FONT_SIZE_BASE: Record<FontSizeKey, number> = {
  small: 15,
  medium: 17,
  large: 19,
};

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    APPEARANCE_VALUES.includes(v.appearance as AppearanceMode) &&
    FONT_SIZE_VALUES.includes(v.fontSize as FontSizeKey) &&
    STYLE_THEME_KEYS.includes(v.styleTheme as StyleThemeKey)
  );
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Merge over defaults so a partial or older-shaped stored value still
    // resolves to a complete, valid Settings object.
    const merged = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as object) };
    return isSettings(merged) ? merged : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal: settings persistence is best-effort.
  }
}
