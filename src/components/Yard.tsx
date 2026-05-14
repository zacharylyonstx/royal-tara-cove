import { useMemo } from 'react';
import * as THREE from 'three';
import type { HouseConfig, Lot, Vec2 } from '../types';
import {
  FRONT_YARD_DEPTH,
} from '../world/streetLayout';
import { mat } from '../world/materials';
import { Fence } from './Fence';
import { Gate } from './Gate';
import { Mailbox } from './Mailbox';
import { shouldFenceEdge } from '../world/lots';

const GARAGE_W = 5.6;

interface YardProps {
  config: HouseConfig;
  lot: Lot;
}

/** Rendered lot lawn + fences + driveway + walkway + mailbox. */
export function Yard({ config, lot }: YardProps) {
  const lawnGeom = useMemo(() => buildLawnGeometry(lot.polygon), [lot]);

  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const sidewalkZ = -halfD - FRONT_YARD_DEPTH;

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  const driveLen = -halfD - sidewalkZ;
  const driveZCenter = (sidewalkZ + -halfD) / 2;
  const walkLen = -halfD - sidewalkZ;

  return (
    <group>
      {/* Lawn polygon — placed at world origin (geometry IS world XZ) */}
      <mesh geometry={lawnGeom} position={[0, 0.01, 0]} receiveShadow>
        <primitive object={mat.grass()} attach="material" />
      </mesh>

      {/* House-local props (driveway, walkway, mailbox) — these stay relative to the house */}
      <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
        {/* Driveway */}
        <mesh position={[garageCenterX, 0.022, driveZCenter]} receiveShadow>
          <boxGeometry args={[GARAGE_W - 0.2, 0.04, driveLen]} />
          <primitive object={mat.concrete()} attach="material" />
        </mesh>

        {/* Front walkway */}
        <mesh position={[doorCenterX, 0.024, (sidewalkZ + -halfD) / 2]} receiveShadow>
          <boxGeometry args={[1.2, 0.04, walkLen]} />
          <primitive object={mat.sidewalk()} attach="material" />
        </mesh>

        {/* Mailbox at curb (street side of sidewalk) */}
        <Mailbox
          position={[
            config.garageOnLeft ? halfW - 1.0 : -halfW + 1.0,
            0,
            sidewalkZ - 0.6,
          ]}
        />
      </group>

      {/* Fences along non-front edges of the lot */}
      {lot.polygon.map((a, i) => {
        if (!shouldFenceEdge(lot, i)) return null;
        const b = lot.polygon[(i + 1) % lot.polygon.length];
        // Skip if this edge is near a gate slot (we'll render the gate instead)
        const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const nearGate = lot.gateSlots.some(
          (g) => Math.hypot(g[0] - mid[0], g[1] - mid[1]) < 1.0,
        );
        if (nearGate) {
          // Render two short fence pieces flanking the gate slot
          return (
            <FenceWithGate
              key={`fg-${i}`}
              a={a}
              b={b}
              gateAt={lot.gateSlots.find(
                (g) => Math.hypot(g[0] - mid[0], g[1] - mid[1]) < 1.0,
              )!}
            />
          );
        }
        return <Fence key={`f-${i}`} start={[a[0], a[1]]} end={[b[0], b[1]]} />;
      })}
    </group>
  );
}

interface FenceWithGateProps {
  a: Vec2;
  b: Vec2;
  gateAt: Vec2;
}

function FenceWithGate({ a, b, gateAt }: FenceWithGateProps) {
  // Split the edge into two fence pieces, leaving a gap of 1.6m at gateAt.
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return null;
  const ux = dx / len;
  const uz = dz / len;
  const dot = (gateAt[0] - a[0]) * ux + (gateAt[1] - a[1]) * uz;
  const t = Math.max(0.6, Math.min(len - 0.6, dot));
  const gateW = 1.4;
  const halfGate = gateW / 2;
  const aSplitX = a[0] + ux * (t - halfGate);
  const aSplitZ = a[1] + uz * (t - halfGate);
  const bSplitX = a[0] + ux * (t + halfGate);
  const bSplitZ = a[1] + uz * (t + halfGate);
  const gateCenter: Vec2 = [a[0] + ux * t, a[1] + uz * t];
  const gateRot = Math.atan2(uz, ux);
  return (
    <>
      <Fence start={[a[0], a[1]]} end={[aSplitX, aSplitZ]} />
      <Fence start={[bSplitX, bSplitZ]} end={[b[0], b[1]]} />
      <Gate
        position={[gateCenter[0], 0, gateCenter[1]]}
        rotation={gateRot}
        width={gateW}
      />
    </>
  );
}

function buildLawnGeometry(polygon: Vec2[]): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(polygon[0][0], polygon[0][1]);
  for (let i = 1; i < polygon.length; i++) {
    shape.lineTo(polygon[i][0], polygon[i][1]);
  }
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  // ShapeGeometry produces XY plane; rotate so it lies on XZ.
  geom.rotateX(-Math.PI / 2);
  // Now Y is up. The original X stays X; the original Y maps to Z but negated.
  // Actually rotateX(-PI/2) sends (x, y, 0) → (x, 0, -y). So our polygon Z became -Z.
  // Compensate by flipping Z in vertex array.
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, -pos.getZ(i));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  // UVs: scale so 1 unit world = 1 unit UV (texture repeat handled in material).
  const uv = geom.getAttribute('uv');
  if (uv) {
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * 0.1, pos.getZ(i) * 0.1);
    }
    uv.needsUpdate = true;
  }
  return geom;
}
