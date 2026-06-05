import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';

// Transformer / power-line FLASH — a brief electric green-white wash over the
// screen when the tornado blows a transformer as it tears through the
// neighborhood. Driven by tornadoStore.powerFlash (a timestamp); read per-frame
// via rAF so it never triggers React re-renders. Pure spectacle.

const FLASH_MS = 220;

export function PowerFlash() {
  const ref = useRef<HTMLDivElement>(null);
  const lastSeen = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      if (useGameStore.getState().gameMode !== 'tornado') { el.style.opacity = '0'; return; }
      const pf = useTornadoStore.getState().powerFlash;
      if (pf !== lastSeen.current) lastSeen.current = pf; // new flash armed
      const age = performance.now() / 1000 - lastSeen.current;
      if (lastSeen.current === 0 || age > FLASH_MS / 1000) { el.style.opacity = '0'; return; }
      // Two-pop falloff so it reads like an arcing transformer, not a fade.
      const k = age / (FLASH_MS / 1000);
      const env = (1 - k) * (0.55 + 0.45 * Math.abs(Math.sin(k * 18)));
      el.style.opacity = String(Math.min(1, env).toFixed(3));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0,
        zIndex: 905,
        mixBlendMode: 'screen',
        background:
          'radial-gradient(ellipse at 50% 60%, rgba(170,255,210,0.85), rgba(120,200,255,0.35) 45%, transparent 75%)',
      }}
    />
  );
}
