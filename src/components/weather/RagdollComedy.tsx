import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { cowMoo } from '../../audio';

// Comic debris that orbits the ragdolling player, swinging past the camera —
// a cow, a Santa, a trampoline. Only mounted while ragdoll.active is true.
// One audio cue ("moo") fires when the cow is closest to the camera.

type DebrisKind = 'cow' | 'santa' | 'trampoline';

interface DebrisItem {
  kind: DebrisKind;
  phase: number;        // angular offset around player
  radius: number;       // orbit distance
  yOffset: number;      // vertical offset
  speed: number;        // rad/s
  spin: number;         // self-spin rad/s
  mooed?: boolean;
}

export function RagdollComedy() {
  const groupRef = useRef<THREE.Group>(null);
  const cowRef = useRef<THREE.Group>(null);
  const santaRef = useRef<THREE.Group>(null);
  const trampRef = useRef<THREE.Group>(null);

  const items = useMemo<DebrisItem[]>(() => ([
    { kind: 'cow',        phase: 0,            radius: 6.5, yOffset: 0.4, speed: 1.4, spin: 2.0 },
    { kind: 'santa',      phase: Math.PI * 0.8, radius: 8.0, yOffset: 1.2, speed: 1.1, spin: -1.6 },
    { kind: 'trampoline', phase: Math.PI * 1.5, radius: 7.2, yOffset: -0.3, speed: 1.7, spin: 3.0 },
  ]), []);
  const mooedRef = useRef(false);

  useEffect(() => () => { mooedRef.current = false; }, []);

  useFrame(() => {
    const g = useGameStore.getState();
    const rag = g.ragdoll;
    const root = groupRef.current;
    if (!root) return;
    if (!rag || !rag.active) {
      root.visible = false;
      mooedRef.current = false;
      return;
    }
    root.visible = true;

    const _myId = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
    const player = g.positions[_myId];
    if (!player) return;

    const now = performance.now() / 1000;
    const t = now - rag.startedAt;

    root.position.set(player.x, player.y, player.z);

    const updateItem = (item: DebrisItem, ref: React.RefObject<THREE.Group | null>) => {
      const grp = ref.current;
      if (!grp) return;
      const ang = item.phase + t * item.speed;
      grp.position.set(
        Math.cos(ang) * item.radius,
        item.yOffset + Math.sin(t * 1.3 + item.phase) * 0.4,
        Math.sin(ang) * item.radius,
      );
      grp.rotation.set(t * item.spin * 0.5, t * item.spin, t * item.spin * 0.7);
    };

    updateItem(items[0], cowRef);
    updateItem(items[1], santaRef);
    updateItem(items[2], trampRef);

    // Trigger moo when cow first comes into the "front" half of the orbit
    if (!mooedRef.current && t > 0.6) {
      const ang = items[0].phase + t * items[0].speed;
      // Moo when cow is in the camera's forward arc (closest to player POV)
      if (Math.cos(ang) > 0.7) {
        mooedRef.current = true;
        cowMoo();
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={cowRef}>
        <Cow />
      </group>
      <group ref={santaRef}>
        <Santa />
      </group>
      <group ref={trampRef}>
        <Trampoline />
      </group>
    </group>
  );
}

function Cow() {
  // Low-poly Holstein: white body with black patches, pink udder, horns
  return (
    <group>
      {/* body */}
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.9, 0.85]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.9} />
      </mesh>
      {/* black patches */}
      <mesh position={[0.45, 0.2, 0.43]}>
        <boxGeometry args={[0.55, 0.38, 0.04]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.9} />
      </mesh>
      <mesh position={[-0.3, -0.05, -0.43]}>
        <boxGeometry args={[0.65, 0.5, 0.04]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.9} />
      </mesh>
      {/* head */}
      <mesh position={[0.9, 0.25, 0]} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.6]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.9} />
      </mesh>
      {/* snout */}
      <mesh position={[1.18, 0.05, 0]}>
        <boxGeometry args={[0.22, 0.3, 0.4]} />
        <meshStandardMaterial color="#e8b0a8" roughness={0.9} />
      </mesh>
      {/* horns */}
      <mesh position={[0.95, 0.6, 0.22]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.06, 0.22, 6]} />
        <meshStandardMaterial color="#e8e0c8" />
      </mesh>
      <mesh position={[0.95, 0.6, -0.22]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.06, 0.22, 6]} />
        <meshStandardMaterial color="#e8e0c8" />
      </mesh>
      {/* legs */}
      {[
        [0.5, -0.7, 0.3], [0.5, -0.7, -0.3], [-0.5, -0.7, 0.3], [-0.5, -0.7, -0.3],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color="#1c1c1c" />
        </mesh>
      ))}
      {/* udder */}
      <mesh position={[-0.1, -0.55, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#e8a8a0" />
      </mesh>
      {/* eyes */}
      <mesh position={[1.05, 0.4, 0.18]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[1.05, 0.4, -0.18]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

function Santa() {
  // Red coat, white trim, beard, hat
  return (
    <group>
      {/* body (red coat) */}
      <mesh castShadow>
        <cylinderGeometry args={[0.55, 0.65, 1.2, 12]} />
        <meshStandardMaterial color="#c8302a" roughness={0.85} />
      </mesh>
      {/* belt */}
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.18, 12]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* belt buckle */}
      <mesh position={[0, -0.45, 0.66]}>
        <boxGeometry args={[0.22, 0.18, 0.04]} />
        <meshStandardMaterial color="#e8c45a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <sphereGeometry args={[0.36, 12, 12]} />
        <meshStandardMaterial color="#f5d3b0" roughness={0.9} />
      </mesh>
      {/* beard */}
      <mesh position={[0, 0.65, 0.18]}>
        <sphereGeometry args={[0.32, 10, 10]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.95} />
      </mesh>
      {/* hat */}
      <mesh position={[0, 1.25, 0]} rotation={[0.2, 0, 0.15]}>
        <coneGeometry args={[0.34, 0.7, 12]} />
        <meshStandardMaterial color="#c8302a" />
      </mesh>
      {/* hat puff */}
      <mesh position={[0.08, 1.6, -0.04]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#f5f0e8" />
      </mesh>
      {/* arms */}
      <mesh position={[-0.65, 0.15, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 8]} />
        <meshStandardMaterial color="#c8302a" />
      </mesh>
      <mesh position={[0.65, 0.15, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 8]} />
        <meshStandardMaterial color="#c8302a" />
      </mesh>
    </group>
  );
}

function Trampoline() {
  // Black mat ringed with blue safety pad
  return (
    <group>
      {/* outer pad */}
      <mesh castShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.12, 24]} />
        <meshStandardMaterial color="#3a6db0" roughness={0.85} />
      </mesh>
      {/* mat */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.04, 24]} />
        <meshStandardMaterial color="#0e0e10" />
      </mesh>
      {/* legs */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 1.2, -0.45, Math.sin(a) * 1.2]}
          rotation={[Math.PI / 12, 0, Math.cos(a) * 0.3]}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.9, 6]} />
          <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
