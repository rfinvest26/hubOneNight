import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
}

/** Animates from 0 to a real, already-known value (rating, order count) — never
 * fabricates the number itself, only how it's revealed. */
export default function CountUp({ value, decimals = 0, duration = 0.8 }: Props) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) { setDisplay(value); return; }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduceMotion]);

  return <>{display.toFixed(decimals)}</>;
}
