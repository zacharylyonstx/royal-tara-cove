import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PomCoat } from '../../world/pets';

// A hand-built, fully animated Pomeranian: one big ball of fluff with a fox
// face, pricked ears, tiny legs and a plume of a tail curled over its back.
// Procedural (not a GLB) on purpose — every part moves: the tail wags, the
// legs scurry, the ears twitch, the tongue pants — and each coat variety is
// just a palette. Faces −Z (the game's "forward"), stands on y = 0, ~0.52 m
// tall at scale 1.

export interface PomPalette {
  body: string;   // main coat
  ruff: string;   // chest + mane
  face: string;   // muzzle + cheeks
  ears: string;
  tail: string;
  legs: string;
  brow: string | null; // black-and-tan eyebrow dots
}

export const POM_COATS: Record<PomCoat, PomPalette> = {
  orange:   { body: '#e58a2e', ruff: '#f6c98a', face: '#f8dcae', ears: '#c96f1e', tail: '#f3b660', legs: '#e9a04a', brow: null },
  white:    { body: '#f7f2e8', ruff: '#ffffff', face: '#fffdf8', ears: '#ece3d2', tail: '#ffffff', legs: '#f3ede0', brow: null },
  blacktan: { body: '#2a2422', ruff: '#3b302b', face: '#c98a4a', ears: '#1c1817', tail: '#332a26', legs: '#c98a4a', brow: '#d39a58' },
};

/** Driven by the owner component each frame (plain mutable object, no re-renders). */
export interface PomAnim {
  /** Trotting / running. */
  moving: boolean;
  /** 0..1 — how fast the legs scurry. */
  pace: number;
  /** Being petted, mid-trick, or just adopted: tail goes wild, tongue out. */
  excited: boolean;
}

