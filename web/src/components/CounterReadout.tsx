'use client';

import { useEffect, useState } from 'react';

/** Cuenta de 0 al valor final, respeta prefers-reduced-motion. */
export function CounterReadout({
  to, suffix = '', duration = 1100, delay = 520,
}: { to: number; suffix?: string; duration?: number; delay?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValue(to); return; }

    let raf = 0;
    const startAt = performance.now() + delay;
    function tick(now: number) {
      const t = Math.min(1, Math.max(0, (now - startAt) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);

  return <>{value.toLocaleString('es-CL')}{suffix}</>;
}
