import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import { GLBModel } from '../../GLBModel';
import { MODELS } from '../../../world/models';

// The classic Twister gag — every so often a cow gets caught at the funnel base,
// sucked up + tumbling through the vortex, then flung out and gone. Pure
// easter-egg spectacle; no gameplay effect. Rendered in WORLD space (the funnel
// position comes straight from the tornado store).

interface CowState {
  active: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  spinX: number; spinY: number; spinZ: number;
  ejected: boolean;
  age: number;
  nextSpawnAt: number; // wall-clock seconds
}

export function FlyingCow() {
  const groupRef = useRef<THREE.Group>(null);
  const s = useMemo<CowState>(() => ({
    active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, spinX: 0, spinY: 0, spinZ: 0,
    ejected: false, age: 0, nextSpawnAt: 0,
  }), []);

  useFrame((_, dtRaw) => {
    const g = groupRef.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = useTornadoStore.getState();
    const now = performance.now() / 1000;
    const funnelLive = t.tornadoOpacity > 0.3;

    if (!s.active) {
      g.visible = false;
      // Arm the first spawn, then wait out the cooldown between cows.
      if (s.nextSpawnAt === 0) s.nextSpawnAt = now + 6 + Math.random() * 6;
      if (funnelLive && now >= s.nextSpawnAt) {
        // Spawn at the funnel base, off to one side, on the ground.
        const ang = Math.random() * Math.PI * 2;
        const r = 7 + Math.random() * 4;
        s.x = t.tornadoX + Math.cos(ang) * r;
        s.z = t.tornadoZ + Math.sin(ang) * r;
        s.y = 0.5;
        s.vx = 0; s.vy = 2; s.vz = 0;
        s.rx = 0; s.ry = Math.random() * Math.PI * 2; s.rz = 0;
        s.spinX = (Math.random() - 0.5) * 6;
        s.spinY = (Math.random() - 0.5) * 6;
        s.spinZ = (Math.random() - 0.5) * 6;
        s.ejected = false;
        s.age = 0;
        s.active = true;
      }
      return;
    }

    g.visible = true;
    s.age += dt;
    const dx = t.tornadoX - s.x;
    const dz = t.tornadoZ - s.z;
    const d = Math.hypot(dx, dz) || 0.001;

    if (!s.ejected) {
      // Sucked toward the axis with a swirl + a strong updraft (mooo!).
      const k = Math.min(1, 22 / d);
      s.vx += (dx / d) * 24 * dt - (dz / d) * 20 * dt * k;
      s.vz += (dz / d) * 24 * dt + (dx / d) * 20 * dt * k;
      s.vy += 22 * dt;
      if (s.vy > 22) s.vy = 22;
      // Once it rides high enough, the vortex spits it back out.
      if (s.y > 24) {
        s.ejected = true;
        const out = 10 + Math.random() * 8;
        s.vx = (dx / d) * -out - (dz / d) * out * 0.5;
        s.vz = (dz / d) * -out + (dx / d) * out * 0.5;
        s.vy = 5;
      }
    } else {
      s.vy -= 18 * dt; // gravity — comes back down
      s.vx *= 0.99; s.vz *= 0.99;
    }

    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.rx += s.spinX * dt; s.ry += s.spinY * dt; s.rz += s.spinZ * dt;

    // Despawn once it's flung clear / hit the ground / timed out.
    if ((s.ejected && s.y < -2) || s.age > 9 || d > 90 || !funnelLive) {
      s.active = false;
      s.nextSpawnAt = now + 12 + Math.random() * 16;
      g.visible = false;
      return;
    }

    g.position.set(s.x, s.y, s.z);
    g.rotation.set(s.rx, s.ry, s.rz);
  });

  return (
    <group ref={groupRef} visible={false}>
      <GLBModel url={MODELS.cow.url} fitHeight={MODELS.cow.fitHeight} castShadow />
    </group>
  );
}
