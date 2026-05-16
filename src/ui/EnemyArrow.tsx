import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';

/**
 * Off-screen indicator: when the nearest blob is outside the screen, an
 * arrow appears at the screen edge pointing toward it. Hidden when there's
 * a blob visible on screen (or no blobs alive).
 */
export function EnemyArrow() {
  const phase = useGameStore((s) => s.phase);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const blobs = useCombatStore((s) => s.blobs);
  const [arrow, setArrow] = useState<{ x: number; y: number; angleDeg: number; dist: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const cam = (window as unknown as { __camera?: THREE.Camera }).__camera;
      if (!cam || phase !== 'combat') {
        setArrow(null);
        return;
      }
      const player = positions[activeId];
      const aliveBlobs = blobs.filter((b) => b.alive);
      if (aliveBlobs.length === 0) {
        setArrow(null);
        return;
      }
      // Nearest blob
      let bestDist = Infinity;
      let nearest = aliveBlobs[0];
      for (const b of aliveBlobs) {
        const d = Math.hypot(b.x - player.x, b.z - player.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = b;
        }
      }
      // Project to screen
      const v = new THREE.Vector3(nearest.x, nearest.y + 0.3, nearest.z);
      v.project(cam);
      const onScreenX = v.x;
      const onScreenY = v.y;
      const inView = v.z < 1 && onScreenX > -1 && onScreenX < 1 && onScreenY > -1 && onScreenY < 1;
      if (inView) {
        setArrow(null);
      } else {
        // Compute angle from screen center to projected point (clamped to edge)
        const sx = onScreenX;
        const sy = onScreenY;
        // Behind camera (v.z > 1): flip
        const flipped = v.z > 1;
        const ang = Math.atan2(flipped ? -sy : sy, flipped ? -sx : sx);
        const margin = 60;
        const halfW = window.innerWidth / 2 - margin;
        const halfH = window.innerHeight / 2 - margin;
        // Find ray from screen center along ang to box edge
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const tx = cosA !== 0 ? halfW / Math.abs(cosA) : Infinity;
        const ty = sinA !== 0 ? halfH / Math.abs(sinA) : Infinity;
        const t = Math.min(tx, ty);
        const x = window.innerWidth / 2 + cosA * t;
        const y = window.innerHeight / 2 - sinA * t;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          setArrow(null);
          return;
        }
        const angleDeg = (Math.atan2(-sinA, cosA) * 180) / Math.PI; // CSS rotation
        setArrow({ x, y, angleDeg, dist: bestDist });
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, positions, activeId, blobs]);

  if (!arrow) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: arrow.x,
        top: arrow.y,
        transform: `translate(-50%, -50%) rotate(${arrow.angleDeg}deg)`,
        pointerEvents: 'none',
        zIndex: 90,
      }}
    >
      <div style={{ width: 0, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderBottom: '32px solid #ff3a3a', filter: 'drop-shadow(0 0 8px rgba(255,80,80,0.7))' }} />
      <div style={{ position: 'absolute', top: 32, left: -20, width: 40, color: '#ff8a8a', fontFamily: 'sans-serif', fontSize: 11, fontWeight: 700, textAlign: 'center', textShadow: '0 0 4px black', transform: `rotate(${-arrow.angleDeg}deg)` }}>
        {arrow.dist.toFixed(0)}m
      </div>
    </div>
  );
}
