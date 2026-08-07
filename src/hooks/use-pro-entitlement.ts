/**
 * The single gate for the paid tier (FR-44). Every v2 format viewer — PDF
 * (FR-41), docx (FR-42), xlsx (FR-43) — asks this hook and nothing else, so
 * the free core (Markdown/txt) never touches it.
 *
 * STUB: always unlocked. No billing SDK is wired up yet, and which one it will
 * be is deliberately still open — StoreKit directly or RevenueCat, depending on
 * whether purchases have to carry across to an Android release. The point of
 * having the hook now is that this decision cannot reach the viewers: they are
 * written against `isPro` from day one, and only the body below changes later.
 *
 *   // StoreKit directly
 *   const isPro = await StoreKitModule.hasLifetimePurchase();
 *
 *   // RevenueCat
 *   const info = await Purchases.getCustomerInfo();
 *   const isPro = info.entitlements.active['pro'] !== undefined;
 *
 * The return type is an object rather than a bare boolean so that loading and
 * error state can be added without touching a single call site.
 *
 * DO NOT SHIP AS IS — with `isPro: true` the paid formats are free for
 * everyone. Replacing this body is a release blocker for v2.
 */
export function useProEntitlement(): { isPro: boolean } {
  return { isPro: true };
}
