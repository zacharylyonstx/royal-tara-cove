import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';

// Brown dust fountain at the tornado base. Hides ground contact and
// gives the F5 "debris ball" silhouette. Normal-blended (additive on
// brown goes orange).

const DUST_COUNT = 60;
const FOUNTAIN_RADIUS = 8;

interface DustParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; lifetime: number;
  size: number;
}

function makeRadialGradientTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const d = Math.hypot(dx, dy) / (size / 2);
      const a = Math.max(0, 1 - d) ** 1.5;
      const i = (y * size + x) * 4;
      data[i] = 255; data[i+1] = 255; data[i+2] = 255;
      data[i+3] = Math.floor(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

const DUST_VERT = `
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

const DUST_FRAG = `
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

function spawnParticle(p: DustParticle) {
  const a = Math.random() * Math.PI * 2;
  // Spawn out in a ring biased outward (debris cloud, not a tight ball)
  const r = 2 + Math.random() * FOUNTAIN_RADIUS;
  p.x = Math.cos(a) * r;
  p.z = Math.sin(a) * r;
  p.y = 0;
  p.vx = (Math.random() - 0.5) * 2;
  p.vz = (Math.random() - 0.5) * 2;
  p.vy = 1 + Math.random() * 1.5;
  p.age = 0;
  p.lifetime = 1.8;
  p.size = 1.2 + Math.random() * 1.6; // big + diffuse, not punchy
}

export function DustFountain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const particles = useMemo<DustParticle[]>(() => {
    const arr: DustParticle[] = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      const p: DustParticle = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1.5, size: 1 };
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
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        tint: { value: new THREE.Color('#6a5848') },
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
    if (!mesh || !matRef.current) return;
    if (ts.tornadoOpacity < 0.05) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    // Capped so the cloud is suggestive, not a brown blob
    matRef.current.uniforms.globalOpacity.value = ts.tornadoOpacity * 0.4;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;
      p.vy -= 3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.age > p.lifetime || p.y < 0) spawnParticle(p);

      tmp.position.set(ts.tornadoX + p.x, p.y, ts.tornadoZ + p.z);
      tmp.scale.setScalar(1);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = Math.max(0, 1 - p.age / p.lifetime);
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
