import AsyncStorage from '@react-native-async-storage/async-storage';

import { STYLE_THEME_KEYS, type StyleThemeKey } from '@/theme';

const STORAGE_KEY = 'modrift:settings';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type FontSizeKey = 'small' | 'medium' | 'large';
// FR-31: where the home folder lives — the app's iCloud container (iCloud ›
// Modrift, default) or an on-device folder (On My iPhone › Modrift). Switching
// only changes which folder is listed / written to; it never moves files.
export type HomeLocation = 'icloud' | 'local';

export interface Settings {
  appearance: AppearanceMode;
  fontSize: FontSizeKey;
  styleTheme: StyleThemeKey;
  // FR-31 home storage location.
  homeLocation: HomeLocation;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  fontSize: 'medium',
  styleTheme: 'navy',
  homeLocation: 'icloud',
};

const APPEARANCE_VALUES: readonly AppearanceMode[] = ['system', 'light', 'dark'];
const FONT_SIZE_VALUES: readonly FontSizeKey[] = ['small', 'medium', 'large'];
const HOME_LOCATION_VALUES: readonly HomeLocation[] = ['icloud', 'local'];

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
    STYLE_THEME_KEYS.includes(v.styleTheme as StyleThemeKey) &&
    HOME_LOCATION_VALUES.includes(v.homeLocation as HomeLocation)
  );
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Merge over defaults so a partial or older-shaped stored value (e.g. one
    // that still carries the removed FR-28 editEnabled flag) still resolves to a
    // complete, valid Settings object; unknown keys are ignored by isSettings.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!isSettings(merged)) return DEFAULT_SETTINGS;
    return merged;
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
