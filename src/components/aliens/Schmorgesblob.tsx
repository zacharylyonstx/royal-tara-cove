import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { BLOB_COLOR_FOR_KIND, type Blob } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

interface BlobProps {
  blob: Blob;
}

export function Schmorgesblob({ blob }: BlobProps) {
  if (blob.kind === 'sprinter') return <Sprinter blob={blob} />;
  if (blob.kind === 'splitter') return <Splitter blob={blob} />;
  // hopper (default)
  return <Hopper blob={blob} />;
}

function Hopper({ blob }: BlobProps) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);
  const leftEye = useRef<Group>(null);
  const rightEye = useRef<Group>(null);
  const mouth = useRef<Mesh>(null);
  const tentacles = useRef<Group[]>([]);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const color = BLOB_COLOR_FOR_KIND(blob.kind, blob.variant);
  const baseColor = new THREE.Color(color.body);
  const damageColor = new THREE.Color('#ff3a3a');

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.set(blob.x, blob.y, blob.z);
    group.current.scale.setScalar(blob.scale);

    const player = positions[activeId];
    const dx = player.x - blob.x;
    const dz = player.z - blob.z;
    const dist = Math.hypot(dx, dz);
    const ux = dist > 0 ? dx / dist : 0;
    const uz = dist > 0 ? dz / dist : 1;

    const isAttacking = dist < 1.5;

    if (!blob.alive) {
      const age = t - blob.deathAt;
      const k = Math.max(0, Math.min(1, age / 0.4));
      const s = blob.scale * (1 - k);
      group.current.scale.set(s, s * 0.5, s);
      group.current.visible = age < 0.45;
      return;
    }
    group.current.visible = true;

    // Erupt scale-in: 0 → 1.15 → 1 over 0.4s with overshoot
    const sinceSpawn = t - blob.spawnedAt;
    if (sinceSpawn < 0.4) {
      const k = sinceSpawn / 0.4;
      const overshoot = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      group.current.scale.setScalar(blob.scale * overshoot);
    }

    const wob = Math.sin(t * 6 + blob.phase) * 0.12;
    if (body.current) {
      const sx = isAttacking ? 1.18 - wob * 0.3 : 1 - wob * 0.55;
      const sy = isAttacking ? 0.7 + wob * 0.3 : 1 + wob;
      body.current.scale.set(sx, sy, sx);
      const sinceDamage = t - blob.lastDamagedAt;
      const flash = sinceDamage < 0.15 ? Math.max(0, 1 - sinceDamage / 0.15) : 0;
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      if (mat?.color) mat.color.copy(baseColor).lerp(damageColor, flash);
    }
    if (core.current) {
      const pulseFreq = isAttacking ? 8 : 3;
      const pulse = 0.7 + Math.abs(Math.sin(t * pulseFreq + blob.phase)) * 0.6;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = pulse * (isAttacking ? 1.6 : 1.0);
      core.current.scale.setScalar(0.18 + Math.sin(t * pulseFreq) * 0.02);
    }
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
    if (mouth.current) {
      const open = isAttacking ? 1 : 0;
      mouth.current.rotation.x = -0.4 - open * 0.6;
      mouth.current.scale.y = 1 + open * 1.2;
    }
    tentacles.current.forEach((tg, i) => {
      if (!tg) return;
      const phase = blob.phase + i * 1.7;
      tg.rotation.x = Math.sin(t * 4 + phase) * 0.3;
      tg.rotation.z = Math.cos(t * 4 + phase) * 0.3;
    });
  });

  if (!blob.alive && performance.now() / 1000 - blob.deathAt > 0.5) return null;

  return (
    <group ref={group} position={[blob.x, blob.y, blob.z]} scale={blob.scale}>
      <mesh ref={body} castShadow>
        <sphereGeometry args={[0.5, 14, 10]} />
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
      <mesh ref={core}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={1.0} />
      </mesh>
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
      <mesh ref={mouth} position={[0, -0.08, 0.46]} rotation={[-0.4, 0, 0]}>
        <torusGeometry args={[0.15, 0.04, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.7} />
      </mesh>
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={i} position={[x, -0.14, 0.5]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.02, 0.05, 4]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
      ))}
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
      <BlobHpBar blob={blob} />
    </group>
  );
}

