import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import type { HouseConfig, Lot } from '../types';
import { Roof } from './Roof';
import { Door } from './Door';
import { mat } from '../world/materials';

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
  lot: Lot;
}

export function House({ config, lot }: HouseProps) {
  const wallH = config.stories * STORY_H;
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  const wallMaterial = mat.stucco(config.wallColor);

  return (
    <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
      {/* Foundation slab */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[config.width + 0.5, 0.1, config.depth + 0.5]} />
        <meshStandardMaterial color="#9c9890" roughness={0.85} />
      </mesh>

      {/* Side walls */}
      <SolidWall position={[-halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={wallMaterial} />
      <SolidWall position={[halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={wallMaterial} />

      {/* Back wall */}
      <SolidWall position={[0, wallH / 2 + 0.1, halfD]} args={[config.width, wallH, WALL_T]} material={wallMaterial} />

      {/* Front wall with garage + front-door cutouts */}
      <FrontWallWithCutouts
        width={config.width}
        height={wallH}
        thickness={WALL_T}
        material={wallMaterial}
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
          z={-halfD - 0.05}
          color={config.stoneColor}
          excludeRanges={[
            { x: garageCenterX, w: GARAGE_W },
            { x: doorCenterX, w: DOOR_W },
          ]}
        />
      )}

      {/* Roof + gable end fillers (only for gable roofs) */}
      <group position={[0, wallH + 0.1, 0]}>
        <Roof
          width={config.width}
          depth={config.depth}
          height={ROOF_H}
          color={config.roofColor}
          hipped={config.hipped}
        />
        {!config.hipped && (
          <>
            <GableEnd width={config.width} depth={config.depth} height={ROOF_H} material={wallMaterial} side="left" />
            <GableEnd width={config.width} depth={config.depth} height={ROOF_H} material={wallMaterial} side="right" />
          </>
        )}
      </group>

      {/* Front door (animated, openable, registers as a Door for interaction) */}
      <Door
        id={`house-${config.address}`}
        x={doorCenterX}
        z={-halfD}
        width={DOOR_W}
        height={DOOR_H}
        color={config.doorColor}
        trimColor={config.trimColor}
        houseWorldX={lot.housePivot[0]}
        houseWorldZ={lot.housePivot[1]}
        houseYaw={lot.houseYaw}
      />

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
        z={-halfD - 0.06}
      />

      {/* Soffit shadow line under eaves (subtle) */}
      <mesh position={[0, wallH + 0.05, 0]}>
        <boxGeometry args={[config.width + 0.6, 0.06, config.depth + 0.6]} />
        <meshStandardMaterial color="#6a5d48" />
      </mesh>
    </group>
  );
}

function SolidWall({
  position,
  args,
  material,
}: {
  position: [number, number, number];
  args: [number, number, number];
  material: THREE.Material;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

interface Opening { x: number; w: number; h: number; }

interface FrontWallProps {
  width: number;
  height: number;
  thickness: number;
  material: THREE.Material;
  z: number;
  openings: Opening[];
}

function FrontWallWithCutouts({ width, height, thickness, material, z, openings }: FrontWallProps) {
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
        <mesh key={`l${key}`} position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[w, height, thickness]} />
          <primitive object={material} attach="material" />
        </mesh>,
      );
    }

    const aboveH = height - op.h;
    if (aboveH > 0.01) {
      panels.push(
        <mesh key={`a${key}`} position={[op.x, op.h + aboveH / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[op.w, aboveH, thickness]} />
          <primitive object={material} attach="material" />
        </mesh>,
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
        <primitive object={material} attach="material" />
      </mesh>,
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
  const stoneMaterial = mat.stone(color);

  for (const op of sorted) {
    const opLeft = op.x - op.w / 2 - 0.05;
    if (opLeft - cursor > 0.05) {
      const w = opLeft - cursor;
      panels.push(
        <mesh key={`s${key}`} position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[w, height, 0.08]} />
          <primitive object={stoneMaterial} attach="material" />
        </mesh>,
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
        <boxGeometry args={[w, height, 0.08]} />
        <primitive object={stoneMaterial} attach="material" />
      </mesh>,
    );
  }

  return <>{panels}</>;
}

interface GableEndProps {
  width: number;
  depth: number;
  height: number;
  material: THREE.Material;
  side: 'left' | 'right';
}

function GableEnd({ width, depth, height, material, side }: GableEndProps) {
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
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function GarageDoor({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* trim header */}
      <mesh position={[0, GARAGE_H + 0.18, 0]} castShadow>
        <boxGeometry args={[GARAGE_W + 0.3, 0.18, 0.22]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.85} />
      </mesh>
      {/* door panel — 4 stacked sections with rounded grooves */}
      {[0, 1, 2, 3].map((i) => {
        const sectionH = (GARAGE_H - 0.05) / 4;
        const yC = 0.1 + sectionH * (i + 0.5);
        return (
          <mesh key={i} position={[0, yC, -0.04]} castShadow>
            <boxGeometry args={[GARAGE_W - 0.05, sectionH - 0.04, 0.06]} />
            <meshStandardMaterial color="#dcd2c0" roughness={0.7} metalness={0.1} />
          </mesh>
        );
      })}
      {/* top windows row (in the topmost section) */}
      <mesh position={[0, 0.1 + (GARAGE_H - 0.05) * 0.875, 0.0]}>
        <boxGeometry args={[GARAGE_W - 0.6, 0.32, 0.02]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.5} roughness={0.2} emissive="#0d1620" emissiveIntensity={0.4} />
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
  doorCenterX,
  garageCenterX,
  trimColor,
}: FrontWindowsProps) {
  const wins: React.ReactElement[] = [];
  const farX = garageOnLeft ? width / 2 - 0.8 : -width / 2 + 0.8;
  const midX = (farX + doorCenterX) / 2;

  // Living-room window between door and far edge
  wins.push(<WindowDeco key="lr" position={[midX, 1.55, z]} w={1.6} h={1.2} trimColor={trimColor} />);

  if (stories === 2) {
    wins.push(<WindowDeco key="up-g1" position={[garageCenterX - 1.2, 4.5, z]} w={1.0} h={1.0} trimColor={trimColor} />);
    wins.push(<WindowDeco key="up-g2" position={[garageCenterX + 1.2, 4.5, z]} w={1.0} h={1.0} trimColor={trimColor} />);
    wins.push(<WindowDeco key="up-d" position={[doorCenterX, 4.5, z]} w={1.0} h={1.0} trimColor={trimColor} />);
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
      {/* outer frame */}
      <mesh castShadow>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.08]} />
        <meshStandardMaterial color={trimColor} roughness={0.65} />
      </mesh>
      {/* glass pane (recessed) */}
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[w, h, 0.02]} />
        <primitive object={mat.glass()} attach="material" />
      </mesh>
      {/* mullions */}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[w + 0.04, 0.06, 0.02]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.06, h + 0.04, 0.02]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      {/* sill */}
      <mesh position={[0, -h / 2 - 0.12, 0.02]} castShadow>
        <boxGeometry args={[w + 0.3, 0.08, 0.18]} />
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
        <boxGeometry args={[0.78, 0.3, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
      </mesh>
      <Text
        position={[0, 0, 0.03]}
        fontSize={0.18}
        color="#f5d35a"
        anchorX="center"
        anchorY="middle"
      >
        {address}
      </Text>
    </group>
  );
}
