import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { BLOB_COLORS, type Blob } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

interface BlobProps {
  blob: Blob;
}

/**
 * A schmorgesblob is a multi-part rig:
 *   - body (translucent gel)
 *   - inner glow core (pulses; the "weak spot")
 *   - 2 spike antennae (for menace + glow)
 *   - 2 googly eyes that track the active player
 *   - downturned mouth that opens when telegraphing an attack
 *   - 3 wiggly tentacles dropping from the underside
 *
 * Animation states are computed each frame from the blob's runtime data:
 *   - idle (default): bob + wobble
 *   - hop (driven externally by BlobController setting blob.y arc)
 *   - damaged (red flash): blob.lastDamagedAt within 0.15s of now
 *   - dying (after kill, until cleanup): scale collapses to zero
 */
export function Schmorgesblob({ blob }: BlobProps) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);
  const leftEye = useRef<Group>(null);
  const rightEye = useRef<Group>(null);
  const mouth = useRef<Mesh>(null);
  const tentacles = useRef<Group[]>([]);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const color = BLOB_COLORS[blob.variant];
  const baseColor = new THREE.Color(color.body);
  const damageColor = new THREE.Color('#ff3a3a');

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.set(blob.x, blob.y, blob.z);

    const player = positions[activeId];
    const dx = player.x - blob.x;
    const dz = player.z - blob.z;
    const dist = Math.hypot(dx, dz);
    const ux = dist > 0 ? dx / dist : 0;
    const uz = dist > 0 ? dz / dist : 1;

    // Attack telegraph: when very close to player and about to hit
    const isAttacking = dist < 1.5;

    // Dying: collapse over 0.4s
    if (!blob.alive) {
      const age = t - blob.deathAt;
      const k = Math.max(0, Math.min(1, age / 0.4));
      const s = 1 - k;
      group.current.scale.set(s, s * 0.5, s);
      group.current.visible = age < 0.45;
      return;
    }
    group.current.visible = true;
    group.current.scale.set(1, 1, 1);

    // Body wobble + bob
    const wob = Math.sin(t * 6 + blob.phase) * 0.12;
    if (body.current) {
      const sx = isAttacking ? 1.18 - wob * 0.3 : 1 - wob * 0.55;
      const sy = isAttacking ? 0.7 + wob * 0.3 : 1 + wob;
      body.current.scale.set(sx, sy, sx);
      const sinceDamage = t - blob.lastDamagedAt;
      const flash = sinceDamage < 0.15 ? Math.max(0, 1 - sinceDamage / 0.15) : 0;
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      if (mat?.color) {
        mat.color.copy(baseColor).lerp(damageColor, flash);
      }
    }

    // Core pulse — faster when attacking
    if (core.current) {
      const pulseFreq = isAttacking ? 8 : 3;
      const pulse = 0.7 + Math.abs(Math.sin(t * pulseFreq + blob.phase)) * 0.6;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = pulse * (isAttacking ? 1.6 : 1.0);
      core.current.scale.setScalar(0.18 + Math.sin(t * pulseFreq) * 0.02);
    }

    // Eyes track player (offset pupils)
    const pupilOffset = 0.06;
    if (leftEye.current && rightEye.current) {
      leftEye.current.children.forEach((child, idx) => {
        if (idx === 1) {
          child.position.x = ux * pupilOffset;
          child.position.z = uz * pupilOffset;
        }
      });
      rightEye.current.children.forEach((child, idx) => {
        if (idx === 1) {
          child.position.x = ux * pupilOffset;
          child.position.z = uz * pupilOffset;
        }
      });
    }

    // Mouth opens when attacking
    if (mouth.current) {
      const open = isAttacking ? 1 : 0;
      mouth.current.rotation.x = -0.4 - open * 0.6;
      mouth.current.scale.y = 1 + open * 1.2;
    }

    // Tentacles wiggle
    tentacles.current.forEach((tg, i) => {
      if (!tg) return;
      const phase = blob.phase + i * 1.7;
      tg.rotation.x = Math.sin(t * 4 + phase) * 0.3;
      tg.rotation.z = Math.cos(t * 4 + phase) * 0.3;
    });
  });

  if (!blob.alive && performance.now() / 1000 - blob.deathAt > 0.5) return null;

  return (
    <group ref={group} position={[blob.x, blob.y, blob.z]}>
      {/* Body */}
      <mesh ref={body} castShadow>
        <sphereGeometry args={[0.5, 22, 16]} />
        <meshPhysicalMaterial
          color={color.body}
          roughness={0.25}
          transmission={0.32}
          thickness={0.45}
          ior={1.4}
          emissive={color.body}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* Inner glow core (weak spot) */}
      <mesh ref={core} position={[0, 0, 0]}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={1.0} />
      </mesh>
      {/* Antennae (two angled spikes) */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[-0.1, 0.18, 0]} rotation={[0, 0, -0.4]} castShadow>
          <coneGeometry args={[0.04, 0.36, 6]} />
          <meshStandardMaterial color={color.glow} />
        </mesh>
        <mesh position={[-0.18, 0.36, 0]} castShadow>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0.1, 0.18, 0]} rotation={[0, 0, 0.4]} castShadow>
          <coneGeometry args={[0.04, 0.36, 6]} />
          <meshStandardMaterial color={color.glow} />
        </mesh>
        <mesh position={[0.18, 0.36, 0]} castShadow>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={0.9} />
        </mesh>
      </group>
      {/* Eyes — bigger sclera, tracking pupils */}
      <group ref={leftEye} position={[-0.2, 0.18, 0.36]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
      </group>
      <group ref={rightEye} position={[0.2, 0.18, 0.36]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
      </group>
      {/* Mouth (downturned arc that opens during attack) */}
      <mesh ref={mouth} position={[0, -0.08, 0.46]} rotation={[-0.4, 0, 0]}>
        <torusGeometry args={[0.15, 0.04, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.7} />
      </mesh>
      {/* Teeth */}
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={i} position={[x, -0.14, 0.5]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.02, 0.05, 4]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
      ))}
      {/* Tentacles (3) */}
      {[
        { x: -0.25, z: -0.15, refIdx: 0 },
        { x: 0.0, z: 0.25, refIdx: 1 },
        { x: 0.25, z: -0.15, refIdx: 2 },
      ].map((t) => (
        <group
          key={t.refIdx}
          position={[t.x, -0.34, t.z]}
          ref={(el) => { if (el) tentacles.current[t.refIdx] = el; }}
        >
          <mesh position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.04, 0.36, 6]} />
            <meshStandardMaterial color={color.body} emissive={color.body} emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0, -0.36, 0]} castShadow>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={color.glow} />
          </mesh>
        </group>
      ))}
      {/* Ground glow */}
      <pointLight position={[0, 0.1, 0]} color={color.body} intensity={0.4} distance={3} decay={2} />
    </group>
  );
}

