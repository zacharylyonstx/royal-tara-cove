import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { CHARACTERS } from '../world/characters';
import * as THREE from 'three';

/**
 * Renders speech bubbles above the speaker characters. Uses a hidden 3D ref
 * to project world pos to screen space (via a small in-Canvas helper).
 *
 * Implementation: this lives OUTSIDE the canvas, but reads camera ref via
 * a global set by a helper component inside the canvas.
 */
export function Dialogue() {
  const lines = useCombatStore((s) => s.dialogue);
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((l) => <Bubble key={l.id} line={l} />)}
    </>
  );
}

function Bubble({ line }: { line: ReturnType<typeof useCombatStore.getState>['dialogue'][number] }) {
  const positions = useGameStore((s) => s.positions);
  const ch = CHARACTERS[line.speaker];
  const [screen, setScreen] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const cam = (window as unknown as { __camera?: THREE.Camera }).__camera;
      if (cam) {
        const pos = positions[line.speaker];
        const v = new THREE.Vector3(pos.x, pos.y + ch.height + 0.4, pos.z);
        v.project(cam);
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        if (v.z < 1) setScreen({ x, y });
        else setScreen(null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [line, positions, ch.height]);

  if (!screen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: screen.x,
        top: screen.y - 20,
        transform: 'translate(-50%, -100%)',
        background: 'white',
        color: '#1a1a1c',
        padding: '8px 14px',
        borderRadius: 14,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        zIndex: 95,
        maxWidth: 240,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{ch.name}</div>
      {line.text}
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          marginLeft: -8,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '10px solid white',
        }}
      />
    </div>
  );
}

/** Helper component placed inside Canvas — exposes camera to window. */
export function CameraExposer() {
  const { camera } = useThree();
  useEffect(() => {
    (window as unknown as { __camera?: THREE.Camera }).__camera = camera;
  }, [camera]);
  return null;
}
