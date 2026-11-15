import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { CHARACTERS } from '../world/characters';
import { useNetStore } from '../state/netStore';
import { usePlayStore } from '../state/playStore';
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
  // My own line in first person: my head IS the camera, so there's nothing to
  // pin a bubble to (it used to project to NaN and vanish off-screen). Show it
  // as a caption instead.
  const me = useNetStore((s) => s.myCharacterId) ?? useGameStore.getState().activeCharacterId;
  const thirdPerson = usePlayStore((s) => s.thirdPerson);
  const caption = line.speaker === me && !thirdPerson;

  useEffect(() => {
    if (caption) return;
    const id = setInterval(() => {
      const cam = (window as unknown as { __camera?: THREE.Camera }).__camera;
      if (!cam) return;
      const pos = positions[line.speaker];
      const v = new THREE.Vector3(pos.x, pos.y + ch.height + 0.4, pos.z);
      v.project(cam);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      if (v.z < 1 && Number.isFinite(x) && Number.isFinite(y)) {
        // Keep it on the glass even when the speaker is at the screen edge.
        setScreen({
          x: Math.max(90, Math.min(window.innerWidth - 90, x)),
          y: Math.max(70, Math.min(window.innerHeight - 40, y)),
        });
      } else setScreen(null);
    }, 80); // 12 Hz — smooth enough for a bubble
    return () => clearInterval(id);
  }, [line, positions, ch.height, caption]);

  if (caption) {
    return (
      <div
        style={{
          position: 'fixed', left: '50%', bottom: 122, transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.94)', color: '#1a1a1c', padding: '7px 16px', borderRadius: 14,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 14, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none', zIndex: 95, whiteSpace: 'nowrap',
        }}
      >
        <span style={{ opacity: 0.6, marginRight: 6 }}>{ch.name}:</span>{line.text}
      </div>
    );
  }
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

/** Helper component placed inside Canvas — exposes camera + scene to window. */
export function CameraExposer() {
  const { camera, scene } = useThree();
  useEffect(() => {
    (window as unknown as { __camera?: THREE.Camera; __scene?: THREE.Scene }).__camera = camera;
    (window as unknown as { __camera?: THREE.Camera; __scene?: THREE.Scene }).__scene = scene;
  }, [camera, scene]);
  return null;
}
