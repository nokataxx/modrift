import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { buildMarkdownStyle } from '@/lib/markdown-style';
import { FONT_SIZE_BASE, type AppearanceMode, type FontSizeKey } from '@/lib/settings';
import { Spacing } from '@/theme';

type Theme = ReturnType<typeof useTheme>;

const APPEARANCE_OPTIONS: AppearanceMode[] = ['system', 'light', 'dark'];
const FONT_SIZE_OPTIONS: FontSizeKey[] = ['small', 'medium', 'large'];

// Fixed mini-mockup colors per mode (a light swatch is always light, etc.) so
// each card previews the theme it switches to, independent of the current one.
const SWATCH = {
  light: { bg: '#FFFFFF', heading: '#1B3A6B', body: '#9AA0A6' },
  dark: { bg: '#000000', heading: '#7E9ED6', body: '#5A5E66' },
} as const;

function MiniPanel({ bg, heading, body }: { bg: string; heading: string; body: string }) {
  return (
    <View style={[styles.swatchPanel, { backgroundColor: bg }]}>
      <View style={[styles.barHeading, { backgroundColor: heading }]} />
      <View style={[styles.barBody, { backgroundColor: body }]} />
      <View style={[styles.barBodyShort, { backgroundColor: body }]} />
    </View>
  );
}

function ThemeSwatch({ kind }: { kind: AppearanceMode }) {
  if (kind === 'light') return <MiniPanel {...SWATCH.light} />;
  if (kind === 'dark') return <MiniPanel {...SWATCH.dark} />;
  // 'system': split — light on the left half, dark on the right.
  return (
    <View style={styles.swatchSplit}>
      <View style={styles.swatchHalf}>
        <MiniPanel {...SWATCH.light} />
      </View>
      <View style={styles.swatchHalf}>
        <MiniPanel {...SWATCH.dark} />
      </View>
    </View>
  );
}

function AppearanceCard({
  kind,
  label,
  selected,
  onPress,
  theme,
}: {
  kind: AppearanceMode;
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View style={[styles.swatchRing, { borderColor: selected ? theme.tint : 'transparent' }]}>
        <View style={[styles.swatchOuter, { borderColor: theme.backgroundElement }]}>
          <ThemeSwatch kind={kind} />
        </View>
      </View>
      <ThemedText style={[styles.cardLabel, selected && { color: theme.tint }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings, setAppearance, setFontSize } = useSettings();
  const base = FONT_SIZE_BASE[settings.fontSize];

  const previewStyle = useMemo(() => buildMarkdownStyle(theme, base), [theme, base]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('screens.settings.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Live preview — reflects appearance + font size in real time. */}
          <View
            style={[
              styles.previewCard,
              { backgroundColor: theme.background, borderColor: theme.backgroundElement },
            ]}>
            <EnrichedMarkdownText
              // Remount on setting change so the preview always reflects the
              // latest appearance / size, not just diff-applied prop updates.
              key={`${settings.appearance}-${settings.fontSize}`}
              markdown={t('screens.settings.previewSample')}
              flavor="github"
              markdownStyle={previewStyle}
            />
          </View>

          <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
            {t('screens.settings.appearance')}
          </ThemedText>
          <View style={styles.cardRow}>
            {APPEARANCE_OPTIONS.map((opt) => (
              <AppearanceCard
                key={opt}
                kind={opt}
                label={t(`screens.settings.appearanceOptions.${opt}`)}
                selected={settings.appearance === opt}
                onPress={() => setAppearance(opt)}
                theme={theme}
              />
            ))}
          </View>

          <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
            {t('screens.settings.fontSize')}
          </ThemedText>
          <View style={[styles.fontGroup, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.glyphSmall}>A</ThemedText>
            <View style={styles.track}>
              <View style={[styles.trackLine, { backgroundColor: theme.backgroundSelected }]} />
              {FONT_SIZE_OPTIONS.map((opt) => {
                const selected = settings.fontSize === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setFontSize(opt)}
                    hitSlop={14}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(`screens.settings.fontSizeOptions.${opt}`)}
                    style={styles.tickTap}>
                    <View
                      style={[
                        styles.tick,
                        {
                          borderColor: theme.tint,
                          backgroundColor: selected ? theme.tint : theme.background,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={styles.glyphLarge}>A</ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  content: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  previewCard: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 140,
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    marginLeft: Spacing.two,
  },
  // Appearance cards
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  swatchRing: {
    borderWidth: 2,
    borderRadius: 13,
    padding: 3,
  },
  swatchOuter: {
    width: 72,
    height: 52,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  swatchSplit: {
    flex: 1,
    flexDirection: 'row',
  },
  swatchHalf: {
    flex: 1,
    overflow: 'hidden',
  },
  swatchPanel: {
    flex: 1,
    paddingHorizontal: 7,
    justifyContent: 'center',
    gap: 5,
  },
  barHeading: {
    height: 6,
    width: '75%',
    borderRadius: 2,
  },
  barBody: {
    height: 4,
    width: '92%',
    borderRadius: 2,
  },
  barBodyShort: {
    height: 4,
    width: '58%',
    borderRadius: 2,
  },
  cardLabel: {
    fontSize: 14,
  },
  // Font size slider
  fontGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  glyphSmall: {
    fontSize: 15,
  },
  glyphLarge: {
    fontSize: 26,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.four,
    height: 28,
  },
  trackLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 13,
    height: 2,
    borderRadius: 1,
  },
  tickTap: {
    padding: 2,
  },
  tick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
});
