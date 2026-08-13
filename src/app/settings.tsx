import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownWebView } from '@/components/markdown-web-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { useSettings } from '@/hooks/use-settings';
import { useResolvedColorScheme, useTheme } from '@/hooks/use-theme';
import { type CloudNames, loadCloudNames, setCloudName } from '@/lib/cloud-names';
import { type CmTheme } from '@/lib/cm/html';
import {
  classifyFileLocation,
  externalContainerKey,
  shortContainerTag,
} from '@/lib/file-location';
import { restorePro } from '@/lib/purchases';
import { loadRecentFiles, removeRecentFilesWhere } from '@/lib/recent-files';
import {
  FONT_SIZE_BASE,
  type AppearanceMode,
  type FontSizeKey,
  type HomeLocation,
} from '@/lib/settings';
import {
  MaxContentWidth,
  STYLE_THEME_KEYS,
  StyleThemes,
  Spacing,
  type StylePalette,
  type StyleThemeKey,
} from '@/theme';

type Theme = ReturnType<typeof useTheme>;

const APPEARANCE_OPTIONS: AppearanceMode[] = ['system', 'light', 'dark'];
const FONT_SIZE_OPTIONS: FontSizeKey[] = ['small', 'medium', 'large'];
const HOME_LOCATION_OPTIONS: HomeLocation[] = ['icloud', 'local'];

// FR-29 alternate app icons. `name` must match the plugin config in app.json
// (null = the primary icon). The OS is the source of truth for the current
// selection (getAppIconName), so nothing is persisted app-side.
const APP_ICON_OPTIONS = [
  { key: 'dark', name: null, source: require('../../assets/icon-src/modrift-icon-1024.png') },
  { key: 'light', name: 'Light', source: require('../../assets/icon-src/modrift-icon-light-1024.png') },
  { key: 'navy', name: 'Navy', source: require('../../assets/icon-src/modrift-icon-navy-1024.png') },
] as const;

// Preview card height per font size — sized so the 3-heading + body sample fits
// the compact-padded surface without an internal scroll.
const PREVIEW_HEIGHT: Record<FontSizeKey, number> = {
  small: 150,
  medium: 166,
  large: 184,
};

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

