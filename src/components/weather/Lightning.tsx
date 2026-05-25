import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTornadoStore } from '../../state/tornadoStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { useCombatStore } from '../../state/combatStore';
import { lightningStrike } from '../../audio';
import { spawnLightningBolt } from './LightningBolt';

// Watches tornadoStore.lightningCue. On each tick of the cue, flashes a
// fullscreen quad white for ~120ms (0.85 → 0.3 → 0) and adds a one-frame
// camera shake burst. Audio rumble fires from the audio module separately.

const FLASH_DURATION = 0.13;

export function Lightning() {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const flashUntil = useRef(0);
  const lastCue = useRef(0);
  const addShake = useCombatStore((s) => s.addShake);

  // Periodic lightning trigger: chance per second scales with phase.
  const sinceCheck = useRef(0);

  useEffect(() => {
    return () => {
      flashUntil.current = 0;
    };
  }, []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const phase = useGameStore.getState().phase;
    const intensity = useTornadoStore.getState().stormIntensity;

    // Trigger logic: roughly every 5-7s in hail, 3-5s in tornado phases.
    sinceCheck.current += dt;
    if (sinceCheck.current >= 0.5) {
      sinceCheck.current = 0;
      let chancePerSec = 0;
      if (phase === 'hail') chancePerSec = 0.18;
      else if (phase === 'tornado-approach' || phase === 'tornado-arrived') chancePerSec = 0.3;
      if (chancePerSec > 0 && Math.random() < chancePerSec * 0.5) {
        useTornadoStore.getState().bumpLightning();
      }
    }

    // Watch cue to start a flash.
    const cue = useTornadoStore.getState().lightningCue;
    if (cue !== lastCue.current) {
      lastCue.current = cue;
      flashUntil.current = performance.now() / 1000 + FLASH_DURATION;
      addShake(0.6);
      lightningStrike(0.1 + Math.random() * 0.6);
      // Spawn 1-2 visible lightning bolts near the player + bump storm dome flash
      const _g = useGameStore.getState();
      const _myId = useNetStore.getState().myCharacterId ?? _g.activeCharacterId;
      const player = _g.positions[_myId];
      const px = player?.x ?? 0;
      const pz = player?.z ?? 0;
      const boltCount = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < boltCount; i++) spawnLightningBolt(px, pz);
      useTornadoStore.getState().setFlashAlpha(0.7);
      // Decay flashAlpha back to 0 shortly after
      setTimeout(() => useTornadoStore.getState().setFlashAlpha(0), 160);
    }

    // Drive flash alpha
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const now = performance.now() / 1000;
    if (now < flashUntil.current) {
      const t = (flashUntil.current - now) / FLASH_DURATION;
      mat.opacity = 0.85 * t;
      mesh.visible = true;
      // Glue the quad in front of the camera every frame
      mesh.position.copy(camera.position);
      mesh.quaternion.copy(camera.quaternion);
      mesh.translateZ(-0.5);
    } else if (mesh.visible) {
      mesh.visible = false;
      mat.opacity = 0;
    }

    // Auto-hide when intensity drops
    if (intensity < 0.4) mesh.visible = false;
  });

  return (
    <mesh ref={meshRef} renderOrder={9999} frustumCulled={false} visible={false}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial ref={matRef} color="#ffffff" transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
  );
}
