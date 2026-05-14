import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, PointLight } from 'three';
import { useCombatStore } from '../../state/combatStore';

const COUNT = 18;
const CENTER_X = 0;
const CENTER_Z = -100; // hero house area
const RADIUS = 10;

interface FireflyData {
  baseX: number; baseZ: number;
  baseY: number;
  pulsePhase: number;
  pulseSpeed: number;
  driftPhase: number;
  driftRadius: number;
}

/**
 * Tiny pulsing yellow lights that drift around 10600 at night. Visible only
 * when timeOfDay is dark enough to read as evening/night.
 */
export function Fireflies() {
  const groupRef = useRef<Group>(null);
  const lightRefs = useRef<(PointLight | null)[]>([]);

  const data = useMemo<FireflyData[]>(() => {
    return Array.from({ length: COUNT }, (_, i) => {
      const ang = (i / COUNT) * Math.PI * 2;
      const r = 4 + Math.random() * RADIUS;
      return {
        baseX: CENTER_X + Math.cos(ang) * r,
        baseZ: CENTER_Z + Math.sin(ang) * r,
        baseY: 0.6 + Math.random() * 1.8,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 1.5 + Math.random() * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftRadius: 0.6 + Math.random() * 1.2,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    const tod = useCombatStore.getState().timeOfDay;
    // Only show when it's getting dark (tod >= 0.45)
    const groupVisible = tod >= 0.45;
    const g = groupRef.current;
    if (g) g.visible = groupVisible;
    if (!groupVisible) return;
    const t = clock.elapsedTime;
    const intensityMul = Math.min(1, (tod - 0.45) * 4);
    if (g) {
      g.children.forEach((child, i) => {
        const d = data[i];
        const driftX = Math.sin(t * 0.6 + d.driftPhase) * d.driftRadius;
        const driftY = Math.sin(t * 0.9 + d.driftPhase * 1.3) * 0.4;
        const driftZ = Math.cos(t * 0.7 + d.driftPhase) * d.driftRadius;
        child.position.set(d.baseX + driftX, d.baseY + driftY, d.baseZ + driftZ);
      });
    }
    lightRefs.current.forEach((light, i) => {
      if (!light) return;
      const d = data[i];
      const pulse = 0.5 + 0.5 * Math.sin(t * d.pulseSpeed + d.pulsePhase);
      light.intensity = pulse * 1.5 * intensityMul;
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      {data.map((_, i) => (
        <group key={i}>
          <pointLight
            ref={(l) => { lightRefs.current[i] = l; }}
            color="#fff15a"
            intensity={1.0}
            distance={2.5}
            decay={2}
          />
          <mesh>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color="#fff8a0" transparent opacity={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
