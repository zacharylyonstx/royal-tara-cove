import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { BLOB_COLOR_FOR_KIND, type Blob } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';

interface Props {
  blob: Blob;
}

/**
 * The boss schmorgesblob — a giant translucent dome with three eyes,
 * a crown of glowing spikes, four tentacles, and a giant maw underneath.
 * Visual only; AI lives in BlobController.
 */
export function BossBlob({ blob }: Props) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const crown = useRef<Group>(null);
  const eyes = useRef<Group[]>([]);
  const tentacles = useRef<Group[]>([]);
  const positions = useGameStore((s) => s.positions);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const activeId = myCharacterId ?? fallbackActive;
  const color = BLOB_COLOR_FOR_KIND('boss', 0);
  const baseColor = new THREE.Color(color.body);
  const damageColor = new THREE.Color('#ff4040');
  const hpRatio = blob.hp / blob.maxHp;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.set(blob.x, blob.y, blob.z);
    group.current.scale.setScalar(blob.scale);

    if (!blob.alive) {
      const age = t - blob.deathAt;
      const k = Math.max(0, Math.min(1, age / 1.0));
      const s = blob.scale * (1 - k);
      group.current.scale.set(s, s * 0.3, s);
      group.current.visible = age < 1.1;
      return;
    }
    group.current.visible = true;

    if (body.current) {
      const wob = Math.sin(t * 3 + blob.phase) * 0.07;
      body.current.scale.set(1 - wob * 0.4, 1 + wob, 1 - wob * 0.4);
      const flash = Math.max(0, 1 - (t - blob.lastDamagedAt) / 0.18);
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      if (mat?.color) mat.color.copy(baseColor).lerp(damageColor, flash);
    }

    if (crown.current) {
      crown.current.rotation.y += 0.02;
    }

    const player = positions[activeId];
    const dx = player.x - blob.x;
    const dz = player.z - blob.z;
    const dist = Math.hypot(dx, dz);
    const ux = dist > 0 ? dx / dist : 0;
    const uz = dist > 0 ? dz / dist : 1;
    eyes.current.forEach((eye) => {
      if (!eye) return;
      eye.children.forEach((child, idx) => {
        if (idx === 1) {
          child.position.x = ux * 0.06;
          child.position.z = uz * 0.06;
        }
      });
    });

    tentacles.current.forEach((tg, i) => {
      if (!tg) return;
      tg.rotation.x = Math.sin(t * 2.5 + i * 1.2) * 0.4;
      tg.rotation.z = Math.cos(t * 2.5 + i * 1.2) * 0.4;
    });
  });

  if (!blob.alive && performance.now() / 1000 - blob.deathAt > 1.2) return null;

  return (
    <group ref={group} position={[blob.x, blob.y, blob.z]} scale={blob.scale}>
      {/* Giant body — dome */}
      <mesh ref={body} position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.8, 18, 14]} />
        <meshStandardMaterial
          color={color.body}
          roughness={0.3}
          emissive={color.body}
          emissiveIntensity={0.6}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Crown of spikes */}
      <group ref={crown} position={[0, 0.85, 0]}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]} rotation={[0, -a, 0]}>
              <mesh castShadow>
                <coneGeometry args={[0.08, 0.36, 6]} />
                <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={1.1} metalness={0.5} />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* Three eyes vertically stacked */}
      {[0.5, 0.25, 0.0].map((y, i) => (
        <group
          key={i}
          ref={(el) => { if (el) eyes.current[i] = el; }}
          position={[0, y, 0.7]}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#f5ecd9" />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#1a1a1c" />
          </mesh>
        </group>
      ))}
      {/* Giant maw on the underside */}
      <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.3, 0.08, 8, 18]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, -0.45, Math.sin(a) * 0.3]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[0.04, 0.12, 4]} />
            <meshStandardMaterial color="#f5ecd9" />
          </mesh>
        );
      })}
      {/* Four big tentacles */}
      {[
        { x: -0.6, z: -0.3, refIdx: 0 },
        { x: 0.6, z: -0.3, refIdx: 1 },
        { x: -0.5, z: 0.5, refIdx: 2 },
        { x: 0.5, z: 0.5, refIdx: 3 },
      ].map((t) => (
        <group
          key={t.refIdx}
          position={[t.x, -0.5, t.z]}
          ref={(el) => { if (el) tentacles.current[t.refIdx] = el; }}
        >
          <mesh position={[0, -0.5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.06, 1.0, 8]} />
            <meshStandardMaterial color={color.body} emissive={color.body} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, -1.0, 0]} castShadow>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      {/* Heavy ground glow */}
      <pointLight position={[0, 0.1, 0]} color={color.body} intensity={1.2} distance={6} decay={2} />
      {/* HP bar floating above */}
      <group position={[0, 1.6, 0]}>
        <mesh>
          <boxGeometry args={[1.2, 0.1, 0.05]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
        <mesh position={[-(0.6 - hpRatio * 0.6), 0, 0.03]}>
          <boxGeometry args={[1.2 * hpRatio, 0.07, 0.04]} />
          <meshStandardMaterial color="#ff5a3a" emissive="#ff5a3a" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}
