/**
 * Controller — connectivity state.
 * Wraps NetInfo so the View never imports it directly and gets a single,
 * simple boolean. Distinguishing "offline" from a generic failure lets the UI
 * say something true and useful instead of a vague error.
 */
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export interface StatoConnettivita {
  /** False only when we are reasonably sure there is no usable connection. */
  online: boolean;
}

/**
 * NetInfo reports both "connected" (there is a network) and
 * "internetReachable" (that network actually reaches the internet); the latter
 * is null while unknown. We treat only an explicit false as offline, so a
 * slow/unknown probe never produces a false "you are offline".
 */
export function useConnettivita(): StatoConnettivita {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const raggiungibile = state.isInternetReachable;
      setOnline(state.isConnected === false ? false : raggiungibile !== false);
    });
    return unsubscribe;
  }, []);

  return { online };
}
