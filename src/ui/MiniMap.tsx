import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useCombatStore } from '../state/combatStore';

const MAP_SIZE = 150;
const RANGE = 60;

export function MiniMap() {
  const phase = useGameStore((s) => s.phase);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const activeId = myCharacterId ?? fallbackActive;
  const blobs = useCombatStore((s) => s.blobs);

  // Throttled re-render so React doesn't get hit at 60fps from a setState loop.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100); // 10 Hz refresh
    return () => clearInterval(id);
  }, []);

  if (phase !== 'combat' && phase !== 'victory') return null;

  const player = positions[activeId];
  const playerYaw = yaws[activeId];

  // Convert world (X, Z) to mini-map (mx, my). Center = player.
  // Player faces -Z + rotated by yaw. We want the mini-map to be top-down with
  // up = player facing direction.
  function toMap(wx: number, wz: number): { x: number; y: number } | null {
    const dx = wx - player.x;
    const dz = wz - player.z;
    // Rotate world delta by +playerYaw so the player's facing direction maps
    // to "up" on the SVG (where y grows downward, so up = -y).
    const ang = playerYaw;
    const rx = dx * Math.cos(ang) - dz * Math.sin(ang);
    const rz = dx * Math.sin(ang) + dz * Math.cos(ang);
    const dist = Math.hypot(rx, rz);
    if (dist > RANGE) return null;
    const mx = (rx / RANGE) * (MAP_SIZE / 2 - 6) + MAP_SIZE / 2;
    const my = (rz / RANGE) * (MAP_SIZE / 2 - 6) + MAP_SIZE / 2;
    return { x: mx, y: my };
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 100,
        right: 16,
        width: MAP_SIZE,
        height: MAP_SIZE,
        background: 'rgba(20, 30, 40, 0.7)',
        borderRadius: '50%',
        border: '2px solid #3afff0',
        boxShadow: '0 0 14px rgba(58, 255, 240, 0.4)',
        pointerEvents: 'none',
        zIndex: 90,
      }}
    >
      <svg width={MAP_SIZE} height={MAP_SIZE} style={{ display: 'block' }}>
        {/* Other characters (yellow) */}
        {(['penny', 'luke'] as const).filter((id) => id !== activeId).map((id) => {
          const p = toMap(positions[id].x, positions[id].z);
          if (!p) return null;
          return <circle key={id} cx={p.x} cy={p.y} r={3} fill="#ffd866" />;
        })}
        {/* Blobs (red dots; bigger for boss) */}
        {blobs.filter((b) => b.alive).map((b) => {
          const p = toMap(b.x, b.z);
          if (!p) return null;
          const r = b.kind === 'boss' ? 7 : 3.5;
          const color = b.kind === 'boss' ? '#ff3a3a' : b.kind === 'sprinter' ? '#ff9a3a' : b.kind === 'splitter' ? '#a832c8' : '#a0e84a';
          return <circle key={b.id} cx={p.x} cy={p.y} r={r} fill={color} stroke="#1a1a1c" strokeWidth={0.7} />;
        })}
        {/* Player triangle pointing up (already rotated frame) */}
        <polygon
          points={`${MAP_SIZE / 2},${MAP_SIZE / 2 - 7} ${MAP_SIZE / 2 - 5},${MAP_SIZE / 2 + 4} ${MAP_SIZE / 2 + 5},${MAP_SIZE / 2 + 4}`}
          fill="#3afff0"
          stroke="white"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
