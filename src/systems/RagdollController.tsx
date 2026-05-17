import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useCombatStore } from '../state/combatStore';
import { startRagdollWhoosh, tickRagdollWhoosh, stopRagdollWhoosh, wilhelmScream } from '../audio';

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
  const { camera } = useThree();

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
        camera.up.set(0, 1, 0);
      }
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      startRagdollWhoosh();
      wilhelmScream();
    }

    const now = performance.now() / 1000;
    const t = Math.min(THROW_DURATION, now - rag.startedAt);
    const ts = useTornadoStore.getState();
    const tornadoZ = ts.tornadoZ;
    const tornadoX = ts.tornadoX;

    // Position: rising spiral around the tornado, scaling outward.
    const baseY = rag.originY + 22 * Math.sin((t / THROW_DURATION) * Math.PI);
    const theta = t * 4;
    const radius = 2 + t * 6;
    const x = tornadoX + Math.cos(theta) * radius;
    const z = tornadoZ + Math.sin(theta) * radius;
    const player = g.positions[g.activeCharacterId];
    if (player) {
      player.x = x;
      player.y = Math.max(0, baseY);
      player.z = z;
    }
    g.yaws[g.activeCharacterId] = t * 8;

    // ---- v17 first-person ragdoll camera ----
    // Instead of an orbital cinematic, the camera lives AT the player's
    // position, spinning with their yaw + pitching wildly. The world
    // spins around the viewer — disorienting and funny.
    // We bypass the CameraRig by writing directly into a cinematic state
    // whose camera == player position and whose target is in-front-of-player.
    const headY = Math.max(0, baseY) + 0.4;
    // Tumble: yaw matches player spin, pitch oscillates wildly
    const tumbleYaw = g.yaws[g.activeCharacterId];
    const tumblePitch = Math.sin(t * 9) * 0.7 + Math.sin(t * 3.1) * 0.4;
    const tumbleRoll  = Math.sin(t * 5.3) * 0.6;

    const lookDir = new Vector3(0, 0, -1).applyEuler(new Euler(tumblePitch, tumbleYaw, tumbleRoll, 'YXZ'));
    const lookX = x + lookDir.x * 5;
    const lookY = headY + lookDir.y * 5;
    const lookZ = z + lookDir.z * 5;

    useCombatStore.setState({
      cinematic: {
        active: true,
        cameraX: x, cameraY: headY, cameraZ: z,
        targetX: lookX, targetY: lookY, targetZ: lookZ,
        endsAt: now + THROW_DURATION,
      },
    });
    // Roll: lookAt() uses camera.up, so tilting "up" gives us roll without
    // fighting the CameraRig's lookAt every frame.
    camera.up.set(Math.sin(tumbleRoll), Math.cos(tumbleRoll), 0);

    tickRagdollWhoosh(t);

    if (t >= THROW_DURATION) {
      g.clearRagdoll();
      stopRagdollWhoosh();
      cs.endCinematic();
      camera.up.set(0, 1, 0);
    }
  });

  return null;
}
