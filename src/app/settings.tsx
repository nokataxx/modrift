import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownWebView } from '@/components/markdown-web-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { type CloudNames, loadCloudNames, setCloudName } from '@/lib/cloud-names';
import { type CmTheme } from '@/lib/cm/html';
import {
  classifyFileLocation,
  externalContainerKey,
  shortContainerTag,
} from '@/lib/file-location';
import { loadRecentFiles } from '@/lib/recent-files';
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

  // Same CodeMirror theme the viewer builds, so the live preview matches the
  // actual reading/editing surface exactly (FR-20 unification).
  const cmTheme: CmTheme = useMemo(
    () => ({
      bg: theme.background,
      fg: theme.text,
      tint: theme.tint,
      sel: theme.backgroundSelected,
      codeBg: theme.backgroundElement,
      muted: theme.textSecondary,
      h1: theme.heading1,
      h2: theme.heading2,
      h3: theme.heading3,
      h4: theme.heading4,
      base,
    }),
    [theme, base],
  );

  // FR-26: name third-party cloud sources. iOS won't reveal whether a file is
  // from Google Drive or Dropbox, but each source has a stable container key, so
  // the user names it once here and it applies to every file from that source.
  // We derive the visible sources from history (most-recent sample name per key
  // gives the user something to recognise it by).
  const [cloudSources, setCloudSources] = useState<{ key: string; sample: string }[]>([]);
  const [cloudNames, setCloudNames] = useState<CloudNames>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRecentFiles(), loadCloudNames()]).then(([items, names]) => {
      if (cancelled) return;
      const seen = new Map<string, string>();
      for (const file of items) {
        if (classifyFileLocation(file.uri).kind !== 'external') continue;
        const key = externalContainerKey(file.uri);
        if (!key || seen.has(key)) continue;
        seen.set(key, file.name);
      }
      setCloudSources(Array.from(seen, ([key, sample]) => ({ key, sample })));
      setCloudNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const promptCloudName = (key: string) => {
    Alert.prompt(
      t('screens.recentFiles.nameCloudTitle'),
      t('screens.recentFiles.nameCloudMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.recentFiles.nameCloudConfirm'),
          onPress: (value?: string) => {
            setCloudName(key, value ?? '').then(setCloudNames).catch(() => {});
          },
        },
      ],
      'plain-text',
      cloudNames[key] ?? '',
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('screens.settings.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Live preview — the same CodeMirror surface as the viewer, read-only,
              reflecting appearance + font size in real time. */}
          <View
            style={[
              styles.previewCard,
              { backgroundColor: theme.background, borderColor: theme.backgroundElement },
            ]}>
            <MarkdownWebView
              // Remount on setting change so the preview always reflects the
              // latest appearance / size (theme + base are baked in at mount).
              key={`${settings.appearance}-${settings.fontSize}`}
              initialContent={t('screens.settings.previewSample')}
              editable={false}
              taskInteractive={false}
              theme={cmTheme}
              style={[styles.previewWeb, { backgroundColor: theme.background }]}
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

          {cloudSources.length > 0 && (
            <>
              <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
                {t('screens.settings.cloudNames')}
              </ThemedText>
              <View style={[styles.cloudGroup, { backgroundColor: theme.backgroundElement }]}>
                {cloudSources.map((src, i) => (
                  <Pressable
                    key={src.key}
                    onPress={() => promptCloudName(src.key)}
                    style={({ pressed }) => [
                      styles.cloudRow,
                      i > 0 && {
                        borderTopColor: theme.background,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button">
                    <View style={styles.cloudRowText}>
                      <ThemedText numberOfLines={1}>
                        {cloudNames[src.key] ??
                          `${t('screens.recentFiles.locationExternal')} · ${shortContainerTag(src.key)}`}
                      </ThemedText>
                      {src.sample ? (
                        <ThemedText
                          themeColor="textSecondary"
                          numberOfLines={1}
                          style={styles.cloudSample}>
                          {t('screens.settings.cloudSample', { name: src.sample })}
                        </ThemedText>
                      ) : null}
                    </View>
                    <SymbolView
                      name="chevron.right"
                      size={14}
                      weight="semibold"
                      tintColor={theme.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>
              <ThemedText themeColor="textSecondary" style={styles.cloudHint}>
                {t('screens.settings.cloudNamesHint')}
              </ThemedText>
            </>
          )}
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
    // Fixed height + clip: the WebView fills the card and its own content
    // padding provides the inset (no card padding, or it would double up).
    height: 172,
    overflow: 'hidden',
  },
  previewWeb: {
    flex: 1,
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
  // Cloud names
  cloudGroup: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  cloudRowText: {
    flex: 1,
  },
  cloudSample: {
    fontSize: 12,
    marginTop: 2,
  },
  cloudHint: {
    fontSize: 12,
    marginTop: Spacing.two,
    marginLeft: Spacing.two,
  },
});
