import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { touchInput, isTouchDevice } from '../systems/touchInput';
import { useGameStore } from '../state/gameStore';

// On-screen controls for touch devices (iPad / phone): a left-hand virtual
// joystick for movement and right-hand Jump + Action buttons. Hidden on
// mouse/keyboard devices via a coarse-pointer media query. Writes into the
// touchInput singleton, which PlayerController folds into its keyboard inputs.
//
// Sizes scale with the screen so the controls feel right on both a small phone
// and a 12" iPad (a fixed 132px stick looks tiny on a big tablet, huge on a
// phone).

const BASE_AT_1X = 132; // joystick base diameter (px) at scale 1
const THUMB_AT_1X = 58;

/** UI scale from the shorter screen dimension. ~0.9 on a phone, up to 1.45 on
 *  a big iPad. */
function uiScale(): number {
  if (typeof window === 'undefined') return 1;
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(0.9, Math.min(1.45, vmin / 430));
}

export function TouchControls() {
  // Detect once; touch capability doesn't change within a session.
  const [enabled] = useState(isTouchDevice);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);

  const baseRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<number | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  // Recompute control sizing on rotate / resize.
  const [scale, setScale] = useState(uiScale);
  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setScale(uiScale());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [enabled]);

  // One-time "drag to look" coaching pill — the FPS modes have no other way to
  // turn the camera on touch, so make the gesture discoverable. Auto-hides.
  // The countdown only runs while the controls are actually visible (it used
  // to burn its 6 seconds hidden behind the welcome screen).
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    if (!enabled || welcomeOpen) return;
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, [enabled, welcomeOpen]);

  // If the menu opens mid-drag (kid taps 🏠 Games with the other thumb), the
  // joystick DOM vanishes before its pointerup ever fires — without this reset
  // the last stick vector stays latched and the character walks by itself in
  // the next mode until the joystick is touched again.
  useEffect(() => {
    if (!welcomeOpen) return;
    dragId.current = null;
    setThumb({ x: 0, y: 0 });
    touchInput.active = false;
    touchInput.moveX = 0;
    touchInput.moveY = 0;
  }, [welcomeOpen]);

  if (!enabled || welcomeOpen) return null;

  const BASE = Math.round(BASE_AT_1X * scale);
  const THUMB = Math.round(THUMB_AT_1X * scale);
  const RADIUS = (BASE - THUMB) / 2; // max thumb travel from centre
  const gameMode = useGameStore.getState().gameMode;
  const fpsMode = gameMode !== 'munchies' && gameMode !== 'treehouse';

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
        <ActionButton label="✋" sub="Use" color="#5a8a3e" onPress={() => { touchInput.actionQueued = true; touchInput.actionHeld = true; }} onRelease={() => { touchInput.actionHeld = false; }} size={Math.round(78 * scale)} />
        <ActionButton label="⤴" sub="Jump" color="#3a6db0" onPress={() => { touchInput.jumpQueued = true; }} size={Math.round(92 * scale)} />
      </div>

      {/* One-time look-gesture coach (FPS modes only). */}
      {showHint && fpsMode && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20,28,38,0.62)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 999,
            fontSize: Math.round(13 * scale),
            fontWeight: 700,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
            letterSpacing: 0.2,
          }}
        >
          🕹️ Joystick to move · 👆 drag to look
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label, sub, color, onPress, onRelease, size,
}: { label: string; sub: string; color: string; onPress: () => void; onRelease?: () => void; size: number }) {
  const [down, setDown] = useState(false);
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); setDown(true); onPress(); }}
      onPointerUp={() => { setDown(false); onRelease?.(); }}
      onPointerCancel={() => { setDown(false); onRelease?.(); }}
      onPointerLeave={() => { setDown(false); onRelease?.(); }}
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
