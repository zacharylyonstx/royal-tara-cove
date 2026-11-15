import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { useHideSeekStore } from '../../state/hideSeekStore';
import { HS_BASE, HS_BOUNDS, HS_COUNT_S } from '../../world/hideSeek';
import { CHARACTERS } from '../../world/characters';
import type { CharacterId } from '../../types';

const FIELD_H = 11;

/** Hide-and-seek's bits of the world: the Home Base sign at the oak, the force
 *  field around the play area, the count over the seeker's head and the
 *  sparkle when someone's found. */
export function HideSeekWorld() {
  return (
    <>
      <HomeBaseSign />
      <ForceField />
      <SeekerCount />
      <FoundBurst />
    </>
  );
}

// ------------------------------------------------------------- the sign ----

function signTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d')!;
  // Painted plank board
  g.fillStyle = '#f4e3b8';
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = 'rgba(120, 84, 40, 0.25)';
  g.lineWidth = 2;
  for (const y of [106, 212]) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.strokeStyle = '#7a4f24';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 498, 306);
  g.textAlign = 'center';
  g.fillStyle = '#b3262d';
  g.font = '900 78px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
  g.fillText('HOME BASE', 256, 104);
  g.fillStyle = '#2f4f2a';
  g.font = '800 50px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
  g.fillText('🙈 Hide & Seek', 256, 184);
  g.fillStyle = '#5a3c1a';
  g.font = '700 34px "Helvetica Neue", Arial, sans-serif';
  g.fillText('count here to play!', 256, 262);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function HomeBaseSign() {
  const tex = useMemo(() => signTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  const ring = useRef<THREE.Mesh>(null);
  const idle = useHideSeekStore((s) => s.phase === 'idle' || s.phase === 'results');
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = (clock.elapsedTime * 0.45) % 1;
    ring.current.scale.setScalar(1 + k * 0.9);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
  });
  // Planted on the street side of the oak, facing the cul-de-sac.
  return (
    <group position={[HS_BASE.x - 2.3, 0, HS_BASE.z - 1.5]} rotation={[0, Math.PI + 0.35, 0]}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.12, 1.5, 0.12]} />
        <meshStandardMaterial color="#7a4f24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.42, 0.07]} castShadow>
        <boxGeometry args={[1.5, 0.94, 0.07]} />
        <meshStandardMaterial color="#7a4f24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.42, 0.112]}>
        <planeGeometry args={[1.42, 0.86]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      {/* A soft ripple on the grass while a game can be started. */}
      {idle && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0.9]}>
          <ringGeometry args={[1.25, 1.5, 40]} />
          <meshBasicMaterial color="#ffd866" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// -------------------------------------------------------- the force field --

const FIELD_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FIELD_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uShow;
  uniform vec3 uPlayer;
  varying vec3 vWorld;
  void main() {
    float along = vWorld.x + vWorld.z;
    float h = vWorld.y;
    // Brighter where I am, a faint shimmer far away.
    float near = smoothstep(30.0, 3.0, distance(vWorld.xz, uPlayer.xz));
    // A slow diamond lattice sliding up the wall…
    float a = abs(fract((along + h) * 0.45 - uTime * 0.07) - 0.5);
    float b = abs(fract((along - h) * 0.45 + uTime * 0.05) - 0.5);
    float lattice = smoothstep(0.455, 0.5, max(a, b));
    // …and a band of light that sweeps up it every few seconds.
    float sweep = smoothstep(0.0, 0.5, 1.0 - abs(fract(h * 0.09 - uTime * 0.22) - 0.5) * 2.0);
    float top = 1.0 - smoothstep(${(FIELD_H * 0.35).toFixed(1)}, ${FIELD_H.toFixed(1)}, h);
    vec3 col = mix(vec3(0.25, 0.95, 1.0), vec3(1.0, 0.45, 0.85), 0.5 + 0.5 * sin(along * 0.07 + uTime * 0.5));
    float alpha = (0.06 + 0.09 * near + lattice * (0.14 + 0.42 * near) + sweep * 0.06) * top * uShow;
    gl_FragColor = vec4(col, alpha);
  }
