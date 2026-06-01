import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { touchInput, isTouchDevice } from '../systems/touchInput';
import { useGameStore } from '../state/gameStore';

// On-screen controls for touch devices (iPad / phone): a left-hand virtual
// joystick for movement and right-hand Jump + Action buttons. Hidden on
// mouse/keyboard devices via a coarse-pointer media query. Writes into the
// touchInput singleton, which PlayerController folds into its keyboard inputs.

const BASE = 132; // joystick base diameter (px)
const THUMB = 58; // thumb diameter (px)
const RADIUS = (BASE - THUMB) / 2; // max thumb travel from centre

export function TouchControls() {
  // Detect once; touch capability doesn't change within a session.
  const [enabled] = useState(isTouchDevice);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);

  const baseRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<number | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  if (!enabled || welcomeOpen) return null;

  const updateFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, RADIUS);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    setThumb({ x: nx * clamped, y: ny * clamped });
    touchInput.moveX = nx * (clamped / RADIUS);
    touchInput.moveY = ny * (clamped / RADIUS);
    touchInput.active = true;
  };

  const onStickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragId.current = e.pointerId;
    baseRef.current?.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };
  const onStickMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragId.current !== e.pointerId) return;
    updateFromPointer(e);
  };
  const onStickUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragId.current !== e.pointerId) return;
    dragId.current = null;
    setThumb({ x: 0, y: 0 });
    touchInput.active = false;
    touchInput.moveX = 0;
    touchInput.moveY = 0;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none', touchAction: 'none', userSelect: 'none' }}>
      {/* Joystick (bottom-left) */}
      <div
        ref={baseRef}
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
        style={{
          position: 'absolute',
          left: 'calc(env(safe-area-inset-left, 0px) + 22px)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 26px)',
          width: BASE,
          height: BASE,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.16), rgba(255,255,255,0.06))',
          border: '2px solid rgba(255,255,255,0.4)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: THUMB,
            height: THUMB,
            marginLeft: -THUMB / 2,
            marginTop: -THUMB / 2,
            transform: `translate(${thumb.x}px, ${thumb.y}px)`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 40%, #fff, #cfe0ff)',
            border: '2px solid rgba(90,120,180,0.7)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
      </div>

      {/* Action + Jump buttons (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          right: 'calc(env(safe-area-inset-right, 0px) + 24px)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 30px)',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-end',
          pointerEvents: 'auto',
        }}
      >
        <ActionButton label="✋" sub="Use" color="#5a8a3e" onPress={() => { touchInput.actionQueued = true; }} size={78} />
        <ActionButton label="⤴" sub="Jump" color="#3a6db0" onPress={() => { touchInput.jumpQueued = true; }} size={92} />
      </div>
    </div>
  );
}

function ActionButton({
  label, sub, color, onPress, size,
}: { label: string; sub: string; color: string; onPress: () => void; size: number }) {
  const [down, setDown] = useState(false);
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); setDown(true); onPress(); }}
      onPointerUp={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.55)',
        background: down ? color : `${color}cc`,
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: down ? 'inset 0 3px 10px rgba(0,0,0,0.45)' : '0 4px 16px rgba(0,0,0,0.4)',
        transform: down ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.06s, background 0.06s',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: Math.round(size * 0.34) }}>{label}</span>
      <span style={{ fontSize: Math.round(size * 0.15), fontWeight: 700, marginTop: 3, opacity: 0.9 }}>{sub}</span>
    </button>
  );
}