// One style preset as a pill "chip": three color dots (the H1/H2/H3 palette)
// plus the name. Selected gets a tint ring + tint label. Laid out in a
// horizontal scroller so the row survives an arbitrary number of presets —
// deliberately unlike the appearance swatch cards above it.
function StyleChip({
  palette,
  label,
  selected,
  onPress,
  theme,
}: {
  palette: StylePalette;
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.backgroundElement, borderColor: selected ? theme.tint : 'transparent' },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View style={styles.chipDots}>
        <View style={[styles.chipDot, { backgroundColor: palette.heading1 }]} />
        <View style={[styles.chipDot, { backgroundColor: palette.heading2 }]} />
        <View style={[styles.chipDot, { backgroundColor: palette.heading3 }]} />
      </View>
      <ThemedText style={[styles.chipLabel, selected && { color: theme.tint }]}>{label}</ThemedText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const scheme = useResolvedColorScheme();
  const { settings, setAppearance, setFontSize, setStyleTheme, setHomeLocation } = useSettings();
  const { refresh: refreshPro } = useProEntitlement();
  const [restoring, setRestoring] = useState(false);

  // FR-44 / Guideline 3.1.1: restore has to be reachable without hitting a
  // locked file first — a reinstalling customer should not have to hunt for a
  // PDF to find the button. The paywall carries the same action.
  const restorePurchase = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const info = await restorePro();
      await refreshPro();
      const restored = info?.entitlements.active['pro'] !== undefined;
      Alert.alert(
        restored ? t('screens.paywall.restoredTitle') : t('screens.paywall.nothingToRestoreTitle'),
        restored ? t('screens.paywall.restoredBody') : t('screens.paywall.nothingToRestoreBody'),
      );
    } catch {
      Alert.alert(t('screens.paywall.restoreFailedTitle'), t('screens.paywall.tryAgain'));
    } finally {
      setRestoring(false);
    }
  };

  // FR-31: switching home is destructive-ish (the other folder's files vanish
  // from view, and local isn't backed up), so confirm with a warning first. No
  // files are moved — only which folder is listed/written changes.
  const switchHomeLocation = (loc: HomeLocation) => {
    if (loc === settings.homeLocation) return;
    Alert.alert(
      t('screens.settings.homeLocationSwitchTitle'),
      loc === 'local'
        ? t('screens.settings.homeLocationToLocalMessage')
        : t('screens.settings.homeLocationToIcloudMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.settings.homeLocationSwitchConfirm'),
          onPress: () => {
            // The previous home's files are no longer reachable as home files
            // after the switch, so drop their (now stale) history rows. Only the
            // OLD home's own files are pruned — external-cloud entries stay.
            const prevHomeKind = settings.homeLocation === 'local' ? 'localHome' : 'icloudCopy';
            removeRecentFilesWhere(
              (uri) => classifyFileLocation(uri).kind === prevHomeKind,
            ).catch(() => {
              // Non-fatal: history is display-only.
            });
            setHomeLocation(loc);
          },
        },
      ],
    );
  };
  const [appIcon, setAppIcon] = useState<string | null>(() => getAppIconName());

  const handleAppIcon = async (name: 'Light' | 'Navy' | null) => {
    try {
      await setAlternateAppIcon(name);
      setAppIcon(name);
    } catch {
      // The OS refused the switch (rare) — keep the current selection.
    }
  };
  const base = FONT_SIZE_BASE[settings.fontSize];

  // Same CodeMirror theme the viewer builds, so the live preview matches the
  // actual reading/editing surface exactly (FR-20 unification).
  const cmTheme: CmTheme = useMemo(
    () => ({
      bg: theme.background,
      fg: theme.text,
      tint: theme.tint,
      link: theme.accent,
      codeMono: theme.codeMono,
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
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* FR-16: cap width and centre on iPad / large screens (no-op on phones). */}
          <View style={styles.content}>
          {/* Live preview — the same CodeMirror surface as the viewer, read-only,
              reflecting appearance + font size in real time. */}
          <View
            style={[
              styles.previewCard,
              // Height tracks the font size so the whole sample fits without an
              // internal scroll at any size (FR-25 preview is compact-padded).
              { height: PREVIEW_HEIGHT[settings.fontSize] },
              { backgroundColor: theme.background, borderColor: theme.backgroundElement },
            ]}>
            <MarkdownWebView
              // Remount on setting change so the preview always reflects the
              // latest appearance / size (theme + base are baked in at mount).
              key={`${settings.appearance}-${settings.fontSize}-${settings.styleTheme}`}
              initialContent={t('screens.settings.previewSample')}
              editable={false}
              taskInteractive={false}
              compact
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
            {t('screens.settings.style')}
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {STYLE_THEME_KEYS.map((key: StyleThemeKey) => (
              <StyleChip
                key={key}
                palette={StyleThemes[key][scheme]}
                label={t(`screens.settings.styleOptions.${key}`)}
                selected={settings.styleTheme === key}
                onPress={() => setStyleTheme(key)}
                theme={theme}
              />
            ))}
          </ScrollView>

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

          {/* FR-29: alternate app icon picker (hidden where unsupported). */}
          {supportsAlternateIcons && (
            <>
              <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
                {t('screens.settings.appIcon')}
              </ThemedText>
              <View style={styles.iconRow}>
                {APP_ICON_OPTIONS.map((opt) => {
                  const selected = appIcon === opt.name;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => handleAppIcon(opt.name)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(`screens.settings.appIconOptions.${opt.key}`)}
                      style={styles.iconChoice}>
                      <Image
                        source={opt.source}
                        style={[
                          styles.iconThumb,
                          { borderColor: selected ? theme.tint : theme.backgroundElement },
                        ]}
                      />
                      <ThemedText
                        themeColor={selected ? 'text' : 'textSecondary'}
                        style={styles.iconLabel}>
                        {t(`screens.settings.appIconOptions.${opt.key}`)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* FR-31: home storage location — iCloud › Modrift (default) or an
              on-device folder. Switching only changes what マイファイル lists /
              writes to; it never moves files (warned in switchHomeLocation). */}
          <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
            {t('screens.settings.homeLocation')}
          </ThemedText>
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {HOME_LOCATION_OPTIONS.map((loc) => {
              const active = settings.homeLocation === loc;
              return (
                <Pressable
                  key={loc}
                  onPress={() => switchHomeLocation(loc)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.segmentItem,
                    active && [
                      styles.segmentItemActive,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                    ],
                  ]}>
                  <ThemedText
                    themeColor={active ? 'tint' : 'textSecondary'}
                    style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t(`screens.settings.homeLocationOptions.${loc}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText themeColor="textSecondary" style={styles.cloudHint}>
            {t('screens.settings.homeLocationHint')}
          </ThemedText>

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

          <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
            {t('screens.settings.purchase')}
          </ThemedText>
          <View style={[styles.cloudGroup, { backgroundColor: theme.backgroundElement }]}>
            <Pressable
              onPress={restorePurchase}
              disabled={restoring}
              style={({ pressed }) => [styles.cloudRow, (pressed || restoring) && styles.pressed]}
              accessibilityRole="button">
              <View style={styles.cloudRowText}>
                <ThemedText themeColor="tint">
                  {t('screens.settings.restorePurchase')}
                </ThemedText>
              </View>
            </Pressable>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.cloudHint}>
            {t('screens.settings.restorePurchaseHint')}
          </ThemedText>
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
  scroll: {
    // Fill the width so the centred content column can sit in the middle.
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  previewCard: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    // Height is set inline per font size; clip so the WebView fills the card and
    // its own content padding provides the inset (no card padding — would double).
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
  // Style preset chips (horizontal scroller — scales to any number of presets)
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 20,
    borderWidth: 2,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipDots: {
    flexDirection: 'row',
    gap: 3,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipLabel: {
    fontSize: 14,
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
  // FR-31 home-location segmented control (mirrors the home screen's segment).
  segment: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: 2,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two - 2,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  // FR-29 app icon picker
  iconRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  iconChoice: {
    alignItems: 'center',
  },
  iconThumb: {
    width: 56,
    height: 56,
    // iOS squircle approximation at this size; the real mask is applied by the
    // OS on the Home Screen, this is just the in-app preview.
    borderRadius: 13,
    borderWidth: 2,
  },
  iconLabel: {
    fontSize: 12,
    marginTop: Spacing.one,
  },
});
