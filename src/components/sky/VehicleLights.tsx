import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SpotLight } from 'three';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { mat } from '../../world/materials';

/**
 * Headlights / taillights for driven vehicles in Free Play. Every driven car
 * gets emissive lamps; the LOCAL driver also gets a real forward spotlight so
 * the road ahead is lit at night. Positions are in the vehicle group's local
 * frame (cars: nose at −Z; bikes: nose at +X).
 */
type Kind = 'sedan' | 'truck' | 'golfcart' | 'bike';

const LAMPS: Record<Kind, { head: [number, number, number]; tail: [number, number, number] | null; spot: [number, number, number] }> = {
  sedan:    { head: [0.62, 0.62, -2.05], tail: [0.6, 0.72, 1.92], spot: [0, 0.75, -1.4] },
  truck:    { head: [0.78, 0.92, -2.55], tail: [0.74, 0.9, 2.42], spot: [0, 1.0, -1.8] },
  golfcart: { head: [0.42, 0.72, -1.15], tail: [0.42, 0.7, 1.1], spot: [0, 0.85, -0.8] },
  bike:     { head: [0.85, 0.72, 0], tail: null, spot: [0.6, 0.8, 0] },
};

export function VehicleLights({ kind, local }: { kind: Kind; local: boolean }) {
  const spotRef = useRef<SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const L = LAMPS[kind];
  const isBike = kind === 'bike';
  const headMat = useMemo(() => mat.headlightLens() as THREE.MeshStandardMaterial, []);
  const tailMat = useMemo(() => mat.taillightLens() as THREE.MeshStandardMaterial, []);

  useFrame(() => {
    const f = useSkyStore.getState().dayFraction;
    const p = skyPalette(sunDirection(f).elevationDeg, moonDirection(f).elevationDeg);
    const on = p.lamps;
    headMat.emissiveIntensity = 0.3 + 3.2 * on;
    tailMat.emissiveIntensity = 0.25 + 1.1 * on;
    if (spotRef.current) spotRef.current.intensity = (isBike ? 18 : 70) * on;
  });

  // Target sits ahead and down the road, in the vehicle's local frame.
  target.position.set(isBike ? 12 : 0, -0.6, isBike ? 0 : -14);
  const size: [number, number, number] = isBike ? [0.12, 0.12, 0.08] : [0.32, 0.16, 0.08];
  return (
    <group>
      <mesh position={[L.head[0], L.head[1], L.head[2]]} material={headMat}><boxGeometry args={size} /></mesh>
      {!isBike && <mesh position={[-L.head[0], L.head[1], L.head[2]]} material={headMat}><boxGeometry args={size} /></mesh>}
      {L.tail && (
        <>
          <mesh position={[L.tail[0], L.tail[1], L.tail[2]]} material={tailMat}><boxGeometry args={[0.16, 0.07, 0.05]} /></mesh>
          <mesh position={[-L.tail[0], L.tail[1], L.tail[2]]} material={tailMat}><boxGeometry args={[0.16, 0.07, 0.05]} /></mesh>
        </>
      )}
      {local && (
        <>
          <primitive object={target} />
          <spotLight
            ref={spotRef}
            position={L.spot}
            target={target}
            color="#fff2d0"
            intensity={0}
            distance={isBike ? 18 : 38}
            angle={isBike ? 0.45 : 0.62}
            penumbra={0.6}
            decay={1.6}
          />
        </>
      )}
    </group>
  );
}
