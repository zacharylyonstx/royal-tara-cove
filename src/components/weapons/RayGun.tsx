import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, PointLight, Mesh } from 'three';
import { useGameStore } from '../../state/gameStore';
import { useCombatStore } from '../../state/combatStore';

const HAND_X = 0.35;   // hand offset to the right (in player local)
const HAND_Z = -0.25;  // forward, just in front of the chest
const GUN_Y = 1.05;

/**
 * The active character's ray gun. Lives in the scene root but its group ref
 * is updated every frame to track the active character's hand position. The
 * orientation is `playerYaw` so the barrel points where the character faces.
 *
 * The muzzle flash is also rendered here (rather than as a separate component)
 * so it can stay glued to the gun tip.
 */
export function RayGun() {
  const groupRef = useRef<Group>(null);
  const muzzleRef = useRef<Group>(null);
  const muzzleLight = useRef<PointLight>(null);
  const muzzleDisc = useRef<Mesh>(null);
  const lastPos = useRef({ x: 0, z: 0 });
  const bobPhase = useRef(0);
  const beams = useCombatStore((s) => s.beams);
  const phase = useGameStore((s) => s.phase);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);

  // Track most-recent beam time for muzzle flash fade.
  const lastFireAt = useRef(-999);
  useEffect(() => {
    if (beams.length === 0) return;
    const latest = beams[beams.length - 1];
    lastFireAt.current = latest.spawnedAt;
  }, [beams]);

  useFrame((state, dtRaw) => {
    const g = groupRef.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.1);
    // FPS: hide own weapon (you're holding it but can't see your hands).
    // Show Dad's gun to other characters when Dad is an NPC.
    if (phase !== 'combat' || activeId === 'dad' || useGameStore.getState().gameMode !== 'aliens') {
      g.visible = false;
      return;
    }
    g.visible = true;

    const pos = positions[activeId];
    const yaw = yaws[activeId];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const wx = pos.x + HAND_X * cy + HAND_Z * sy;
    const wz = pos.z - HAND_X * sy + HAND_Z * cy;

    // Speed-based bob
    const sp = Math.hypot(pos.x - lastPos.current.x, pos.z - lastPos.current.z) / Math.max(dt, 0.001);
    lastPos.current.x = pos.x;
    lastPos.current.z = pos.z;
    bobPhase.current += dt * Math.min(12, 4 + sp);
    const bob = Math.sin(bobPhase.current) * Math.min(0.05, sp * 0.01);

    g.position.set(wx, GUN_Y + bob, wz);
    g.rotation.set(0, yaw, 0);

    // Muzzle flash fade
    const now = state.clock.elapsedTime;
    const since = now - lastFireAt.current;
    const flash = Math.max(0, 1 - since / 0.09);
    if (muzzleLight.current) muzzleLight.current.intensity = flash * 4.5;
    if (muzzleDisc.current) {
      muzzleDisc.current.scale.setScalar(0.5 + flash * 0.9);
      const mat = muzzleDisc.current.material as THREE.Material & { opacity?: number };
      if (mat) mat.opacity = flash;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* grip */}
      <mesh position={[0, -0.08, 0.05]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.2, 0.1]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.7} />
      </mesh>
      {/* trigger guard */}
      <mesh position={[0, -0.04, 0.0]} castShadow>
        <torusGeometry args={[0.05, 0.012, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#2a2a2c" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* receiver */}
      <mesh position={[0, 0.04, -0.06]} castShadow>
        <boxGeometry args={[0.12, 0.14, 0.22]} />
        <meshStandardMaterial color="#3a3a40" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* barrel */}
      <mesh position={[0, 0.06, -0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.058, 0.44, 14]} />
        <meshStandardMaterial color="#8a8a92" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* power coils around the barrel */}
      {[-0.18, -0.32, -0.46].map((z, i) => (
        <mesh key={i} position={[0, 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.075, 0.012, 8, 14]} />
          <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {/* glowing tip / muzzle */}
      <mesh position={[0, 0.06, -0.5]}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={1.4} />
      </mesh>
      {/* sight */}
      <mesh position={[0, 0.13, -0.08]} castShadow>
        <boxGeometry args={[0.03, 0.06, 0.05]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* energy cell on top */}
      <mesh position={[0, 0.14, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.16]} />
        <meshStandardMaterial color="#a0e84a" emissive="#a0e84a" emissiveIntensity={0.6} />
      </mesh>

      {/* Muzzle flash (light + disc), fades after each shot */}
      <group ref={muzzleRef} position={[0, 0.06, -0.55]}>
        <pointLight ref={muzzleLight} color="#3afff0" intensity={0} distance={4} decay={2} />
        <mesh ref={muzzleDisc} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.06, 0.16, 16]} />
          <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={2} transparent opacity={0} side={2} />
        </mesh>
      </group>
    </group>
  );
}
