// What a non-purchaser sees instead of a PDF, Word or Excel document (FR-44).
//
// Written by hand rather than with `react-native-purchases-ui`: this is one
// non-consumable with one button, and the ready-made paywall brings a remote
// template and its own theming to a screen that has to match the rest of the
// app's appearance settings.
//
// Deliberately says nothing about a product *name* — the paid tier's
// user-facing name is not decided, and a paywall is not the place to invent
// one. It sells the capability (three formats) and shows the store's own
// localised price.
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { useTheme } from '@/hooks/use-theme';
import {
  getProPackage,
  isBillingConfigured,
  isUserCancelled,
  purchasePro,
  restorePro,
} from '@/lib/purchases';
import { Spacing } from '@/theme';
import type { PurchasesPackage } from 'react-native-purchases';

const FEATURES = ['pdf', 'docx', 'xlsx'] as const;

export function Paywall() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { refresh } = useProEntitlement();

  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProPackage()
      .then((p) => {
        if (!cancelled) setPkg(p);
      })
      .catch(() => {
        // Offerings unavailable (offline, or not configured yet). The screen
        // below degrades to "temporarily unavailable" and still offers restore,
        // which is the one action that can work from cache.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buy = useCallback(async () => {
    if (!pkg || busy) return;
    setBusy(true);
    try {
      await purchasePro(pkg);
      // The context's listener already flipped the gate; this is belt and
      // braces for the case where the listener missed the update.
      await refresh();
    } catch (e) {
      // Backing out of the Apple sheet is not an error worth a dialog.
      if (!isUserCancelled(e)) {
        Alert.alert(t('screens.paywall.purchaseFailedTitle'), t('screens.paywall.tryAgain'));
      }
    } finally {
      setBusy(false);
    }
  }, [pkg, busy, refresh, t]);

  const restore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const info = await restorePro();
      await refresh();
      // Say which of the two happened. "Nothing to restore" read as a failure
      // in testing when the alert was silent about it.
      const restored = info?.entitlements.active['pro'] !== undefined;
      Alert.alert(
        restored ? t('screens.paywall.restoredTitle') : t('screens.paywall.nothingToRestoreTitle'),
        restored ? t('screens.paywall.restoredBody') : t('screens.paywall.nothingToRestoreBody'),
      );
    } catch {
      Alert.alert(t('screens.paywall.restoreFailedTitle'), t('screens.paywall.tryAgain'));
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, t]);

  const price = pkg?.product.priceString;

  return (
    <View style={styles.container}>
      <SymbolView name="lock.doc" size={44} tintColor={theme.tint} />
      <ThemedText type="subtitle" style={styles.title}>
        {t('screens.paywall.title')}
      </ThemedText>

      <View style={styles.features}>
        {FEATURES.map((key) => (
          <View key={key} style={styles.featureRow}>
            <SymbolView name="checkmark" size={13} weight="semibold" tintColor={theme.tint} />
            <ThemedText style={styles.featureText}>
              {t(`screens.paywall.features.${key}`)}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText themeColor="textSecondary" type="small" style={styles.freeNote}>
        {t('screens.paywall.freeNote')}
      </ThemedText>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : price ? (
        <Pressable
          onPress={buy}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.buyButton,
            { backgroundColor: theme.tint },
            (pressed || busy) && styles.pressed,
          ]}>
          <ThemedText style={styles.buyLabel}>
            {t('screens.paywall.buy', { price })}
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText themeColor="textSecondary" type="small" style={styles.unavailable}>
          {t(
            isBillingConfigured()
              ? 'screens.paywall.unavailable'
              : 'screens.paywall.notConfigured',
          )}
        </ThemedText>
      )}

      {/* Guideline 3.1.1: reachable without buying. Also in Settings, so a
          returning customer never has to find a locked file first. */}
      <Pressable
        onPress={restore}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.restore, pressed && styles.pressed]}>
        <ThemedText themeColor="tint" type="small">
          {t('screens.paywall.restore')}
        </ThemedText>
      </Pressable>

      <ThemedText themeColor="textSecondary" type="small" style={styles.oneTime}>
        {t('screens.paywall.oneTimeNote')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: { textAlign: 'center' },
  features: { gap: Spacing.two },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  featureText: { flexShrink: 1 },
  freeNote: { textAlign: 'center' },
  spinner: { marginVertical: Spacing.three },
  buyButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  buyLabel: { color: '#ffffff', fontWeight: '600' },
  pressed: { opacity: 0.6 },
  unavailable: { textAlign: 'center' },
  restore: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  oneTime: { textAlign: 'center' },
});
