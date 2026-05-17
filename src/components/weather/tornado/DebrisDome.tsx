import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import { makeRadialGradientTexture } from './vortex';

// Wide low brown dome at the funnel base — the F5 "debris cloud" that
// hides the ground contact. Particles slow-tumble in a flat puff (NOT a
// tall fountain) so the funnel reads as if its base disappears into a
// churning cloud of dirt + debris.

const DUST_COUNT = 90;
const DOME_RADIUS = 10;
const DOME_HEIGHT = 4;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; lifetime: number;
  size: number;
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
uniform vec3 tint;
uniform float globalOpacity;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(gradientTex, vUv);
  gl_FragColor = vec4(tint, t.a * vAlpha * globalOpacity);
}
`;

function spawnParticle(p: Particle) {
  const angle = Math.random() * Math.PI * 2;
  // Spawn weighted toward the perimeter so the dome reads as a ring/dome
  // rather than a pile in the middle
  const r = 2 + Math.sqrt(Math.random()) * DOME_RADIUS;
  p.x = Math.cos(angle) * r;
  p.z = Math.sin(angle) * r;
  p.y = Math.random() * DOME_HEIGHT;
  // Slow swirl + low vertical drift
  const tx = -Math.sin(angle);
  const tz =  Math.cos(angle);
  p.vx = tx * (1 + Math.random()) + (Math.random() - 0.5) * 0.5;
  p.vz = tz * (1 + Math.random()) + (Math.random() - 0.5) * 0.5;
  p.vy = 0.3 + Math.random() * 0.8;
  p.age = 0;
  p.lifetime = 2.5 + Math.random() * 1.5;
  p.size = 2.0 + Math.random() * 2.5;
}

export function DebrisDome() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      const p: Particle = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1, size: 1 };
      spawnParticle(p);
      p.age = Math.random() * p.lifetime; // stagger
      arr.push(p);
    }
    return arr;
  }, []);

  const { material, geometry, alphaArr, scaleArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const alphaArr = new Float32Array(DUST_COUNT);
    const scaleArr = new Float32Array(DUST_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    const gradient = makeRadialGradientTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        tint: { value: new THREE.Color('#5a4a3a') },
        globalOpacity: { value: 0 },
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
    mat.uniforms.globalOpacity.value = ts.tornadoOpacity * 0.55;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      // Slight inward bias so swirling pulls particles toward the funnel
      const r = Math.hypot(p.x, p.z);
      if (r > 0.1) {
        p.x -= (p.x / r) * 0.4 * dt;
        p.z -= (p.z / r) * 0.4 * dt;
      }
      if (p.age > p.lifetime || p.y > DOME_HEIGHT) spawnParticle(p);

      const alpha = Math.max(0, 1 - p.age / p.lifetime) * 0.85;

      tmp.position.set(ts.tornadoX + p.x, p.y, ts.tornadoZ + p.z);
      tmp.scale.setScalar(1);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = alpha;
      scaleArr[i] = p.size;
    }
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('instanceScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, DUST_COUNT]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}