function BlobHpBar({ blob, always = false, width = 0.7 }: { blob: Blob; always?: boolean; width?: number }) {
  const groupRef = useRef<Group>(null);
  const fillRef = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const g = groupRef.current;
    if (!g) return;
    const visible = blob.alive && (always || blob.hp < blob.maxHp);
    g.visible = visible;
    if (!visible) return;
    // Always face camera (yaw only)
    g.lookAt(camera.position.x, g.position.y, camera.position.z);
    if (fillRef.current) {
      const ratio = blob.hp / blob.maxHp;
      fillRef.current.scale.x = Math.max(0.001, ratio);
      fillRef.current.position.x = -(width / 2) * (1 - ratio);
      const mat = fillRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        const r = ratio < 0.4 ? 1 : 0.5 - ratio * 0.5;
        const gC = ratio < 0.4 ? ratio * 1.5 : 0.7;
        mat.color.setRGB(r, gC, 0.2);
      }
    }
  });
  return (
    <group ref={groupRef} position={[0, 1.2, 0]} visible={false}>
      {/* background bar */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, 0.08]} />
        <meshBasicMaterial color="#1a1a1c" transparent opacity={0.7} depthTest={false} />
      </mesh>
      {/* fill — anchored at left edge, scales toward right */}
      <mesh ref={fillRef} position={[0, 0, 0.001]}>
        <planeGeometry args={[width, 0.07]} />
        <meshBasicMaterial color="#5cb85c" transparent opacity={0.95} depthTest={false} />
      </mesh>
    </group>
  );
}

function Sprinter({ blob }: BlobProps) {
  // Single big cyclops eye; stretched body; no antennae.
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const eye = useRef<Group>(null);
  const positions = useGameStore((s) => s.positions);
  const activeId = useGameStore((s) => s.activeCharacterId);
  const color = BLOB_COLOR_FOR_KIND(blob.kind, blob.variant);
  const baseColor = new THREE.Color(color.body);
  const damageColor = new THREE.Color('#ffd83a');

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.set(blob.x, blob.y, blob.z);
    group.current.scale.setScalar(blob.scale);
    const player = positions[activeId];
    const dx = player.x - blob.x;
    const dz = player.z - blob.z;
    const dist = Math.hypot(dx, dz);
    const ux = dist > 0 ? dx / dist : 0;
    const uz = dist > 0 ? dz / dist : 1;
    if (!blob.alive) {
      const age = t - blob.deathAt;
      const k = Math.max(0, Math.min(1, age / 0.3));
      const s = blob.scale * (1 - k);
      group.current.scale.set(s, s * 0.4, s);
      group.current.visible = age < 0.35;
      return;
    }
    group.current.visible = true;
    if (body.current) {
      // Lean forward in direction of travel
      const yaw = Math.atan2(ux, uz);
      group.current.rotation.y = yaw;
      // Stretch
      const stretch = 1 + Math.sin(t * 16 + blob.phase) * 0.06;
      body.current.scale.set(0.85, 0.7, stretch);
      const flash = Math.max(0, 1 - (t - blob.lastDamagedAt) / 0.15);
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      if (mat?.color) mat.color.copy(baseColor).lerp(damageColor, flash);
    }
    if (eye.current) {
      eye.current.children.forEach((child, idx) => {
        if (idx === 1) {
          child.position.x = ux * 0.04;
          child.position.z = 0.12 + uz * 0.04;
        }
      });
    }
  });

  if (!blob.alive && performance.now() / 1000 - blob.deathAt > 0.4) return null;

  return (
    <group ref={group} position={[blob.x, blob.y, blob.z]} scale={blob.scale}>
      <mesh ref={body} castShadow>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshPhysicalMaterial color={color.body} roughness={0.3} transmission={0.25} thickness={0.4} ior={1.4} emissive={color.body} emissiveIntensity={0.3} />
      </mesh>
      {/* big single eye */}
      <group ref={eye} position={[0, 0.05, 0.4]}>
        <mesh castShadow>
          <sphereGeometry args={[0.22, 14, 14]} />
          <meshStandardMaterial color="#f5ecd9" />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#1a1a1c" />
        </mesh>
      </group>
      {/* extra tentacles trailing behind */}
      {[-0.2, 0, 0.2].map((x, i) => (
        <mesh key={i} position={[x, -0.2, -0.3]} rotation={[0.3, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.02, 0.5, 6]} />
          <meshStandardMaterial color={color.body} emissive={color.body} emissiveIntensity={0.2} />
        </mesh>
      ))}
      <BlobHpBar blob={blob} />
    </group>
  );
}

