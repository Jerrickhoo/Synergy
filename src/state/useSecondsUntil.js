import { useEffect, useState } from "react";

// Whole seconds until an ISO time, ticking each second and settling at 0.
// Used to count down until another verification link may be sent.
export function useSecondsUntil(iso) {
  const target = Date.parse(iso) || 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (target <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= target) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);
  return Math.max(0, Math.ceil((target - now) / 1000));
}
