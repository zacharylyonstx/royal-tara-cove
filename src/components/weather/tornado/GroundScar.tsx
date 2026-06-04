import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../../../state/tornadoStore';
import { makeRadialGradientTexture } from './vortex';

// The dark scoured path the funnel chews into the ground. As the tornado
// walks, it drops soft dark decals at its base; they linger and slowly fade,
// so you can SEE where it has been — a tapering trail of destruction behind
// the funnel. Pure aftermath/realism; no gameplay effect.

const SCAR_COUNT = 64;     // ring buffer of trail marks
const DROP_SPACING = 1.3;  // metres the funnel must move before dropping a mark
const SCAR_LIFETIME = 26;  // seconds for a mark to fully fade

interface Scar {
  x: number; z: number;
  bornAt: number;
  scale: number;
  rot: number;
  active: boolean;
}

const VERT = `
attribute float instanceAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = instanceAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D gradientTex;
uniform vec3 tint;
varying vec2 vUv;
varying float vAlpha;
void main() {
  float a = texture2D(gradientTex, vUv).a;
  gl_FragColor = vec4(tint, a * vAlpha);
}
`;

export function GroundScar() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const nextIdx = useRef(0);
  const lastDrop = useRef<{ x: number; z: number } | null>(null);

  const scars = useMemo<Scar[]>(
    () => Array.from({ length: SCAR_COUNT }, () => ({ x: 0, z: 0, bornAt: 0, scale: 1, rot: 0, active: false })),
    [],
  );

  const { geometry, material, alphaArr } = useMemo(() => {
    // Flat unit quad laid on the ground (XZ plane).
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.rotateX(-Math.PI / 2);
    const alphaArr = new Float32Array(SCAR_COUNT);
    geom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        gradientTex: { value: makeRadialGradientTexture() },
        tint: { value: new THREE.Color('#241c12') }, // dark churned earth
      },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2, // sit on top of the grass without z-fighting
    });
    return { geometry: geom, material: mat, alphaArr };
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const ts = useTornadoStore.getState();
    const mesh = meshRef.current;
    if (!mesh) return;
    const now = performance.now() / 1000;
    const onGround = ts.tornadoOpacity > 0.25;

    // Drop a new mark when the funnel has travelled far enough.
    if (onGround) {
      const fx = ts.tornadoX;
      const fz = ts.tornadoZ;
      const ld = lastDrop.current;
      if (!ld || Math.hypot(fx - ld.x, fz - ld.z) > DROP_SPACING) {
        const s = scars[nextIdx.current];
        s.x = fx + (Math.random() - 0.5) * 2;
        s.z = fz + (Math.random() - 0.5) * 2;
        s.bornAt = now;
        s.scale = 5 + Math.random() * 5;
        s.rot = Math.random() * Math.PI;
        s.active = true;
        nextIdx.current = (nextIdx.current + 1) % SCAR_COUNT;
        lastDrop.current = { x: fx, z: fz };
      }
    }

    let anyVisible = false;
    for (let i = 0; i < scars.length; i++) {
      const s = scars[i];
      const age = now - s.bornAt;
      const alpha = s.active ? Math.max(0, 1 - age / SCAR_LIFETIME) * 0.85 : 0;
      if (alpha <= 0.001) {
        alphaArr[i] = 0;
        tmp.position.set(0, -1000, 0);
        tmp.scale.setScalar(0);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        continue;
      }
      anyVisible = true;
      tmp.position.set(s.x, 0.04, s.z);
      tmp.rotation.set(0, s.rot, 0);
      tmp.scale.set(s.scale, 1, s.scale * 0.8);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      alphaArr[i] = alpha;
    }
    mesh.visible = anyVisible;
    mesh.instanceMatrix.needsUpdate = true;
    (geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, SCAR_COUNT]}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
