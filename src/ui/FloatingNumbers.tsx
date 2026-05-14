import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useCombatStore } from '../state/combatStore';

interface ScreenText {
  id: number;
  text: string;
  color: string;
  big: boolean;
  spawnedAt: number;
  x: number; y: number;
  worldX: number; worldY: number; worldZ: number;
  jitterX: number;
}

export function FloatingNumbers() {
  const [active, setActive] = useState<ScreenText[]>([]);

  useEffect(() => {
    const cam = () => (window as unknown as { __camera?: THREE.Camera }).__camera;
    const id = setInterval(() => {
      const camera = cam();
      if (!camera) return;
      const now = performance.now() / 1000;
      const live = useCombatStore.getState().floatingTexts;
      const v = new THREE.Vector3();
      const next: ScreenText[] = [];
      for (const t of live) {
        const age = now - t.spawnedAt;
        if (age > 1.4) continue;
        v.set(t.x, t.y + age * 1.2, t.z);
        v.project(camera);
        if (v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
        next.push({
          id: t.id,
          text: t.text,
          color: t.color,
          big: !!t.big,
          spawnedAt: t.spawnedAt,
          x: sx, y: sy,
          worldX: t.x, worldY: t.y, worldZ: t.z,
          jitterX: ((t.id * 73) % 40) - 20,
        });
      }
      setActive(next);
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {active.map((t) => {
        const age = performance.now() / 1000 - t.spawnedAt;
        const fade = Math.max(0, 1 - age / 1.4);
        const scale = t.big ? 1 + Math.min(0.5, age * 4) : 1;
        return (
          <div
            key={t.id}
            style={{
              position: 'fixed',
              left: t.x + t.jitterX,
              top: t.y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              color: t.color,
              fontFamily: '"Arial Black", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: t.big ? 44 : 26,
              fontWeight: 900,
              opacity: fade,
              textShadow: t.big
                ? `0 0 16px ${t.color}, 0 3px 0 #000, 0 0 4px #000, 2px 2px 0 #000`
                : `0 2px 0 #000, 0 0 6px ${t.color}`,
              pointerEvents: 'none',
              zIndex: 95,
              letterSpacing: t.big ? 2 : 0,
              transition: 'none',
              userSelect: 'none',
            }}
          >
            {t.text}
          </div>
        );
      })}
    </>
  );
}
