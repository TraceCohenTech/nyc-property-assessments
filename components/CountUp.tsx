"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (v: number) => string;
};

export function CountUp({ to, duration = 1800, decimals = 0, prefix = "", suffix = "", formatter }: Props) {
  const [value, setValue] = useState(0);
  const elRef = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            if (prefersReducedMotion) {
              setValue(to);
              return;
            }
            const startTs = performance.now();
            const animate = (now: number) => {
              const t = Math.min(1, (now - startTs) / duration);
              const eased = 1 - Math.pow(1 - t, 4);
              setValue(to * eased);
              if (t < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);

  const display = formatter
    ? formatter(value)
    : value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span ref={elRef} className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
