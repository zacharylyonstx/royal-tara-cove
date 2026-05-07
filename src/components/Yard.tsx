import type { HouseConfig } from '../types';
import {
  houseYawForAngle,
  radialToXZ,
  HOUSE_FRONT_RADIUS,
  FRONT_YARD_DEPTH,
  BACKYARD_DEPTH,
} from '../world/streetLayout';
import { Fence } from './Fence';
import { Gate } from './Gate';
import { Tree } from './Tree';
import { Mailbox } from './Mailbox';

const GARAGE_W = 5.6;

interface YardProps {
  config: HouseConfig;
}

export function Yard({ config }: YardProps) {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  const [worldX, worldZ] = radialToXZ(config.angleDeg, HOUSE_FRONT_RADIUS + halfD);
  const yaw = houseYawForAngle(config.angleDeg);

  // Local lot space (after rotation): house front faces -Z.
  // sidewalk inner edge at z = -(halfD + FRONT_YARD_DEPTH).
  // backyard far end at z = +halfD + BACKYARD_DEPTH.
  const sidewalkZ = -halfD - FRONT_YARD_DEPTH;
  const backZ = halfD + BACKYARD_DEPTH;
  const sideX = halfW + 1.8;       // lot half-width (incl. 1.8m side yard)
  const gateZ = -halfD;            // gates sit at the front-of-house line on each side
  const gateW = 1.6;
  const fenceFrontZ = gateZ + gateW / 2;

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  const driveZCenter = (sidewalkZ + -halfD) / 2;
  const driveLen = -halfD - sidewalkZ;
  const walkLen = -halfD - sidewalkZ;

  return (
    <group position={[worldX, 0, worldZ]} rotation={[0, yaw, 0]}>
      {/* Lot lawn — front, back, side strips, slightly elevated above world ground */}
      <mesh position={[0, 0.005, driveZCenter]} receiveShadow>
        <boxGeometry args={[sideX * 2, 0.01, driveLen]} />
        <meshStandardMaterial color="#5a8a3e" />
      </mesh>
      <mesh position={[0, 0.005, (halfD + backZ) / 2]} receiveShadow>
        <boxGeometry args={[sideX * 2, 0.01, BACKYARD_DEPTH]} />
        <meshStandardMaterial color="#5a8a3e" />
      </mesh>
      <mesh position={[-sideX + 0.5, 0.005, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.01, halfD * 2]} />
        <meshStandardMaterial color="#5a8a3e" />
      </mesh>
      <mesh position={[sideX - 0.5, 0.005, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.01, halfD * 2]} />
        <meshStandardMaterial color="#5a8a3e" />
      </mesh>

      {/* Driveway */}
      <mesh position={[garageCenterX, 0.012, driveZCenter]} receiveShadow>
        <boxGeometry args={[GARAGE_W - 0.2, 0.02, driveLen]} />
        <meshStandardMaterial color="#a8a39a" />
      </mesh>

      {/* Front walkway from sidewalk to porch */}
      <mesh position={[doorCenterX, 0.012, (sidewalkZ + -halfD) / 2]} receiveShadow>
        <boxGeometry args={[1.2, 0.02, walkLen]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>

      {/* Mailbox at curb (street side of sidewalk) */}
      <Mailbox
        position={[
          config.garageOnLeft ? halfW - 1.0 : -halfW + 1.0,
          0,
          sidewalkZ - 0.6,
        ]}
      />

      {/* Backyard fence + gates */}
      <Fence start={[-sideX, fenceFrontZ]} end={[-sideX, backZ]} />
      <Fence start={[sideX, fenceFrontZ]} end={[sideX, backZ]} />
      <Fence start={[-sideX, backZ]} end={[sideX, backZ]} />
      <Gate position={[-sideX, 0, gateZ]} rotation={Math.PI / 2} width={gateW} />
      <Gate position={[sideX, 0, gateZ]} rotation={-Math.PI / 2} width={gateW} />

      {/* A couple of trees per lot */}
      <Tree
        position={[
          config.garageOnLeft ? halfW - 0.5 : -halfW + 0.5,
          0,
          -halfD - 4.5,
        ]}
        scale={0.85}
        variant="oak"
      />
      <Tree
        position={[-halfW - 0.6, 0, halfD + 4.5]}
        scale={1.0}
        variant="cedar"
      />
      <Tree
        position={[halfW + 0.6, 0, halfD + 7]}
        scale={0.9}
        variant={config.address.endsWith('5') ? 'crepe' : 'oak'}
      />
    </group>
  );
}
