import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface NetworkContextValue {
  /** True when the device is known to be offline. */
  offline: boolean;
  /** Transiently true for a few seconds right after coming back online. */
  reconnected: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  offline: false,
  reconnected: false,
});

// How long the "back online" toast stays up after reconnecting.
const RECONNECT_TOAST_MS = 2500;
// While offline, re-poll NetInfo this often in case the passive reconnect
// event is missed.
const REFRESH_INTERVAL_MS = 3000;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const wasOffline = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToastTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goOffline = useCallback(() => {
    wasOffline.current = true;
    clearToastTimer();
    setReconnected(false);
    setOffline(true);
  }, [clearToastTimer]);

  const goOnline = useCallback(() => {
    setOffline(false);
    if (wasOffline.current) {
      // Only toast if we were actually offline before.
      wasOffline.current = false;
      clearToastTimer();
      setReconnected(true);
      timerRef.current = setTimeout(() => setReconnected(false), RECONNECT_TOAST_MS);
    }
  }, [clearToastTimer]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // An explicit `false` means offline; null/unknown is treated as online so
      // the banner doesn't flash before the first real reading.
      if (state.isConnected === false) goOffline();
      else goOnline();
    });
    return () => {
      unsubscribe();
      clearToastTimer();
    };
  }, [goOffline, goOnline, clearToastTimer]);

  // The passive reconnect event can be missed, so while offline we re-poll
  // NetInfo to pick up a restored connection. (Note: the iOS simulator can't
  // recover network state mid-session — verify recovery on a real device.)
  useEffect(() => {
    if (!offline) return;
    const id = setInterval(() => {
      NetInfo.refresh().catch(() => {
        // Non-fatal: next tick retries.
      });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [offline]);

  return (
    <NetworkContext.Provider value={{ offline, reconnected }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
