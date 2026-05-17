import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';

// Vapor wisps that shed off the funnel mid-section, rise + curl + fade.
// Instanced billboard sprites with a radial-gradient alpha texture.

const WISP_COUNT = 80;
const FUNNEL_HEIGHT = 24;
const BASE_R = 1.2;   // matches LAYERS[1].baseR
const TOP_R  = 5.5;   // matches LAYERS[1].topR

interface Wisp {
  originY: number;
  originAngle: number;
  age: number;
  lifetime: number;
  spinDir: number;
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

const WISP_VERT = `
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

const WISP_FRAG = `
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

function spawnWisp(w: Wisp) {
  w.originY = 4 + Math.random() * 14;
  w.originAngle = Math.random() * Math.PI * 2;
  w.age = 0;
  w.lifetime = 1.0 + Math.random() * 0.5;
  w.spinDir = Math.random() < 0.5 ? -1 : 1;
  w.size = 1.2 + Math.random() * 1.3;
}

export function VaporWisps() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const wisps = useMemo<Wisp[]>(() => {
    const arr: Wisp[] = [];
    for (let i = 0; i < WISP_COUNT; i++) {
      const w: Wisp = { originY: 0, originAngle: 0, age: 0, lifetime: 1, spinDir: 1, size: 1 };
      spawnWisp(w);
      w.age = Math.random() * w.lifetime; // stagger starting ages
      arr.push(w);
    }
    return arr;
  }, []);

  const { material, geometry, alphaArr, scaleArr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    const alphaArr = new Float32Array(WISP_COUNT);
    const scaleArr = new Float32Array(WISP_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
    const gradient = makeRadialGradientTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: WISP_VERT,
      fragmentShader: WISP_FRAG,
      uniforms: {
        gradientTex: { value: gradient },
        tint: { value: new THREE.Color('#d4d0cc') },
        globalOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
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
    matRef.current.uniforms.globalOpacity.value = ts.tornadoOpacity * 0.6;

    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i];
      w.age += dt;
      if (w.age > w.lifetime) spawnWisp(w);

      const ageNorm = w.age / w.lifetime;
      const radiusAtY = BASE_R + (w.originY / FUNNEL_HEIGHT) * (TOP_R - BASE_R) + 0.5;
      const angle = w.originAngle + w.age * w.spinDir * 1.5;
      const x = ts.tornadoX + Math.cos(angle) * radiusAtY + Math.sin(w.age * 4) * 0.4;
      const y = w.originY + w.age * 1.5;
      const z = ts.tornadoZ + Math.sin(angle) * radiusAtY + Math.cos(w.age * 4) * 0.4;

      const scale = w.size * (0.4 + w.age * 0.8);
      const alpha =
        smoothstep(0, 0.2, ageNorm) *
        (1 - smoothstep(0.5, 1, ageNorm));

      tmp.position.set(x, y, z);
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
      args={[geometry, material, WISP_COUNT]}
      frustumCulled={false}
      renderOrder={7}
    />
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
