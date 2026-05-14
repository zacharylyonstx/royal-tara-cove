import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { BLOB_COLORS, type Blob } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

interface BlobProps {
  blob: Blob;
}

export function Schmorgesblob({ blob }: BlobProps) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const leftEye = useRef<Group>(null);
  const rightEye = useRef<Group>(null);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const color = BLOB_COLORS[blob.variant];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current || !blob.alive) return;
    group.current.position.set(blob.x, blob.y, blob.z);

    // Wobble: vertical squash sine, antiphase horizontal
    const wob = Math.sin(t * 6 + blob.phase) * 0.12;
    if (body.current) {
      body.current.scale.set(1 - wob * 0.6, 1 + wob, 1 - wob * 0.6);
      const sinceDamage = t - blob.lastDamagedAt;
      const flash = sinceDamage < 0.15 ? 1 : 0;
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      if (mat && mat.color) {
        if (flash > 0.5) mat.color.set('#ff4040');
        else mat.color.set(color.body);
      }
    }
    // Eyes track active character
    const player = positions[activeId];
    const dx = player.x - blob.x;
    const dz = player.z - blob.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.01 && leftEye.current && rightEye.current) {
      const ux = dx / len;
      const uz = dz / len;
      const offset = 0.06;
      leftEye.current.position.x = -0.18 + ux * offset;
      leftEye.current.position.z = 0.36 + uz * offset;
      rightEye.current.position.x = 0.18 + ux * offset;
      rightEye.current.position.z = 0.36 + uz * offset;
    }
  });

  if (!blob.alive) return null;
  return (
    <group ref={group} position={[blob.x, blob.y, blob.z]}>
      {/* gel body */}
      <mesh ref={body} castShadow>
        <sphereGeometry args={[0.45, 18, 14]} />
        <meshPhysicalMaterial
          color={color.body}
          roughness={0.25}
          transmission={0.25}
          thickness={0.4}
          ior={1.4}
          emissive={color.body}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* eyes */}
      <group ref={leftEye} position={[-0.18, 0.18, 0.36]}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 10, 10]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
      </group>
      <group ref={rightEye} position={[0.18, 0.18, 0.36]}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 10, 10]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
      </group>
      {/* little antenna */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
        <meshStandardMaterial color={color.glow} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={0.6} />
      </mesh>
      {/* subtle ground glow */}
      <pointLight position={[0, 0.1, 0]} color={color.body} intensity={0.25} distance={2.5} decay={2} />
    </group>
  );
}

export function GooSplat({ x, z, variant, spawnedAt }: { x: number; z: number; variant: number; spawnedAt: number }) {
  const c = BLOB_COLORS[variant];
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const ageRel = (performance.now() / 1000 - spawnedAt) / 12;
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = Math.max(0, 1 - ageRel);
    }
  });
  void THREE;
  return (
    <mesh ref={ref} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.6, 16]} />
      <meshStandardMaterial color={c.body} roughness={0.7} transparent opacity={1} />
    </mesh>
  );
}
