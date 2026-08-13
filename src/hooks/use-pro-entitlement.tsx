/**
 * The single gate for the paid tier (FR-44). Every v2 format viewer — PDF
 * (FR-41), docx (FR-42), xlsx (FR-43) — asks this hook and nothing else, so the
 * free core (Markdown/txt) and images (FR-45) never touch it.
 *
 * A Context rather than a per-caller effect: all three viewers must agree, and
 * a purchase made on the paywall has to unlock the screen behind it without a
 * remount. One RevenueCat listener feeds them all.
 *
 * `isLoading` matters more than it looks. Entitlement is not known
 * synchronously at launch, and defaulting to "not Pro" while we find out would
 * flash the paywall at someone who has already paid — the single most annoying
 * thing a paid app can do. Callers show their loading state until this clears.
 */
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
  addCustomerInfoListener,
  configurePurchases,
  getCustomerInfo,
  hasPro,
  isBillingConfigured,
} from '@/lib/purchases';

interface ProEntitlement {
  isPro: boolean;
  /** True until the first entitlement answer arrives. Never show a paywall while set. */
  isLoading: boolean;
  /** Re-read entitlement (after a purchase or restore made elsewhere). */
  refresh: () => Promise<void>;
}

const ProContext = createContext<ProEntitlement | null>(null);

export function ProEntitlementProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  // Only "loading" if there is something to load. Whether billing is configured
  // is decided at build time by app.json, so it is an initial value rather than
  // something the effect discovers.
  const [isLoading, setIsLoading] = useState(isBillingConfigured);

  const refresh = useCallback(async () => {
    try {
      const info = await getCustomerInfo();
      setIsPro(hasPro(info));
    } catch {
      // Leave the last known answer alone. RevenueCat serves getCustomerInfo()
      // from its on-device cache, so a throw here means something worse than
      // being offline, and locking a paying customer out on it would be wrong.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // No key yet (the dashboard is set up outside this repo): fail closed and
    // stay out of the way. The paywall then explains itself and offers no
    // product, which is the honest state — the alternative, defaulting to
    // unlocked, is exactly the bug this hook's stub was labelled with.
    if (!isBillingConfigured()) return;
    configurePurchases();

    // The first read, in a promise callback rather than awaited in the effect
    // body: state lands after the external system answers, which is the shape
    // effects are for.
    let cancelled = false;
    getCustomerInfo()
      .then((info) => {
        if (!cancelled) setIsPro(hasPro(info));
      })
      .catch(() => {
        // Cached by RevenueCat on device, so a throw is worse than offline —
        // and locking out a paying customer over it would be the wrong call.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Fires on purchase, restore, and RevenueCat's own background refreshes, so
    // the gate reopens the moment a purchase lands without anyone polling.
    const unsubscribe = addCustomerInfoListener((info) => setIsPro(hasPro(info)));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ isPro, isLoading, refresh }),
    [isPro, isLoading, refresh],
  );
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function useProEntitlement(): ProEntitlement {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('useProEntitlement must be used within ProEntitlementProvider');
  return ctx;
}
