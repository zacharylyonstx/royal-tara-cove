import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import type { HouseConfig } from '../types';
import { houseTransform } from '../world/streetLayout';
import { Roof } from './Roof';

const STORY_H = 3.0;
const ROOF_H = 2.0;
const STONE_H = 1.4;
const GARAGE_W = 5.6;
const GARAGE_H = 2.4;
const DOOR_W = 1.05;
const DOOR_H = 2.15;
const WALL_T = 0.18;

interface HouseProps {
  config: HouseConfig;
}

export function House({ config }: HouseProps) {
  const wallH = config.stories * STORY_H;
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  const { worldX, worldZ, yaw } = houseTransform(config.position, config.depth);

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  return (
    <group position={[worldX, 0, worldZ]} rotation={[0, yaw, 0]}>
      {/* Foundation slab */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[config.width + 0.4, 0.1, config.depth + 0.4]} />
        <meshStandardMaterial color="#9c9890" />
      </mesh>

      {/* Interior floor */}
      <mesh position={[0, 0.11, 0]} receiveShadow>
        <boxGeometry args={[config.width - 0.05, 0.02, config.depth - 0.05]} />
        <meshStandardMaterial color="#7a5f44" />
      </mesh>

      {/* Side walls */}
      <SolidWall position={[-halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} color={config.wallColor} />
      <SolidWall position={[halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} color={config.wallColor} />

      {/* Back wall */}
      <SolidWall position={[0, wallH / 2 + 0.1, halfD]} args={[config.width, wallH, WALL_T]} color={config.wallColor} />

      {/* Front wall with garage + front-door cutouts */}
      <FrontWallWithCutouts
        width={config.width}
        height={wallH}
        thickness={WALL_T}
        color={config.wallColor}
        z={-halfD}
        openings={[
          { x: garageCenterX, w: GARAGE_W, h: GARAGE_H },
          { x: doorCenterX, w: DOOR_W, h: DOOR_H },
        ]}
      />

      {/* Stone accent skirting on the front lower portion */}
      {config.hasStone && (
        <StoneAccent
          width={config.width}
          height={STONE_H}
          z={-halfD - 0.04}
          color={config.stoneColor}
          excludeRanges={[
            { x: garageCenterX, w: GARAGE_W },
            { x: doorCenterX, w: DOOR_W },
          ]}
        />
      )}

      {/* Roof + gable end fillers */}
      <group position={[0, wallH + 0.1, 0]}>
        <Roof width={config.width} depth={config.depth} height={ROOF_H} color={config.roofColor} />
        <GableEnd width={config.width} depth={config.depth} height={ROOF_H} color={config.wallColor} side="left" />
        <GableEnd width={config.width} depth={config.depth} height={ROOF_H} color={config.wallColor} side="right" />
      </group>

      {/* Front door (slightly ajar — invitation) */}
      <FrontDoor x={doorCenterX} z={-halfD} color={config.doorColor} trimColor={config.trimColor} />

      {/* Garage door */}
      <GarageDoor x={garageCenterX} z={-halfD} />

      {/* Front decorative windows */}
      <FrontWindows
        width={config.width}
        stories={config.stories}
        z={-halfD - 0.04}
        garageOnLeft={config.garageOnLeft}
        garageCenterX={garageCenterX}
        doorCenterX={doorCenterX}
        trimColor={config.trimColor}
      />

      {/* Address plaque next to the front door */}
      <AddressPlaque
        address={config.address}
        x={config.garageOnLeft ? halfW - 0.5 : -halfW + 0.5}
        y={2.6}
        z={-halfD - 0.05}
      />
    </group>
  );
}

function SolidWall({
  position,
  args,
  color,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

interface Opening {
  x: number;
  w: number;
  h: number;
}

interface FrontWallProps {
  width: number;
  height: number;
  thickness: number;
  color: string;
  z: number;
  openings: Opening[];
}

function FrontWallWithCutouts({ width, height, thickness, color, z, openings }: FrontWallProps) {
  const sorted = [...openings].sort((a, b) => a.x - b.x);
  const panels: React.ReactElement[] = [];
  let cursor = -width / 2;
  let key = 0;

  for (const op of sorted) {
    const opLeft = op.x - op.w / 2;
    const opRight = op.x + op.w / 2;

    if (opLeft - cursor > 0.01) {
      const w = opLeft - cursor;
      panels.push(
        <mesh
          key={`l${key}`}
          position={[cursor + w / 2, height / 2 + 0.1, z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, height, thickness]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    }

    const aboveH = height - op.h;
    if (aboveH > 0.01) {
      panels.push(
        <mesh
          key={`a${key}`}
          position={[op.x, op.h + aboveH / 2 + 0.1, z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[op.w, aboveH, thickness]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    }

    cursor = opRight;
    key += 1;
  }

  if (width / 2 - cursor > 0.01) {
    const w = width / 2 - cursor;
    panels.push(
      <mesh key="r" position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[w, height, thickness]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return <>{panels}</>;
}

interface StoneProps {
  width: number;
  height: number;
  z: number;
  color: string;
  excludeRanges: Array<{ x: number; w: number }>;
}

function StoneAccent({ width, height, z, color, excludeRanges }: StoneProps) {
  const sorted = [...excludeRanges].sort((a, b) => a.x - b.x);
  const panels: React.ReactElement[] = [];
  let cursor = -width / 2 + 0.1;
  let key = 0;

  for (const op of sorted) {
    const opLeft = op.x - op.w / 2 - 0.05;
    if (opLeft - cursor > 0.05) {
      const w = opLeft - cursor;
      panels.push(
        <mesh
          key={`s${key}`}
          position={[cursor + w / 2, height / 2 + 0.1, z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, height, 0.06]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>
      );
    }
    cursor = op.x + op.w / 2 + 0.05;
    key += 1;
  }

  const right = width / 2 - 0.1;
  if (right - cursor > 0.05) {
    const w = right - cursor;
    panels.push(
      <mesh key="sr" position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[w, height, 0.06]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    );
  }

  return <>{panels}</>;
}

interface GableEndProps {
  width: number;
  depth: number;
  height: number;
  color: string;
  side: 'left' | 'right';
}

function GableEnd({ width, depth, height, color, side }: GableEndProps) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-depth / 2, 0);
    s.lineTo(depth / 2, 0);
    s.lineTo(0, height);
    s.closePath();
    return s;
  }, [depth, height]);

  const x = side === 'left' ? -width / 2 : width / 2;
  const yRot = side === 'left' ? -Math.PI / 2 : Math.PI / 2;

  return (
    <mesh position={[x, 0, 0]} rotation={[0, yRot, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface FrontDoorProps {
  x: number;
  z: number;
  color: string;
  trimColor: string;
}

function FrontDoor({ x, z, color, trimColor }: FrontDoorProps) {
  return (
    <group position={[x, 0, z]}>
      {/* trim */}
      <mesh position={[-DOOR_W / 2 - 0.06, DOOR_H / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.12, DOOR_H + 0.2, 0.18]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[DOOR_W / 2 + 0.06, DOOR_H / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.12, DOOR_H + 0.2, 0.18]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, DOOR_H + 0.16, 0]} castShadow>
        <boxGeometry args={[DOOR_W + 0.24, 0.12, 0.2]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      {/* small porch step */}
      <mesh position={[0, 0.08, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_W + 1.0, 0.16, 0.6]} />
        <meshStandardMaterial color="#bbb5a8" />
      </mesh>
      {/* door panel — hinged on left, swings inward */}
      <group position={[-DOOR_W / 2 + 0.04, DOOR_H / 2 + 0.1, 0]} rotation={[0, -Math.PI / 5, 0]}>
        <mesh position={[(DOOR_W - 0.08) / 2, 0, 0]} castShadow>
          <boxGeometry args={[DOOR_W - 0.08, DOOR_H - 0.06, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[DOOR_W - 0.2, 0, -0.04]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#c89d2a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function GarageDoor({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, GARAGE_H + 0.18, 0]} castShadow>
        <boxGeometry args={[GARAGE_W + 0.3, 0.18, 0.2]} />
        <meshStandardMaterial color="#5a4a3a" />
      </mesh>
      {/* door panel slightly recessed */}
      <mesh position={[0, GARAGE_H / 2 + 0.1, -0.02]} castShadow>
        <boxGeometry args={[GARAGE_W - 0.05, GARAGE_H - 0.05, 0.05]} />
        <meshStandardMaterial color="#dcd2c0" />
      </mesh>
      {/* horizontal panel grooves */}
      {[0.7, 1.3, 1.9].map((y) => (
        <mesh key={y} position={[0, y + 0.1, -0.005]}>
          <boxGeometry args={[GARAGE_W - 0.12, 0.04, 0.015]} />
          <meshStandardMaterial color="#9c9281" />
        </mesh>
      ))}
      {/* top windows row */}
      <mesh position={[0, GARAGE_H - 0.12, 0.005]}>
        <boxGeometry args={[GARAGE_W - 0.6, 0.18, 0.01]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}

interface FrontWindowsProps {
  width: number;
  stories: 1 | 2;
  z: number;
  garageOnLeft: boolean;
  garageCenterX: number;
  doorCenterX: number;
  trimColor: string;
}

function FrontWindows({
  width,
  stories,
  z,
  garageOnLeft,
  garageCenterX,
  doorCenterX,
  trimColor,
}: FrontWindowsProps) {
  const wins: React.ReactElement[] = [];
  const farX = garageOnLeft ? width / 2 - 0.8 : -width / 2 + 0.8;
  const midX = (farX + doorCenterX) / 2;

  // Living-room window between door and far edge
  wins.push(<WindowDeco key="lr" position={[midX, 1.5, z]} w={1.4} h={1.1} trimColor={trimColor} />);

  if (stories === 2) {
    // Three upper-floor windows: above garage (split into 2) + above door
    wins.push(
      <WindowDeco
        key="up-g1"
        position={[garageCenterX - 1.2, 4.5, z]}
        w={1.0}
        h={1.0}
        trimColor={trimColor}
      />
    );
    wins.push(
      <WindowDeco
        key="up-g2"
        position={[garageCenterX + 1.2, 4.5, z]}
        w={1.0}
        h={1.0}
        trimColor={trimColor}
      />
    );
    wins.push(
      <WindowDeco
        key="up-d"
        position={[doorCenterX, 4.5, z]}
        w={1.0}
        h={1.0}
        trimColor={trimColor}
      />
    );
  }

  return <>{wins}</>;
}

interface WindowDecoProps {
  position: [number, number, number];
  w: number;
  h: number;
  trimColor: string;
}

function WindowDeco({ position, w, h, trimColor }: WindowDecoProps) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.06]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[w, h, 0.02]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.3} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[w + 0.04, 0.04, 0.02]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.04, h + 0.04, 0.02]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
    </group>
  );
}

function AddressPlaque({
  address,
  x,
  y,
  z,
}: {
  address: string;
  x: number;
  y: number;
  z: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[0.7, 0.26, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <Text
        position={[0, 0, 0.025]}
        fontSize={0.16}
        color="#f0e8d0"
        anchorX="center"
        anchorY="middle"
      >
        {address}
      </Text>
    </group>
  );
}
