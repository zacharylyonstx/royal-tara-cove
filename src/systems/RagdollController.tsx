import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useCombatStore } from '../state/combatStore';
import { startRagdollWhoosh, tickRagdollWhoosh, stopRagdollWhoosh } from '../audio';

// Defeat-throw cinematic. Active only while gameStore.ragdoll != null.
// Drives:
//   • active character position into a rising spiral that shrinks to 0
//   • yaw into a fast spin
//   • cinematic camera orbiting the character so it's clearly visible
//   • whooshing audio with rising pitch
// After 4 seconds, clears ragdoll state; the defeat HUD takes over.

const THROW_DURATION = 4;

export function RagdollController() {
  const startedRef = useRef(false);

  useEffect(() => {
    return () => {
      stopRagdollWhoosh();
      // Make sure the cinematic override is cleared on unmount
      const cs = useCombatStore.getState();
      if (cs.cinematic.active) {
        cs.endCinematic();
      }
    };
  }, []);

  useFrame(() => {
    const g = useGameStore.getState();
    if (g.gameMode !== 'tornado') return;
    const rag = g.ragdoll;
    const cs = useCombatStore.getState();

    if (!rag || !rag.active) {
      if (startedRef.current) {
        startedRef.current = false;
        stopRagdollWhoosh();
        if (cs.cinematic.active) cs.endCinematic();
      }
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      startRagdollWhoosh();
    }

    const now = performance.now() / 1000;
    const t = Math.min(THROW_DURATION, now - rag.startedAt);
    const ts = useTornadoStore.getState();
    const tornadoZ = ts.tornadoZ;

    // Position: rising spiral around the tornado, scaling outward.
    const baseY = rag.originY + 22 * Math.sin((t / THROW_DURATION) * Math.PI);
    const theta = t * 4;
    const radius = 2 + t * 6;
    const x = Math.cos(theta) * radius;
    const z = tornadoZ + Math.sin(theta) * radius;
    const player = g.positions[g.activeCharacterId];
    if (player) {
      player.x = x;
      player.y = Math.max(0, baseY);
      player.z = z;
    }
    g.yaws[g.activeCharacterId] = t * 8;

    // Cinematic camera: orbit at distance 14, slightly above player.
    // We rewrite the cinematic state directly (every frame) so the camera
    // tracks the spiraling player smoothly; the existing startCinematic API
    // sets an `endsAt` we'd have to keep extending.
    useCombatStore.setState({
      cinematic: {
        active: true,
        cameraX: x + Math.cos(theta + Math.PI / 2) * 14,
        cameraY: Math.max(baseY + 4, 6),
        cameraZ: z + Math.sin(theta + Math.PI / 2) * 14,
        targetX: x,
        targetY: baseY,
        targetZ: z,
        endsAt: now + THROW_DURATION,
      },
    });

    tickRagdollWhoosh(t);

    if (t >= THROW_DURATION) {
      g.clearRagdoll();
      stopRagdollWhoosh();
      cs.endCinematic();
    }
  });

  return null;
}
