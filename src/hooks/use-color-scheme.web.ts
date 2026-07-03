import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// No-op store: the snapshot never changes after mount, so subscribe does nothing.
const emptySubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  // `useSyncExternalStore` returns the server snapshot (false) during static
  // render and the client snapshot (true) after hydration — the idiomatic
  // "have we hydrated?" flag, without a setState-in-effect.
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
