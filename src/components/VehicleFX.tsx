import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlayStore } from '../state/playStore';

// A one-shot dust puff kicked up when a bike/car lands a jump. Driven by
// playStore.landingFx (set in rideBikeTick on a hard touchdown). A small pooled
// Points cloud — expands outward, drifts up, and fades over ~0.6 s.

const COUNT = 20;
const LIFE = 0.62;

function makePuffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function VehicleFX() {
  const ptsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const tex = useMemo(() => makePuffTexture(), []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  const vel = useMemo(() => new Float32Array(COUNT * 3), []);
  const st = useRef({ lastAt: 0, active: false, start: 0 });

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const pts = ptsRef.current;
    const mat = matRef.current;
    if (!pts || !mat) return;
    const lf = usePlayStore.getState().landingFx;

    if (lf && lf.at !== st.current.lastAt) {
      // New landing → seed a fresh burst at the touchdown point.
      st.current.lastAt = lf.at;
      st.current.active = true;
      st.current.start = performance.now();
      const power = lf.power;
      for (let i = 0; i < COUNT; i++) {
        const a = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
        positions[i * 3] = lf.x + Math.cos(a) * 0.15;
        positions[i * 3 + 1] = 0.15;
        positions[i * 3 + 2] = lf.z + Math.sin(a) * 0.15;
        const sp = (1.3 + Math.random() * 1.6) * (0.6 + power);
        vel[i * 3] = Math.cos(a) * sp;
        vel[i * 3 + 1] = 1.0 + Math.random() * 1.3;
        vel[i * 3 + 2] = Math.sin(a) * sp;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      mat.opacity = 0.5 + 0.35 * power;
      mat.size = 0.8 + power * 0.7;
      pts.visible = true;
    }

    if (st.current.active) {
      const age = (performance.now() - st.current.start) / 1000;
      if (age >= LIFE) {
        st.current.active = false;
        pts.visible = false;
      } else {
        for (let i = 0; i < COUNT; i++) {
          vel[i * 3 + 1] -= 5.5 * dt; // gravity
          positions[i * 3] += vel[i * 3] * dt;
          positions[i * 3 + 1] = Math.max(0.04, positions[i * 3 + 1] + vel[i * 3 + 1] * dt);
          positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
          vel[i * 3] *= 0.9;
          vel[i * 3 + 2] *= 0.9;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        mat.opacity = (0.5 + 0.35 * (usePlayStore.getState().landingFx?.power ?? 0.5)) * (1 - age / LIFE);
        mat.size += dt * 1.1; // billow outward as it dissipates
      }
    }
  });

  return (
    <points ref={ptsRef} visible={false} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} map={tex} transparent depthWrite={false} sizeAttenuation color="#c7b59a" opacity={0} size={1} />
    </points>
  );
}
