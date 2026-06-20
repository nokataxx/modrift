import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useNetwork } from '@/hooks/use-network';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

const OFFLINE_TINT = '#FF9500'; // orange — draws attention without alarming
const ONLINE_TINT = '#34C759'; // iOS green

/**
 * A slim status strip shown at the top of a screen's content while offline,
 * and briefly when connectivity returns (FR-12). Renders nothing when online.
 */
export function NetworkBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { offline, reconnected } = useNetwork();

  if (!offline && !reconnected) return null;

  const tint = offline ? OFFLINE_TINT : ONLINE_TINT;
  const icon = offline ? 'wifi.slash' : 'checkmark.circle.fill';
  const label = offline ? t('network.offline') : t('network.backOnline');

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
      <SymbolView name={icon} size={15} weight="semibold" tintColor={tint} />
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
  label: {
    fontSize: 14,
  },
});
