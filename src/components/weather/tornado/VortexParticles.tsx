import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import {
  FUNNEL_HEIGHT,
  funnelRadiusAt,
  vortexVelocity,
  makeRadialGradientTexture,
} from './vortex';

// Dark vapor particles that swirl around the funnel axis under a vortex
// velocity field. The funnel SHAPE emerges from where the particles
// cluster — that's the whole trick. They render as normal-blended dark
// billboards so they OCCLUDE light to form mass (not additive glow).

const PARTICLE_COUNT = 600;

interface VaporParticle {
  // Position relative to tornado axis
  x: number; y: number; z: number;
  // Current velocity
  vx: number; vy: number; vz: number;
  // Per-particle constants
  baseAlpha: number;
  baseSize: number;
  age: number;
  lifetime: number;
}

const VERT = `
attribute float instanceAlpha;
attribute float instanceScale;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = instanceAlpha;
  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 mvPos = modelViewMatrix * instancePos;
  mvPos.xy += position.xy * instanceScale;
  gl_Position = projectionMatrix * mvPos;
}
`;

const FRAG = `
precision highp float;
uniform sampler2D gradientTex;
uniform vec3 tintHigh;
uniform vec3 tintLow;
uniform float globalOpacity;
uniform float flashFlare;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(gradientTex, vUv);
  // Lightning flash washes the vapor briefly
  vec3 color = mix(tintLow, vec3(0.95), flashFlare * 0.6);
  gl_FragColor = vec4(color, t.a * vAlpha * globalOpacity);
}
`;

function spawnParticle(p: VaporParticle, atBase: boolean) {
  if (atBase) {
    // Respawn at random angle on a circle a touch wider than the rope base.
    const angle = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 1.0;
    p.x = Math.cos(angle) * r;
    p.z = Math.sin(angle) * r;
    p.y = 0.2 + Math.random() * 1.5;
  } else {
    // Initial fill — distribute evenly along the funnel surface
    const t = Math.random();
    p.y = t * FUNNEL_HEIGHT;
    const funR = funnelRadiusAt(p.y);
    // Bias particles toward the surface band, with a little inward spread.
    const r = funR * (0.7 + Math.random() * 0.5);
    const angle = Math.random() * Math.PI * 2;
    p.x = Math.cos(angle) * r;
    p.z = Math.sin(angle) * r;
  }
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.baseAlpha = 0.55 + Math.random() * 0.3;
  p.baseSize = 1.5 + Math.random() * 1.8;
  p.age = 0;
  // Long lifetime — they recycle when they exit the top, not by clock.
  p.lifetime = 999;
}

export function VortexParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const particles = useMemo<VaporParticle[]>(() => {
    const arr: VaporParticle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p: VaporParticle = {
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        baseAlpha: 0, baseSize: 0, age: 0, lifetime: 999,
      };
      spawnParticle(p, false);
      arr.push(p);
    }
    return arr;
  }, []);

  const { material, geometry, alphaArr, scaleArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const alphaArr = new Float32Array(PARTICLE_COUNT);
    const scaleArr = new Float32Array(PARTICLE_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    const gradient = makeRadialGradientTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        // tintHigh: kept for future per-height tint (currently unused)
        tintHigh: { value: new THREE.Color('#181818') },
        tintLow:  { value: new THREE.Color('#2c2826') },
        globalOpacity: { value: 0 },
        flashFlare: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
    matRef.current = mat;
    return { material: mat, geometry: geom, alphaArr, scaleArr };
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);
  const tmpVel = useMemo(() => new THREE.Vector3(), []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ts = useTornadoStore.getState();
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    if (ts.tornadoOpacity < 0.05) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mat.uniforms.globalOpacity.value = ts.tornadoOpacity;

    // Lightning flash decays each frame
    const flashTarget = ts.flashAlpha;
    const cur = mat.uniforms.flashFlare.value;
    mat.uniforms.flashFlare.value = flashTarget > cur ? flashTarget : Math.max(0, cur - dt * 6);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Compute target vortex velocity at current particle position.
      vortexVelocity(tmpVel, p.x, p.y, p.z);

      // Smooth particle velocity toward target (gives mass / inertia feel).
      const k = Math.min(1, dt * 6);
      p.vx += (tmpVel.x - p.vx) * k;
      p.vy += (tmpVel.y - p.vy) * k;
      p.vz += (tmpVel.z - p.vz) * k;

      // Soft outer boundary: if a particle drifts outside the funnel surface,
      // pull it back inward toward the surface radius at its height.
      const r = Math.hypot(p.x, p.z);
      const surfaceR = funnelRadiusAt(p.y);
      if (r > surfaceR * 1.4) {
        const pullback = (surfaceR * 1.2 - r) * 2 * dt;
        const ux = p.x / r;
        const uz = p.z / r;
        p.x += ux * pullback;
        p.z += uz * pullback;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Recycle when particles exit the top of the funnel
      if (p.y > FUNNEL_HEIGHT + 2) {
        spawnParticle(p, true);
      }

      // Particle fade: brighter (more opaque) in the bell area, fades at top
      const heightFrac = Math.min(1, p.y / FUNNEL_HEIGHT);
      const topFade = 1 - Math.max(0, (heightFrac - 0.85)) / 0.15;
      const baseFade = Math.min(1, p.y * 0.5);  // soft fade-in at the base
      const alpha = p.baseAlpha * topFade * baseFade;

      // Size grows with height (vapor expands as it climbs)
      const scale = p.baseSize * (0.65 + heightFrac * 0.85);

      tmp.position.set(ts.tornadoX + p.x, p.y, ts.tornadoZ + p.z);
      tmp.scale.setScalar(1);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = alpha;
      scaleArr[i] = scale;
    }
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PARTICLE_COUNT]}
      frustumCulled={false}
      renderOrder={5}
    />
  );
}
