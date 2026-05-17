import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// A single jagged lightning bolt + branches. Drawn as LineSegments using
// pre-allocated buffer geometry. Lifetime ~180ms, then auto-removed.

const BOLT_LIFETIME = 0.18;

interface BoltProps {
  cloudY: number;
  groundX: number;
  groundZ: number;
  spawnedAt: number;
  onDone: () => void;
}

function LightningBolt({ cloudY, groundX, groundZ, spawnedAt, onDone }: BoltProps) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const geom = useMemo(
    () => buildBoltGeometry(cloudY, groundX, groundZ),
    [cloudY, groundX, groundZ],
  );

  useEffect(() => {
    const id = setTimeout(onDone, BOLT_LIFETIME * 1000 + 30);
    return () => clearTimeout(id);
  }, [onDone]);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const t = performance.now() / 1000 - spawnedAt;
    if (t > BOLT_LIFETIME) {
      mat.opacity = 0;
      return;
    }
    const u = t / BOLT_LIFETIME;
    // Two-flash flicker
    const flicker = u < 0.5 ? 1 - u * 0.6 : 0.4 * (1 - (u - 0.5) * 2);
    mat.opacity = flicker;
  });

  return (
    <lineSegments geometry={geom} frustumCulled={false}>
      <lineBasicMaterial
        ref={matRef}
        color="#ffffff"
        transparent
        opacity={1}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function buildBoltGeometry(cloudY: number, groundX: number, groundZ: number): THREE.BufferGeometry {
  const segments = 18;
  const positions: number[] = [];
  const mainPoints: THREE.Vector3[] = [];
  let prev = new THREE.Vector3(
    groundX + (Math.random() - 0.5) * 4,
    cloudY,
    groundZ + (Math.random() - 0.5) * 4,
  );
  mainPoints.push(prev.clone());
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const targetX = THREE.MathUtils.lerp(prev.x, groundX, 0.6) + (Math.random() - 0.5) * 3 * (1 - t * 0.7);
    const targetZ = THREE.MathUtils.lerp(prev.z, groundZ, 0.6) + (Math.random() - 0.5) * 3 * (1 - t * 0.7);
    const next = new THREE.Vector3(targetX, cloudY * (1 - t), targetZ);
    positions.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
    mainPoints.push(next.clone());
    prev = next;
  }
  // 2-3 branches forking off random main-bolt points
  const branches = 2 + Math.floor(Math.random() * 2);
  for (let b = 0; b < branches; b++) {
    const startIdx = Math.floor(2 + Math.random() * (mainPoints.length - 5));
    let bp = mainPoints[startIdx].clone();
    const dirX = (Math.random() - 0.5) * 8;
    const dirZ = (Math.random() - 0.5) * 8;
    const dirY = -3 - Math.random() * 5;
    const bSegs = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < bSegs; i++) {
      const next = new THREE.Vector3(
        bp.x + dirX / bSegs + (Math.random() - 0.5) * 2,
        bp.y + dirY / bSegs,
        bp.z + dirZ / bSegs + (Math.random() - 0.5) * 2,
      );
      positions.push(bp.x, bp.y, bp.z, next.x, next.y, next.z);
      bp = next;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

// ---- Module-level spawn list shared by Lightning.tsx ----

interface BoltSpec {
  id: number;
  cloudY: number;
  groundX: number;
  groundZ: number;
  spawnedAt: number;
}

let nextBoltId = 1;
let activeBolts: BoltSpec[] = [];
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export function spawnLightningBolt(originX: number, originZ: number) {
  const groundX = originX + (Math.random() - 0.5) * 80;
  const groundZ = originZ + (Math.random() - 0.5) * 80;
  const cloudY = 70 + Math.random() * 20;
  activeBolts = [
    ...activeBolts,
    { id: nextBoltId++, cloudY, groundX, groundZ, spawnedAt: performance.now() / 1000 },
  ];
  emit();
}

export function LightningBoltRenderer() {
  const [bolts, setBolts] = useState<BoltSpec[]>(() => activeBolts);
  useEffect(() => {
    const sub = () => setBolts([...activeBolts]);
    listeners.add(sub);
    return () => { listeners.delete(sub); };
  }, []);
  return (
    <>
      {bolts.map((b) => (
        <LightningBolt
          key={b.id}
          cloudY={b.cloudY}
          groundX={b.groundX}
          groundZ={b.groundZ}
          spawnedAt={b.spawnedAt}
          onDone={() => {
            activeBolts = activeBolts.filter((x) => x.id !== b.id);
            emit();
          }}
        />
      ))}
    </>
  );
}
