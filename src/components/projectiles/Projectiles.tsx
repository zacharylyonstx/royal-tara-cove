import { useCombatStore } from '../../state/combatStore';
import type { Projectile } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';

export function Projectiles() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'aliens') return null;
  const projectiles = useCombatStore((s) => s.projectiles);
  return (
    <>
      {projectiles.map((p) => p.kind === 'bomb'
        ? <BombMesh key={p.id} p={p} />
        : <LegoMesh key={p.id} p={p} />
      )}
    </>
  );
}

function BombMesh({ p }: { p: Projectile }) {
  return (
    <group position={[p.x, p.y, p.z]} rotation={[p.rotPhase, p.rotPhase * 1.3, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.18, 14, 12]} />
        <meshStandardMaterial color="#ff66b0" emissive="#ff66b0" emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
      {/* fuse */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.08, 6]} />
        <meshStandardMaterial color="#fff" emissive="#ffaa3a" emissiveIntensity={1.5} />
      </mesh>
      <pointLight color="#ff66b0" intensity={1.2} distance={2} />
    </group>
  );
}

function LegoMesh({ p }: { p: Projectile }) {
  return (
    <group position={[p.x, p.y, p.z]} rotation={[p.rotPhase, p.rotPhase * 1.7, p.rotPhase * 0.5]}>
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.12, 0.22]} />
        <meshStandardMaterial color="#3a6db0" roughness={0.5} />
      </mesh>
      {/* lego stud */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
        <meshStandardMaterial color="#3a6db0" roughness={0.5} />
      </mesh>
    </group>
  );
}
