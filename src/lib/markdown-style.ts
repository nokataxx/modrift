import type { MarkdownStyle } from 'react-native-enriched-markdown';

import type { ThemeColor } from '@/theme';

type ThemeColors = Record<ThemeColor, string>;

/**
 * Builds the markdown render style from theme colors and a base body font size.
 * Heading / code sizes derive from `base` so the whole document scales together
 * (FR-10). Shared by the viewer and the settings live preview so they match.
 */
export function buildMarkdownStyle(theme: ThemeColors, base: number): MarkdownStyle {
  return {
    paragraph: { color: theme.text, fontSize: base, lineHeight: Math.round(base * 1.5) },
    h1: { color: theme.heading1, fontSize: Math.round(base * 1.75) },
    h2: { color: theme.heading2, fontSize: Math.round(base * 1.45) },
    h3: { color: theme.heading3, fontSize: Math.round(base * 1.25) },
    h4: { color: theme.heading4, fontSize: Math.round(base * 1.1) },
    // H5/H6 are rare in notes; reuse the most muted heading tone (heading4).
    h5: { color: theme.heading4, fontSize: base },
    h6: { color: theme.heading4, fontSize: Math.round(base * 0.95) },
    strong: { color: theme.text },
    em: { color: theme.text },
    list: {
      color: theme.text,
      bulletColor: theme.text,
      markerColor: theme.text,
      fontSize: base,
      // The library has no per-item margin; widening lineHeight is how we
      // give consecutive list items vertical breathing room.
      lineHeight: Math.round(base * 1.65),
    },
    blockquote: {
      color: theme.text,
      fontSize: base,
      borderColor: theme.textSecondary,
      // Without an explicit background the library's default fill renders the
      // quote text unreadable (looked inverted). Pin it to the element tint.
      backgroundColor: theme.backgroundElement,
    },
    link: { color: theme.tint, underline: true },
    // The library defaults the rule to #E5E7EB (near-white), which disappears on
    // a light background. Use the same divider tone as table/blockquote borders.
    thematicBreak: { color: theme.textSecondary },
    code: {
      color: theme.text,
      fontSize: Math.round(base * 0.9),
      backgroundColor: theme.backgroundElement,
      // Drop the default outline so inline code reads as a tint, not a box.
      borderColor: 'transparent',
    },
    codeBlock: {
      color: theme.text,
      fontSize: Math.round(base * 0.9),
      backgroundColor: theme.backgroundElement,
    },
    table: {
      color: theme.text,
      fontSize: base,
      headerTextColor: theme.text,
      headerBackgroundColor: theme.background,
      rowEvenBackgroundColor: theme.background,
      rowOddBackgroundColor: theme.background,
      borderColor: theme.textSecondary,
    },
    taskList: {
      // The library defaults checkedTextColor to #000000, which vanishes on a
      // dark background. Pin every color to the theme so checked text keeps the
      // normal body color (no strikethrough) in both light and dark modes.
      checkedColor: theme.tint,
      checkmarkColor: theme.background,
      checkedTextColor: theme.text,
      borderColor: theme.textSecondary,
      checkedStrikethrough: false,
    },
  };
}
