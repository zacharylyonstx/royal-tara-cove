import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import { isTouchDevice } from '../../../systems/touchInput';
import {
  FUNNEL_HEIGHT,
  funnelRadiusAt,
  vortexVelocity,
  makeCloudPuffTexture,
} from './vortex';

// Churning vapor cloud around the funnel axis, driven by the vortex velocity
// field. Thousands of soft cloud-puff billboards stack into a thick volumetric
// mass — the funnel reads as real swirling vapor, not a fuzzy cone. Particles
// are tinted dark dirt at the base → lighter condensation up high, and each
// sprite slowly spins so the whole column visibly churns.

// Dense on desktop for a thick volumetric cloud; trimmed on touch for framerate.
const PARTICLE_COUNT = isTouchDevice() ? 760 : 1500;

interface VaporParticle {
  // Position relative to tornado axis
  x: number; y: number; z: number;
  // Current velocity
  vx: number; vy: number; vz: number;
  // Per-particle constants
  baseAlpha: number;
  baseSize: number;
  rot: number;       // current billboard spin angle
  spin: number;      // spin rate (rad/s)
  age: number;
  lifetime: number;
}

const VERT = `
attribute float instanceAlpha;
attribute float instanceScale;
attribute float instanceRot;
attribute float instanceHeight;
varying vec2 vUv;
varying float vAlpha;
varying float vH;
void main() {
  vUv = uv;
  vAlpha = instanceAlpha;
  vH = instanceHeight;
  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 mvPos = modelViewMatrix * instancePos;
  float c = cos(instanceRot), s = sin(instanceRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  mvPos.xy += p * instanceScale;
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
varying float vH;
void main() {
  vec4 t = texture2D(gradientTex, vUv);
  // Dark churned dirt low on the column → pale condensation toward the top.
  vec3 color = mix(tintLow, tintHigh, smoothstep(0.15, 0.85, vH));
  color = mix(color, vec3(0.97), flashFlare * 0.6);  // lightning wash
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
  // Multi-shell sizing: lots of mid puffs + some big soft wisps for volume.
  const big = Math.random() < 0.3;
  p.baseAlpha = big ? 0.32 + Math.random() * 0.28 : 0.55 + Math.random() * 0.35;
  p.baseSize = big ? 3.2 + Math.random() * 2.6 : 1.4 + Math.random() * 1.8;
  p.rot = Math.random() * Math.PI * 2;
  p.spin = (Math.random() - 0.5) * 1.6;
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
        baseAlpha: 0, baseSize: 0, rot: 0, spin: 0, age: 0, lifetime: 999,
      };
      spawnParticle(p, false);
      arr.push(p);
    }
    return arr;
  }, []);

  const { material, geometry, alphaArr, scaleArr, rotArr, heightArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const alphaArr = new Float32Array(PARTICLE_COUNT);
    const scaleArr = new Float32Array(PARTICLE_COUNT);
    const rotArr = new Float32Array(PARTICLE_COUNT);
    const heightArr = new Float32Array(PARTICLE_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    geom.setAttribute('instanceRot', new THREE.InstancedBufferAttribute(rotArr, 1));
    geom.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(heightArr, 1));
    const gradient = makeCloudPuffTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        tintHigh: { value: new THREE.Color('#8f9097') }, // pale condensation up high
        tintLow:  { value: new THREE.Color('#16120f') }, // dark churned dirt at the base
        globalOpacity: { value: 0 },
        flashFlare: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
    matRef.current = mat;
    return { material: mat, geometry: geom, alphaArr, scaleArr, rotArr, heightArr };
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
      p.rot += p.spin * dt; // slow churn

      tmp.position.set(ts.tornadoX + p.x, p.y, ts.tornadoZ + p.z);
      tmp.scale.setScalar(1);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = alpha;
      scaleArr[i] = scale;
      rotArr[i] = p.rot;
      heightArr[i] = heightFrac;
    }
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceRot') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceHeight') as THREE.InstancedBufferAttribute).needsUpdate = true;
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
