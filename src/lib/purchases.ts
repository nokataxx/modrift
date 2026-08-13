// RevenueCat, kept behind one module (FR-44).
//
// Everything that knows the SDK exists lives here. The rest of the app sees
// `useProEntitlement()` and the Paywall, which is what let the three viewers be
// written and shipped to device before the billing decision was made at all.
//
// No accounts (5.9). We never call `logIn()`, so RevenueCat mints an anonymous
// App User ID per install and restores come from the store's own purchase
// history via `restorePurchases()`. That is also why a purchase does not carry
// to Android — a deliberate trade, not an oversight.
import Constants from 'expo-constants';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

/**
 * The RevenueCat entitlement the paid formats check. One string, one place —
 * the whole point of the entitlement model is that adding SKUs later (a
 * subscription, a bundle) changes what grants `pro`, never what reads it.
 */
export const PRO_ENTITLEMENT = 'pro';

/**
 * RevenueCat's iOS SDK key. Public by design (it identifies the app, it does
 * not authorise anything), so app.json is the right home — no secret store, and
 * it travels with the build the way the bundle identifier does.
 */
const API_KEY: string | undefined = (
  Constants.expoConfig?.extra as { revenueCatApiKey?: string } | undefined
)?.revenueCatApiKey;

/**
 * A `test_` key is RevenueCat's Test Store: purchases never reach the App
 * Store, and the SDK shows a simulate-success/fail modal instead of Apple's
 * sheet. Exactly what we want while the App Store side is still being set up,
 * and a disaster to ship — nobody could buy anything, and the failure is
 * silent. `__DEV__` is compiled out of release builds, so this cannot be left
 * switched on by accident the way a config flag could.
 */
function isTestStoreKey(key: string): boolean {
  return key.startsWith('test_');
}

/** False until the key is filled in from the RevenueCat dashboard. */
export function isBillingConfigured(): boolean {
  if (typeof API_KEY !== 'string' || API_KEY.length === 0) return false;
  if (isTestStoreKey(API_KEY) && !__DEV__) return false;
  return true;
}

/** True when purchases are being simulated rather than made (Test Store). */
export function isSimulatedStore(): boolean {
  return typeof API_KEY === 'string' && isTestStoreKey(API_KEY) && isBillingConfigured();
}

let configured = false;

/**
 * Idempotent, because React 18 mounts effects twice in development and
 * configuring RevenueCat twice logs a warning and re-creates its cache.
 */
export function configurePurchases(): void {
  if (configured || !isBillingConfigured()) return;
  Purchases.configure({ apiKey: API_KEY as string });
  configured = true;
}

export function hasPro(info: CustomerInfo | null | undefined): boolean {
  return info?.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isBillingConfigured()) return null;
  configurePurchases();
  // Served from RevenueCat's own on-device cache when offline, so a paying
  // customer on a plane still passes the gate.
  return Purchases.getCustomerInfo();
}

/**
 * The single package the paywall offers. Reads the *current* offering rather
 * than a hard-coded product id so the price, and later the product itself, are
 * changed in the dashboard instead of in a release.
 */
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!isBillingConfigured()) return null;
  configurePurchases();
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

/** Thrown-shape guard: RevenueCat flags a user-cancelled purchase on the error. */
export function isUserCancelled(error: unknown): boolean {
  return (error as { userCancelled?: boolean } | null)?.userCancelled === true;
}

export async function purchasePro(pkg: PurchasesPackage): Promise<CustomerInfo> {
  configurePurchases();
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/**
 * Guideline 3.1.1 requires this for a non-consumable, and it must be reachable
 * without buying anything — hence the button in Settings as well as on the
 * paywall. Call it only from a user action: it prompts for the Apple ID.
 */
export async function restorePro(): Promise<CustomerInfo | null> {
  if (!isBillingConfigured()) return null;
  configurePurchases();
  return Purchases.restorePurchases();
}

export function addCustomerInfoListener(fn: (info: CustomerInfo) => void): () => void {
  if (!isBillingConfigured()) return () => {};
  configurePurchases();
  Purchases.addCustomerInfoUpdateListener(fn);
  return () => Purchases.removeCustomerInfoUpdateListener(fn);
}
