import { useEffect, useState } from "react";

/**
 * The browser's clock, drawn again every `every` ms, so a figure counted to now grows without a
 * refresh: each second for a running turn's line, each 30 s for a feature's times. `null` stops the
 * clock, as once nothing it counts still runs.
 */
export function useNow(every: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (every === null) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}
