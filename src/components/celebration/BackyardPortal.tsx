import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCombatStore } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';
import { BLOB_SPAWN } from '../aliens/UFOCrash';

/**
 * Glowing portal effect at the UFO crash site. Visible whenever there are
 * blobs queued OR the cinematic is active (so it ramps in before the first
 * blob appears). Three concentric counter-rotating rings + pulsing light +
 * rising particle column = "things are coming through here."
 */
export function BackyardPortal() {
  const groupRef = useRef<THREE.Group>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const visibleRef = useRef(false);

  useFrame(({ clock }) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    const c = useCombatStore.getState();
    const queued = c.blobsToSpawn.reduce((s, x) => s + x.count, 0);
    const cinActive = c.cinematic.active;
    const showing = queued > 0 || cinActive;
    const g = groupRef.current;
    if (!g) return;
    g.visible = showing;
    visibleRef.current = showing;
    if (!showing) return;

    const t = clock.elapsedTime;
    if (ring1.current) {
      ring1.current.rotation.x = Math.PI / 2;
      ring1.current.rotation.z = t * 1.2;
    }
    if (ring2.current) {
      ring2.current.rotation.x = Math.PI / 2;
      ring2.current.rotation.z = -t * 1.7;
    }
    if (ring3.current) {
      ring3.current.rotation.x = Math.PI / 2;
      ring3.current.rotation.z = t * 0.6;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 6 + Math.sin(t * 4) * 2;
    }
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.Material & { opacity?: number };
      if (mat) mat.opacity = 0.35 + Math.sin(t * 3) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[BLOB_SPAWN[0], 0.05, BLOB_SPAWN[2]]} visible={false}>
      {/* Ground caustic — large dark green disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 4.0, 36]} />
        <meshBasicMaterial color="#3afff0" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Three rings stacked vertically */}
      <mesh ref={ring1} position={[0, 0.6, 0]}>
        <torusGeometry args={[2.6, 0.18, 8, 32]} />
        <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={1.6} transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring2} position={[0, 1.4, 0]}>
        <torusGeometry args={[2.0, 0.14, 8, 28]} />
        <meshStandardMaterial color="#a832c8" emissive="#a832c8" emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring3} position={[0, 2.4, 0]}>
        <torusGeometry args={[1.5, 0.10, 6, 24]} />
        <meshStandardMaterial color="#fff15a" emissive="#fff15a" emissiveIntensity={1.6} transparent opacity={0.85} />
      </mesh>
      {/* Vertical light beam */}
      <mesh ref={beamRef} position={[0, 8, 0]}>
        <cylinderGeometry args={[1.6, 0.6, 16, 18, 1, true]} />
        <meshBasicMaterial color="#3afff0" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Bright central core */}
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* Pulsing point light */}
      <pointLight ref={lightRef} position={[0, 2, 0]} color="#3afff0" intensity={6} distance={28} />
    </group>
  );
}
