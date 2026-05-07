import { useMemo } from 'react';
import * as THREE from 'three';

interface RoofProps {
  width: number;
  depth: number;
  height: number;
  color: string;
  overhang?: number;
}

// A gable roof whose ridge runs along the house WIDTH (the street-facing axis).
// Built from a triangular Shape extruded along the width axis, then rotated +90°
// around Y so the extrusion direction maps to world +X.
export function Roof({ width, depth, height, color, overhang = 0.4 }: RoofProps) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const half = depth / 2 + overhang;
    s.moveTo(-half, 0);
    s.lineTo(half, 0);
    s.lineTo(0, height);
    s.closePath();
    return s;
  }, [depth, height, overhang]);

  const extrudeWidth = width + overhang * 2;

  return (
    <mesh
      castShadow
      receiveShadow
      rotation={[0, Math.PI / 2, 0]}
      position={[-extrudeWidth / 2, 0, 0]}
    >
      <extrudeGeometry args={[shape, { depth: extrudeWidth, bevelEnabled: false, steps: 1 }]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}
