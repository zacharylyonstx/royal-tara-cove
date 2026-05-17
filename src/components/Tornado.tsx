import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTornadoStore } from '../state/tornadoStore';

// Animated tornado funnel: 12 stacked rotating tapered rings + ~80 debris
// boxes orbiting at varying heights. Position read from tornadoStore.tornadoZ.
// Opacity ramps from tornadoStore.tornadoOpacity (0..1).

const SEGMENTS = 12;
const FUNNEL_HEIGHT = 18;
const BASE_RADIUS = 0.8;
const TOP_RADIUS = 4.0;
const DEBRIS_COUNT = 80;
const DEBRIS_COLORS = ['#7a5a32', '#5a3a22', '#dcd6c8', '#8a8a92', '#3a3a3c'];

interface DebrisItem {
  height: number;
  baseRadius: number;
  angle: number;
  angularSpeed: number;
  scale: number;
  colorIdx: number;
}

export function Tornado() {
  const rootRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const debrisMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const rings = useMemo(() => {
    const arr: { y: number; r: number; speed: number; tint: string }[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / (SEGMENTS - 1);
      const y = t * FUNNEL_HEIGHT;
      const r = BASE_RADIUS + t * (TOP_RADIUS - BASE_RADIUS);
      // Speed: base 0.3 rad/s → top 4 rad/s
      const speed = 0.3 + t * 3.7;
      // Color shifts from dark base to lighter top
      const shade = Math.round(0x3a + t * 0x40);
      const hex = shade.toString(16).padStart(2, '0');
      arr.push({ y, r, speed, tint: `#${hex}${hex}${(shade + 8).toString(16).padStart(2, '0')}` });
    }
    return arr;
  }, []);

  // Pre-compute debris layout (one InstancedMesh per color for variety)
  const debrisGroups = useMemo(() => {
    const groups: { color: string; items: DebrisItem[] }[] = DEBRIS_COLORS.map((c) => ({ color: c, items: [] }));
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const h = Math.random() * FUNNEL_HEIGHT;
      const tNorm = h / FUNNEL_HEIGHT;
      const baseRadius = BASE_RADIUS + tNorm * (TOP_RADIUS - BASE_RADIUS) + 0.5 + Math.random() * 1.5;
      const colorIdx = Math.floor(Math.random() * DEBRIS_COLORS.length);
      groups[colorIdx].items.push({
        height: h,
        baseRadius,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: 0.4 + Math.random() * 2 + tNorm * 2,
        scale: 0.18 + Math.random() * 0.22,
        colorIdx,
      });
    }
    return groups;
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const root = rootRef.current;
    if (!root) return;
    const t = useTornadoStore.getState();
    if (t.tornadoOpacity < 0.01) {
      root.visible = false;
      return;
    }
    root.visible = true;
    root.position.set(0, 0, t.tornadoZ);

    // Spin rings + update opacity
    for (let i = 0; i < SEGMENTS; i++) {
      const ring = ringRefs.current[i];
      const mat = ringMatRefs.current[i];
      if (ring) ring.rotation.y += rings[i].speed * dt;
      if (mat) mat.opacity = t.tornadoOpacity * 0.78;
    }

    // Update debris
    for (let g = 0; g < debrisGroups.length; g++) {
      const grp = debrisGroups[g];
      const mesh = debrisMeshRefs.current[g];
      if (!mesh) continue;
      for (let i = 0; i < grp.items.length; i++) {
        const d = grp.items[i];
        d.angle += d.angularSpeed * dt;
        const r = d.baseRadius + Math.sin(d.angle * 0.7) * 0.4;
        tmp.position.set(
          Math.cos(d.angle) * r,
          d.height + Math.sin(d.angle * 1.2) * 0.3,
          Math.sin(d.angle) * r,
        );
        tmp.rotation.set(d.angle * 1.3, d.angle * 0.8, d.angle * 0.5);
        tmp.scale.setScalar(d.scale);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const dmat = mesh.material as THREE.MeshStandardMaterial;
      if (dmat) dmat.opacity = t.tornadoOpacity;
    }
  });

  return (
    <group ref={rootRef}>
      {rings.map((r, i) => (
        <mesh
          key={i}
          ref={(el) => { ringRefs.current[i] = el; }}
          position={[0, r.y, 0]}
        >
          <torusGeometry args={[r.r, r.r * 0.18, 8, 24]} />
          <meshStandardMaterial
            ref={(el) => { ringMatRefs.current[i] = el; }}
            color={r.tint}
            roughness={0.95}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {debrisGroups.map((g, i) => (
        <instancedMesh
          key={i}
          ref={(el) => { debrisMeshRefs.current[i] = el; }}
          args={[undefined, undefined, g.items.length]}
          castShadow
        >
          <boxGeometry args={[1, 0.2, 0.6]} />
          <meshStandardMaterial color={g.color} transparent opacity={0} roughness={0.85} />
        </instancedMesh>
      ))}
    </group>
  );
}
