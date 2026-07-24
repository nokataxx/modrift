/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tint: '#007AFF',
    // Destructive actions (iOS system red) — e.g. the bulk-delete button.
    danger: '#FF3B30',
    // Heading hierarchy: H1 pops in a navy accent, H2–H4 step down through
    // neutral tones (iOS-native feel). H5/H6 reuse heading4.
    heading1: '#1B3A6B',
    heading2: '#34527E',
    heading3: '#3A3A3C',
    heading4: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#0A84FF',
    danger: '#FF453A',
    heading1: '#7E9ED6',
    heading2: '#9DB4E0',
    heading3: '#C7CAD1',
    heading4: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// FR-25: document style presets. The user picks one in Settings; each preset
// swaps the reading surface's heading1–4 tokens plus an `accent` that drives
// links and task checkboxes. Body / app-chrome colors are untouched. Kept as a
// plain value table per scheme so new presets are trivial to add.
export type StylePalette = {
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  /** Links and task checkboxes in the reading surface. */
  accent: string;
  /** Greyscale code-block syntax highlighting (set on monochrome presets). */
  codeMono?: boolean;
};

export type StyleThemeKey = 'navy' | 'mono' | 'colorful';

export const STYLE_THEME_KEYS: readonly StyleThemeKey[] = ['navy', 'mono', 'colorful'];

export const StyleThemes: Record<StyleThemeKey, { light: StylePalette; dark: StylePalette }> = {
  // 'navy' matches the base Colors above (classic iOS-blue accent) — the default.
  navy: {
    light: {
      heading1: '#1B3A6B',
      heading2: '#34527E',
      heading3: '#3A3A3C',
      heading4: '#60646C',
      accent: '#007AFF',
    },
    dark: {
      heading1: '#7E9ED6',
      heading2: '#9DB4E0',
      heading3: '#C7CAD1',
      heading4: '#B0B4BA',
      accent: '#0A84FF',
    },
  },
  // Monochrome: headings differ by weight / size only; accent is a restrained
  // neutral so links rely on their underline (truly color-free document).
  mono: {
    light: {
      heading1: '#1C1C1E',
      heading2: '#2C2C2E',
      heading3: '#3A3A3C',
      heading4: '#60646C',
      accent: '#3A3A3C',
      codeMono: true,
    },
    dark: {
      heading1: '#F2F2F7',
      heading2: '#D8DADE',
      heading3: '#C7CAD1',
      heading4: '#B0B4BA',
      accent: '#C7CAD1',
      codeMono: true,
    },
  },
  // Colorful: a distinct hue per heading level plus a lively teal accent that
  // stays clear of the warm headings.
  colorful: {
    light: {
      heading1: '#B3306B',
      heading2: '#1F7A4D',
      heading3: '#B5651D',
      heading4: '#3A6EA5',
      accent: '#0E7C86',
    },
    dark: {
      heading1: '#FF7EB0',
      heading2: '#4FD08A',
      heading3: '#E0A458',
      heading4: '#6FA8E6',
      accent: '#37C2CE',
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