export function Pomeranian({ coat, scale = 1, anim }: { coat: PomCoat; scale?: number; anim: PomAnim }) {
  const pal = POM_COATS[coat];
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tongue = useRef<THREE.Mesh>(null);
  const earL = useRef<THREE.Mesh>(null);
  const earR = useRef<THREE.Mesh>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const fluff = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 10, []);

  // Shared low-poly "fluff" geometry: a slightly lumpy icosphere so the coat
  // reads as tufts, flat-shaded to match the game's faceted look.
  const fluffGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.07 * Math.sin(x * 9.1 + y * 7.3) * Math.cos(z * 8.7 + x * 3.1);
      p.setXYZ(i, x * n, y * n, z * n);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mats = useMemo(() => {
    const m = (c: string, rough = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, flatShading: true });
    return {
      body: m(pal.body), ruff: m(pal.ruff), face: m(pal.face), ears: m(pal.ears), tail: m(pal.tail), legs: m(pal.legs),
      dark: new THREE.MeshStandardMaterial({ color: '#141011', roughness: 0.35 }),
      pink: new THREE.MeshStandardMaterial({ color: '#f08aa0', roughness: 0.6 }),
      glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      brow: pal.brow ? m(pal.brow) : null,
    };
  }, [pal]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const wagSpeed = anim.excited ? 22 : anim.moving ? 13 : 7;
    const wagAmp = anim.excited ? 0.75 : anim.moving ? 0.4 : 0.28;
    if (tail.current) {
      tail.current.rotation.z = Math.sin(t * wagSpeed) * wagAmp;
      tail.current.rotation.x = -0.15 + Math.sin(t * 2.1) * 0.05;
    }
    if (head.current) {
      // Curious head tilts when idle; bobs along when trotting.
      head.current.rotation.z = anim.moving ? 0 : Math.sin(t * 0.9) * 0.16 * (Math.sin(t * 0.23) > 0.2 ? 1 : 0.25);
      head.current.rotation.x = anim.moving ? Math.sin(t * 16) * 0.05 : Math.sin(t * 1.3) * 0.04;
      head.current.position.y = 0.45 + (anim.moving ? Math.abs(Math.sin(t * 16)) * 0.012 : 0);
    }
    if (tongue.current) {
      const pant = anim.excited || anim.moving ? 1 : 0.45;
      tongue.current.scale.y = 0.7 + Math.abs(Math.sin(t * 9)) * 0.6 * pant;
      tongue.current.position.y = -0.085 - tongue.current.scale.y * 0.012;
    }
    const twitch = Math.sin(t * 0.7) > 0.96 ? Math.sin(t * 40) * 0.25 : 0;
    if (earL.current) earL.current.rotation.z = 0.22 + twitch;
    if (earR.current) earR.current.rotation.z = -0.22 - twitch * 0.6;
    // Tiny legs, big hurry: diagonal pairs scurry in opposite phase.
    const rate = 14 + anim.pace * 12;
    for (let i = 0; i < 4; i++) {
      const leg = legs.current[i];
      if (!leg) continue;
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.x = anim.moving ? Math.sin(t * rate + phase) * (0.55 + anim.pace * 0.35) : 0;
    }
    // The whole coat breathes + jiggles a little.
    if (fluff.current) {
      const j = anim.moving ? Math.abs(Math.sin(t * rate)) * 0.02 : 0;
      fluff.current.scale.set(1 + Math.sin(t * 2.4) * 0.012, 1 + Math.sin(t * 2.4 + 1) * 0.02 + j, 1 + Math.sin(t * 2.4) * 0.012);
    }
  });

  const legPos: [number, number][] = [[-0.085, -0.11], [0.085, -0.11], [-0.085, 0.12], [0.085, 0.12]];

  return (
    <group scale={scale}>
      {/* legs + paws */}
      {legPos.map(([x, z], i) => (
        <group key={i} ref={(g) => { legs.current[i] = g; }} position={[x, 0.15, z]}>
          <mesh position={[0, -0.07, 0]} material={mats.legs} castShadow>
            <cylinderGeometry args={[0.036, 0.03, 0.14, 7]} />
          </mesh>
          <mesh position={[0, -0.135, -0.012]} material={mats.legs} castShadow>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
      ))}

      <group ref={fluff}>
        {/* body: the pompom */}
        <mesh geometry={fluffGeo} material={mats.body} position={[0, 0.3, 0.03]} scale={[0.215, 0.2, 0.25]} castShadow />
        {/* rump + britches */}
        <mesh geometry={fluffGeo} material={mats.body} position={[0, 0.27, 0.17]} scale={[0.185, 0.17, 0.16]} castShadow />
        {/* chest ruff / mane (lighter) */}
        <mesh geometry={fluffGeo} material={mats.ruff} position={[0, 0.3, -0.14]} scale={[0.19, 0.185, 0.15]} castShadow />
        <mesh geometry={fluffGeo} material={mats.body} position={[0, 0.4, -0.1]} scale={[0.19, 0.14, 0.15]} castShadow />
      </group>

      {/* tail: a plume curled up and over the back */}
      <group ref={tail} position={[0, 0.4, 0.2]}>
        <mesh geometry={fluffGeo} material={mats.tail} position={[0, 0.06, 0.0]} scale={[0.085, 0.1, 0.085]} castShadow />
        <mesh geometry={fluffGeo} material={mats.tail} position={[0, 0.16, -0.05]} scale={[0.105, 0.105, 0.1]} castShadow />
        <mesh geometry={fluffGeo} material={mats.tail} position={[0, 0.2, -0.15]} scale={[0.09, 0.085, 0.1]} castShadow />
      </group>

      {/* head */}
      <group ref={head} position={[0, 0.45, -0.25]}>
        <mesh geometry={fluffGeo} material={mats.body} scale={[0.135, 0.125, 0.125]} castShadow />
        {/* cheek fluff */}
        <mesh geometry={fluffGeo} material={mats.face} position={[-0.085, -0.035, -0.02]} scale={[0.075, 0.07, 0.07]} />
        <mesh geometry={fluffGeo} material={mats.face} position={[0.085, -0.035, -0.02]} scale={[0.075, 0.07, 0.07]} />
        {/* little fox muzzle */}
        <mesh material={mats.face} position={[0, -0.04, -0.115]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.052, 0.085, 8]} />
        </mesh>
        <mesh material={mats.dark} position={[0, -0.025, -0.165]}>
          <sphereGeometry args={[0.022, 8, 8]} />
        </mesh>
        {/* smile line + panting tongue */}
        <mesh ref={tongue} material={mats.pink} position={[0, -0.09, -0.135]}>
          <boxGeometry args={[0.03, 0.03, 0.012]} />
        </mesh>
        {/* eyes with a sparkle */}
        {[-0.052, 0.052].map((x) => (
          <group key={x} position={[x, 0.022, -0.108]}>
            <mesh material={mats.dark}><sphereGeometry args={[0.021, 10, 10]} /></mesh>
            <mesh material={mats.glint} position={[0.006, 0.008, -0.016]}><sphereGeometry args={[0.006, 6, 6]} /></mesh>
          </group>
        ))}
        {/* black & tan eyebrow dots */}
        {mats.brow && [-0.05, 0.05].map((x) => (
          <mesh key={x} material={mats.brow!} position={[x, 0.062, -0.1]}><sphereGeometry args={[0.014, 6, 6]} /></mesh>
        ))}
        {/* pricked ears */}
        <mesh ref={earL} material={mats.ears} position={[-0.07, 0.115, 0.01]} castShadow>
          <coneGeometry args={[0.04, 0.085, 5]} />
        </mesh>
        <mesh ref={earR} material={mats.ears} position={[0.07, 0.115, 0.01]} castShadow>
          <coneGeometry args={[0.04, 0.085, 5]} />
        </mesh>
        <mesh material={mats.pink} position={[-0.07, 0.108, -0.012]} rotation={[0, 0, 0.22]}>
          <coneGeometry args={[0.02, 0.05, 4]} />
        </mesh>
        <mesh material={mats.pink} position={[0.07, 0.108, -0.012]} rotation={[0, 0, -0.22]}>
          <coneGeometry args={[0.02, 0.05, 4]} />
        </mesh>
      </group>
    </group>
  );
}
