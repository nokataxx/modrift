import AsyncStorage from '@react-native-async-storage/async-storage';

import { hasRecentFiles } from '@/lib/recent-files';
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
  // FR-28 edit opt-in. While false, Modrift is a pure viewer: the edit-mode /
  // copy-to-iCloud buttons, new-note creation and task-checkbox toggling are
  // all hidden or inert, and no code path modifies a file.
  editEnabled: boolean;
  // FR-31 home storage location.
  homeLocation: HomeLocation;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  fontSize: 'medium',
  styleTheme: 'navy',
  editEnabled: false,
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
    typeof v.editEnabled === 'boolean' &&
    HOME_LOCATION_VALUES.includes(v.homeLocation as HomeLocation)
  );
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First load with nothing stored. FR-28 migration: users who predate the
      // edit opt-in keep editing ON. Settings are only persisted once changed,
      // so the trace of prior use is the recent-file history. The resolved
      // value is persisted immediately — otherwise a fresh (OFF) install would
      // flip to ON on its next launch, once it has opened a few files.
      const migrated = {
        ...DEFAULT_SETTINGS,
        editEnabled: await hasRecentFiles(),
      };
      saveSettings(migrated);
      return migrated;
    }
    // Merge over defaults so a partial or older-shaped stored value still
    // resolves to a complete, valid Settings object.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // FR-28 migration: stored settings without the flag are from pre-v1.3 —
    // an existing user, so editing stays ON for them.
    const legacy = typeof parsed.editEnabled !== 'boolean';
    const merged = { ...DEFAULT_SETTINGS, ...parsed, ...(legacy ? { editEnabled: true } : null) };
    if (!isSettings(merged)) return DEFAULT_SETTINGS;
    if (legacy) saveSettings(merged);
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