`;

function ForceField() {
  const live = useHideSeekStore((s) => s.phase === 'counting' || s.phase === 'seeking');
  const group = useRef<THREE.Group>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FIELD_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uPlayer: { value: new THREE.Vector3() } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }, dt) => {
    const u = material.uniforms;
    const target = live ? 1 : 0;
    u.uShow.value += (target - u.uShow.value) * Math.min(1, dt * 3);
    if (group.current) group.current.visible = u.uShow.value > 0.01;
    if (!group.current?.visible) return;
    u.uTime.value = clock.elapsedTime;
    const g = useGameStore.getState();
    const me = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
    (u.uPlayer.value as THREE.Vector3).copy(g.positions[me]);
  });

  const { minX, maxX, minZ, maxZ } = HS_BOUNDS;
  const w = maxX - minX, d = maxZ - minZ;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  return (
    <group ref={group} visible={false}>
      <mesh material={material} position={[cx, FIELD_H / 2, minZ]}><planeGeometry args={[w, FIELD_H]} /></mesh>
      <mesh material={material} position={[cx, FIELD_H / 2, maxZ]}><planeGeometry args={[w, FIELD_H]} /></mesh>
      <mesh material={material} position={[minX, FIELD_H / 2, cz]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[d, FIELD_H]} /></mesh>
      <mesh material={material} position={[maxX, FIELD_H / 2, cz]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[d, FIELD_H]} /></mesh>
    </group>
  );
}

// ------------------------------------------- the count over the seeker ----

/** Hiders can see the seeker counting ("🙈 12") from across the yard. */
function SeekerCount() {
  const phase = useHideSeekStore((s) => s.phase);
  const seeker = useHideSeekStore((s) => s.seeker);
  const me = useNetStore((s) => s.myCharacterId);
  const group = useRef<THREE.Group>(null);
  const [n, setN] = useState(HS_COUNT_S);
  const show = phase === 'counting' && !!seeker && seeker !== me;
  useFrame(() => {
    if (!show || !seeker) return;
    const p = useGameStore.getState().positions[seeker];
    if (group.current) group.current.position.set(p.x, p.y + CHARACTERS[seeker].height + 0.95, p.z);
    const left = Math.max(0, Math.ceil(useHideSeekStore.getState().endsAt - performance.now() / 1000));
    if (left !== n) setN(left);
  });
  if (!show) return null;
  return (
    <group ref={group}>
      <Html center distanceFactor={13} zIndexRange={[80, 0]}>
        <div style={{
          background: 'rgba(28, 22, 60, 0.9)', color: '#fff', padding: '4px 14px', borderRadius: 16,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 30, fontWeight: 900, whiteSpace: 'nowrap', border: '3px solid #ffd866', pointerEvents: 'none',
        }}>
          🙈 {n}
        </div>
      </Html>
    </group>
  );
}

// ------------------------------------------------------- found sparkle ----

const BURST_S = 1.5;
const SPARKS = 22;

function FoundBurst() {
  const lastFound = useHideSeekStore((s) => s.lastFound);
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const points = useRef<THREE.Points>(null);
  const live = useRef<{ who: CharacterId; at: number } | null>(null);
  const dirs = useMemo(() => {
    const a = new Float32Array(SPARKS * 3);
    for (let i = 0; i < SPARKS; i++) {
      const th = (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.4;
      a[i * 3] = Math.cos(th) * (0.6 + (i % 4) * 0.25);
      a[i * 3 + 1] = 1.4 + (i % 5) * 0.45;
      a[i * 3 + 2] = Math.sin(th) * (0.6 + (i % 4) * 0.25);
    }
    return a;
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    return g;
  }, []);
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => {
    if (lastFound) live.current = { who: lastFound.who, at: lastFound.at };
  }, [lastFound]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const b = live.current;
    const age = b ? performance.now() / 1000 - b.at : 99;
    if (!b || age > BURST_S || age < 0) { g.visible = false; return; }
    g.visible = true;
    const p = useGameStore.getState().positions[b.who];
    g.position.set(p.x, p.y, p.z);
    const k = age / BURST_S;
    if (ring.current) {
      ring.current.scale.setScalar(0.4 + k * 3.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
    const arr = geom.attributes.position.array as Float32Array;
    for (let i = 0; i < SPARKS; i++) {
      arr[i * 3] = dirs[i * 3] * age * 1.6;
      arr[i * 3 + 1] = 0.9 + dirs[i * 3 + 1] * age - 2.6 * age * age;
      arr[i * 3 + 2] = dirs[i * 3 + 2] * age * 1.6;
    }
    geom.attributes.position.needsUpdate = true;
    if (points.current) (points.current.material as THREE.PointsMaterial).opacity = 1 - k * k;
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[0.8, 1.0, 36]} />
        <meshBasicMaterial color="#ffd866" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <points ref={points} geometry={geom} frustumCulled={false}>
        <pointsMaterial color="#fff2a8" size={0.22} sizeAttenuation transparent opacity={1} depthWrite={false} />
      </points>
    </group>
  );
}
