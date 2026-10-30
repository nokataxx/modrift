import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppearanceMode,
  type FontSizeKey,
  type Settings,
} from '@/lib/settings';
import { type StyleThemeKey } from '@/theme';

interface SettingsContextValue {
  settings: Settings;
  /** False until the persisted settings have loaded (defaults apply meanwhile). */
  ready: boolean;
  setAppearance: (mode: AppearanceMode) => void;
  setFontSize: (size: FontSizeKey) => void;
  setStyleTheme: (key: StyleThemeKey) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      ready,
      setAppearance: (appearance) => update({ appearance }),
      setFontSize: (fontSize) => update({ fontSize }),
      setStyleTheme: (styleTheme) => update({ styleTheme }),
    }),
    [settings, ready, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
