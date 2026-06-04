import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import { isTouchDevice } from '../../../systems/touchInput';
import { makeRadialGradientTexture } from './vortex';

// Leaves, paper and grit ripping horizontally across the neighbourhood,
// driven by windStrength. It blows mostly downwind but curves toward the
// funnel so the whole scene reads as being sucked into the storm — sells the
// wind well before (and around) the funnel itself. Recycles around the camera
// so the player is always in the thick of it. Pure VFX.

const COUNT = isTouchDevice() ? 70 : 140;
const BOX = 70;        // span of the debris field around the camera (m)
const BOX_H = 16;      // vertical span (m)

interface Bit {
  x: number; y: number; z: number;  // world position
  phase: number;
  size: number;
  speedMul: number;
}

const VERT = `
attribute float instanceScale;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * instanceScale;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = `
precision highp float;
uniform sampler2D gradientTex;
uniform vec3 tint;
uniform float globalOpacity;
varying vec2 vUv;
void main() {
  float a = texture2D(gradientTex, vUv).a;
  gl_FragColor = vec4(tint, a * globalOpacity);
}
`;

export function WindDebris() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const bits = useMemo<Bit[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * BOX,
        y: Math.random() * BOX_H,
        z: (Math.random() - 0.5) * BOX,
        phase: Math.random() * Math.PI * 2,
        size: 0.18 + Math.random() * 0.35,
        speedMul: 0.6 + Math.random() * 0.9,
      })),
    [],
  );

  const { geometry, material, scaleArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const scaleArr = new Float32Array(COUNT);
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        gradientTex: { value: makeRadialGradientTexture() },
        tint: { value: new THREE.Color('#6b5a3e') }, // dusty leaf-brown
        globalOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    return { geometry: geom, material: mat, scaleArr };
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);
  const initialized = useRef(false);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    const mesh = meshRef.current;
    if (!mesh) return;
    const wind = ts.windStrength;
    if (wind < 0.12) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    (material.uniforms.globalOpacity as { value: number }).value = Math.min(0.7, wind * 0.8);

    const cam = state.camera.position;
    const now = performance.now() / 1000;

    // Re-centre the field on the camera the first frame it's shown.
    if (!initialized.current) {
      for (const b of bits) {
        b.x = cam.x + (Math.random() - 0.5) * BOX;
        b.y = Math.random() * BOX_H;
        b.z = cam.z + (Math.random() - 0.5) * BOX;
      }
      initialized.current = true;
    }

    const baseSpeed = 14 + wind * 16;
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      // Downwind drift (mostly +X) with a vertical flutter.
      const flutter = Math.sin(now * 4 + b.phase) * 1.4;
      b.x += baseSpeed * b.speedMul * dt;
      b.y += (flutter * 0.4) * dt - 0.5 * dt;
      b.z += Math.cos(now * 3 + b.phase) * 1.2 * dt;
      // Curve toward the funnel — the storm's inflow.
      if (ts.tornadoOpacity > 0.2) {
        const dx = ts.tornadoX - b.x;
        const dz = ts.tornadoZ - b.z;
        const d = Math.hypot(dx, dz) || 1;
        const pull = Math.min(6, 30 / d) * dt;
        b.x += (dx / d) * pull;
        b.z += (dz / d) * pull;
      }

      // Recycle when a bit drifts out of the box around the camera — respawn
      // on the upwind (-X) face so nothing pops in right in front of you.
      if (
        b.x - cam.x > BOX / 2 || b.x - cam.x < -BOX / 2 ||
        b.z - cam.z > BOX / 2 || b.z - cam.z < -BOX / 2 ||
        b.y < -2 || b.y > BOX_H
      ) {
        b.x = cam.x - BOX / 2 + Math.random() * 6;
        b.y = Math.random() * BOX_H;
        b.z = cam.z + (Math.random() - 0.5) * BOX;
      }

      tmp.position.set(b.x, b.y, b.z);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      scaleArr[i] = b.size;
    }
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      renderOrder={6}
    />
  );
}