export function GooSplat({ x, z, variant, spawnedAt }: { x: number; z: number; variant: number; spawnedAt: number }) {
  const c = BLOB_COLORS[variant];
  const ref = useRef<Mesh>(null);
  // Render satellite drips around the main splat for a more dramatic look
  const dropsRefs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const ageRel = (performance.now() / 1000 - spawnedAt) / 12;
    const opacity = Math.max(0, 1 - ageRel);
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = opacity;
    }
    dropsRefs.current.forEach((d) => {
      if (!d) return;
      const mat = d.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = opacity * 0.85;
    });
  });
  return (
    <group position={[x, 0.03, z]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 18]} />
        <meshStandardMaterial color={c.body} roughness={0.7} transparent opacity={1} emissive={c.body} emissiveIntensity={0.1} />
      </mesh>
      {/* satellite drips */}
      {[
        { ang: 0.2, r: 0.85 },
        { ang: 1.4, r: 0.9 },
        { ang: 2.7, r: 0.78 },
        { ang: 4.0, r: 0.95 },
        { ang: 5.2, r: 0.82 },
      ].map((d, i) => (
        <mesh
          key={i}
          ref={(el) => { dropsRefs.current[i] = el; }}
          position={[Math.cos(d.ang) * d.r, 0.001, Math.sin(d.ang) * d.r]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.18 + Math.sin(i) * 0.04, 12]} />
          <meshStandardMaterial color={c.body} roughness={0.7} transparent opacity={0.85} emissive={c.body} emissiveIntensity={0.12} />
        </mesh>
      ))}
    </group>
  );
}
