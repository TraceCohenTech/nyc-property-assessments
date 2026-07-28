"use client";
import { useEffect, useRef } from "react";

type BoroughWeight = { borough: string; value: number };

/**
 * Signature hero visual: a grid of dots sized by real borough assessed-value share, evoking
 * NYC's 1.17M tax lots as a data field. Cursor-driven parallax only (no ambient/looping
 * animation — passes the Coffee-Economy motion kill list). One non-looping entrance animation
 * on mount, then fully idle until the pointer moves. Hand-rolled canvas, no WebGL dependency.
 */
export function HeroCanvas({ boroughs }: { boroughs: BoroughWeight[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let pointer = { x: -9999, y: -9999, active: false };
    let raf = 0;
    let entrance = prefersReducedMotion ? 1 : 0;
    let entranceStart = 0;

    // Column weights from real borough market-value share — denser/brighter columns = boroughs
    // that carry more of the city's total assessed value.
    const total = boroughs.reduce((s, b) => s + b.value, 0) || 1;
    const weights = boroughs.map((b) => 0.35 + (b.value / total) * 3.2);

    const cols = weights.length * 9;
    const spacing = 34;
    let dots: { x: number; y: number; r: number; a: number }[] = [];

    function layout() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const rows = Math.ceil(h / spacing) + 1;
      const totalCols = Math.ceil(w / spacing) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < totalCols; col++) {
          const bandIdx = Math.min(weights.length - 1, Math.floor((col / totalCols) * weights.length));
          const weight = weights[bandIdx];
          // Deterministic pseudo-random so layout is stable across re-renders.
          const seed = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
          const rnd = seed - Math.floor(seed);
          if (rnd > weight * 0.55) continue;
          dots.push({
            x: col * spacing + (rnd - 0.5) * 10,
            y: row * spacing + ((seed * 7) % 1) * 10,
            r: 1 + rnd * 1.6,
            a: 0.08 + weight * 0.09,
          });
        }
      }
    }

    function draw(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      if (entrance < 1) {
        if (!entranceStart) entranceStart = now;
        entrance = Math.min(1, (now - entranceStart) / 1100);
      }
      const ease = 1 - Math.pow(1 - entrance, 3);

      for (const d of dots) {
        let dx = 0;
        let dy = 0;
        if (pointer.active) {
          const ddx = pointer.x - d.x;
          const ddy = pointer.y - d.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          const radius = 180;
          if (dist < radius) {
            const force = (1 - dist / radius) * 6;
            dx = -(ddx / (dist || 1)) * force;
            dy = -(ddy / (dist || 1)) * force;
          }
        }
        ctx.beginPath();
        ctx.arc(d.x + dx, d.y * ease + h * (1 - ease) * 0.02 + dy, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(103, 232, 249, ${d.a * ease})`;
        ctx.fill();
      }

      if (entrance < 1 || pointer.active) {
        raf = requestAnimationFrame(draw);
      } else {
        raf = 0;
      }
    }

    function requestDraw() {
      if (!raf) raf = requestAnimationFrame(draw);
    }

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
      requestDraw();
    }
    function onPointerLeave() {
      pointer.active = false;
      requestDraw();
    }

    layout();
    requestDraw();

    const ro = new ResizeObserver(() => {
      layout();
      requestDraw();
    });
    ro.observe(canvas.parentElement!);

    if (!prefersReducedMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [boroughs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
}