function Splitter({ blob }: BlobProps) {
  // Bulgier body with three glowing pustules on top
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const pustules = useRef<Mesh[]>([]);
  const color = BLOB_COLOR_FOR_KIND(blob.kind, blob.variant);
  const baseColor = new THREE.Color(color.body);
  const damageColor = new THREE.Color('#ff4040');

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.position.set(blob.x, blob.y, blob.z);
    group.current.scale.setScalar(blob.scale);
    if (!blob.alive) {
      const age = t - blob.deathAt;
      const k = Math.max(0, Math.min(1, age / 0.3));
      const s = blob.scale * (1 - k);
      group.current.scale.set(s, s, s);
      // Pustules pop outward
      pustules.current.forEach((p) => {
        if (!p) return;
        p.position.y = 0.4 + age * 6;
        p.scale.setScalar(1 + age * 3);
        const mat = p.material as THREE.MeshStandardMaterial;
        if (mat) mat.opacity = Math.max(0, 1 - age * 3);
      });
      group.current.visible = age < 0.35;
      return;
    }
    group.current.visible = true;
    if (body.current) {
      // Bulgy bob
      const wob = Math.sin(t * 4 + blob.phase) * 0.15;
      body.current.scale.set(1.15 - wob * 0.5, 0.85 + wob, 1.15 - wob * 0.5);
      const flash = Math.max(0, 1 - (t - blob.lastDamagedAt) / 0.15);
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      if (mat?.color) mat.color.copy(baseColor).lerp(damageColor, flash);
    }
    pustules.current.forEach((p, i) => {
      if (!p) return;
      const mat = p.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 0.8 + Math.sin(t * 5 + i) * 0.4;
    });
  });

  if (!blob.alive && performance.now() / 1000 - blob.deathAt > 0.4) return null;

  return (
    <group ref={group} position={[blob.x, blob.y, blob.z]} scale={blob.scale}>
      <mesh ref={body} castShadow>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshPhysicalMaterial color={color.body} roughness={0.4} transmission={0.2} thickness={0.45} ior={1.4} emissive={color.body} emissiveIntensity={0.2} />
      </mesh>
      {/* three pustules */}
      {[
        { x: -0.18, z: 0.1 },
        { x: 0.0, z: -0.2 },
        { x: 0.2, z: 0.05 },
      ].map((p, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) pustules.current[i] = el; }}
          position={[p.x, 0.4, p.z]}
          castShadow
        >
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color={color.glow} emissive={color.glow} emissiveIntensity={0.9} transparent opacity={1} />
        </mesh>
      ))}
      {/* eyes */}
      <mesh position={[-0.2, 0.05, 0.4]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      <mesh position={[-0.2, 0.05, 0.5]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      <mesh position={[0.2, 0.05, 0.4]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      <mesh position={[0.2, 0.05, 0.5]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      <BlobHpBar blob={blob} />
    </group>
  );
}

export function GooSplat({ x, z, variant, spawnedAt, scale = 1 }: { x: number; z: number; variant: number; spawnedAt: number; scale?: number }) {
  const c = BLOB_COLOR_FOR_KIND('hopper', variant); // splats tinted by variant idx
  const ref = useRef<Mesh>(null);
  const dropsRefs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const ageRel = (performance.now() / 1000 - spawnedAt) / 14;
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
    <group position={[x, 0.03, z]} scale={scale}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 18]} />
        <meshStandardMaterial color={c.body} roughness={0.7} transparent opacity={1} emissive={c.body} emissiveIntensity={0.1} />
      </mesh>
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
