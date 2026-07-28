"use client";
import { useEffect, useRef, ReactNode, ElementType, Ref } from "react";

export function Reveal({ children, delay = 0, as: As = "div", className = "" }: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => el.classList.add("in"), delay);
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <As ref={ref as Ref<HTMLElement>} className={`reveal ${className}`}>
      {children}
    </As>
  );
}
