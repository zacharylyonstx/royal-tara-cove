import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { HouseConfig, Lot } from '../types';
import { Roof } from './Roof';
import { Door } from './Door';
import { HouseInterior } from './HouseInterior';
import { mat } from '../world/materials';
import { destructionProgress, destructionPhases } from '../world/houseDestruction';

const STORY_H = 3.0;
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
  // ~6:12 pitch (rise = depth/4 → rise/(depth/2) = 0.5), with a floor so very
  // shallow footprints still read as a pitched roof, not a slab.
  const roofH = Math.max(2.2, config.depth / 4);

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  // Avery Ranch tract look: brick veneer on the street-facing front, tan
  // HardiPlank lap siding on the sides, rear, and gable ends.
  const sidingMaterial = mat.lapSiding(config.sidingColor ?? config.wallColor);
  const brickMaterial = mat.brick(config.brickColor ?? config.stoneColor ?? '#9c5a45');

  // Destruction animation refs (tornado-mode). The dramatic overhaul:
  //   • roof LAUNCHES upward + tumbles + scales away
  //   • body walls tilt then collapse over a 1.4s sequence
  //   • debris fountain (40 boxes) bursts outward + falls under gravity
  //   • dust burst sphere expands to ~12m then fades
  //   • rubble pile materializes at the end
  const bodyRef = useRef<THREE.Group>(null);
  const roofRef = useRef<THREE.Group>(null);
  const rubbleRef = useRef<THREE.Mesh>(null);
  const rubbleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const dustMeshRef = useRef<THREE.Mesh>(null);
  const dustMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Pre-compute debris launch velocities (stable per house instance)
  const debrisLaunch = useMemo(() => {
    const n = 40;
    const arr: { vx: number; vy: number; vz: number; spinX: number; spinY: number; spinZ: number; offsetX: number; offsetZ: number; size: number }[] = [];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      arr.push({
        vx: Math.cos(ang) * speed,
        vy: 6 + Math.random() * 10,
        vz: Math.sin(ang) * speed,
        spinX: (Math.random() - 0.5) * 10,
        spinY: (Math.random() - 0.5) * 10,
        spinZ: (Math.random() - 0.5) * 10,
        offsetX: (Math.random() - 0.5) * 2,
        offsetZ: (Math.random() - 0.5) * 2,
        size: 0.18 + Math.random() * 0.32,
      });
    }
    return arr;
  }, []);

  const tmpDebrisObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const body = bodyRef.current;
    const roof = roofRef.current;
    const rubble = rubbleRef.current;
    const rubMat = rubbleMatRef.current;
    const debris = debrisMeshRef.current;
    const dust = dustMeshRef.current;
    const dustMat = dustMatRef.current;
    if (!body) return;
    const now = performance.now() / 1000;
    const p = destructionProgress(config.address, now);
    if (p <= 0) {
      body.scale.set(1, 1, 1);
      body.rotation.set(0, 0, 0);
      body.visible = true;
      if (roof) { roof.scale.set(1, 1, 1); roof.position.set(0, wallH + 0.1, 0); roof.rotation.set(0, 0, 0); }
      if (rubble) rubble.visible = false;
      if (debris) debris.visible = false;
      if (dust) dust.visible = false;
      return;
    }
    const ph = destructionPhases(p);

    // Roof: launches up + tumbles + shrinks
    if (roof) {
      const liftP = Math.min(1, p * 1.8); // launches faster than the rest
      roof.position.set(
        Math.sin(p * 7) * 1.5,
        wallH + 0.1 + liftP * 9 - liftP * liftP * 4, // parabola up then down
        Math.cos(p * 5) * 1.2,
      );
      roof.rotation.set(p * 7, p * 4, p * 5);
      roof.scale.setScalar(Math.max(0.01, 1 - liftP * 0.85));
    }

    // Body walls: tilt away from tornado, then collapse
    body.rotation.z = ph.wallShrink * -0.4; // 23° tilt
    body.scale.set(1, Math.max(0.02, 1 - ph.wallShrink * 0.95), 1);
    body.visible = body.scale.y > 0.02;

    // Debris fountain
    if (debris) {
      debris.visible = true;
      const dragP = Math.min(1, p * 1.3);
      for (let i = 0; i < debrisLaunch.length; i++) {
        const d = debrisLaunch[i];
        const t = p * 1.4; // seconds-ish since destruction
        const x = d.offsetX + d.vx * t;
        const y = Math.max(0.2, d.vy * t - 12 * t * t); // gravity
        const z = d.offsetZ + d.vz * t;
        tmpDebrisObj.position.set(x, y, z);
        tmpDebrisObj.rotation.set(d.spinX * t, d.spinY * t, d.spinZ * t);
        tmpDebrisObj.scale.setScalar(d.size * (1 - dragP * 0.3));
        tmpDebrisObj.updateMatrix();
        debris.setMatrixAt(i, tmpDebrisObj.matrix);
      }
      debris.instanceMatrix.needsUpdate = true;
    }

    // Dust burst sphere
    if (dust && dustMat) {
      dust.visible = true;
      const dustP = Math.min(1, p * 1.2);
      const radius = 1 + dustP * 11;
      dust.scale.setScalar(radius);
      dustMat.opacity = 0.45 * (1 - dustP);
    }

    if (rubble) {
      rubble.visible = ph.rubble > 0;
      if (rubMat) rubMat.opacity = ph.rubble;
    }
  });

  return (
    <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
      {/* Foundation slab — always visible (even after destruction) */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[config.width + 0.5, 0.1, config.depth + 0.5]} />
        <meshStandardMaterial color="#9c9890" roughness={0.85} />
      </mesh>

      {/* Rubble pile (visible after destruction completes) */}
      <mesh ref={rubbleRef} position={[0, 0.5, 0]} visible={false}>
        <boxGeometry args={[config.width * 0.9, 1.0, config.depth * 0.9]} />
        <meshStandardMaterial
          ref={rubbleMatRef}
          color="#6a5040"
          roughness={1}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Debris fountain (40 instanced boxes launched on destruction) */}
      <instancedMesh
        ref={debrisMeshRef}
        args={[undefined, undefined, debrisLaunch.length]}
        visible={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#7a5a32" roughness={0.85} />
      </instancedMesh>

      {/* Dust burst sphere */}
      <mesh ref={dustMeshRef} position={[0, 2, 0]} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          ref={dustMatRef}
          color="#a89888"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      <group ref={bodyRef}>

      {/* Side walls (lap siding) */}
      <SolidWall position={[-halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={sidingMaterial} />
      <SolidWall position={[halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={sidingMaterial} />

      {/* Back wall (lap siding) */}
      <SolidWall position={[0, wallH / 2 + 0.1, halfD]} args={[config.width, wallH, WALL_T]} material={sidingMaterial} />

      {/* Front wall (brick veneer) with garage + front-door cutouts */}
      <FrontWallWithCutouts
        width={config.width}
        height={wallH}
        thickness={WALL_T}
        material={brickMaterial}
        z={-halfD}
        openings={[
          { x: garageCenterX, w: GARAGE_W, h: GARAGE_H },
          { x: doorCenterX, w: DOOR_W, h: DOOR_H },
        ]}
      />

      {/* Roof + gable end fillers (only for gable roofs) — separate ref so the
          roof can independently drop/scale during the destruction animation */}
      <group ref={roofRef} position={[0, wallH + 0.1, 0]}>
        <Roof
          width={config.width}
          depth={config.depth}
          height={roofH}
          color={config.roofColor}
          hipped={config.hipped}
        />
        {!config.hipped && (
          <>
            <GableEnd width={config.width} depth={config.depth} height={roofH} material={sidingMaterial} side="left" />
            <GableEnd width={config.width} depth={config.depth} height={roofH} material={sidingMaterial} side="right" />
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
      </group> {/* end bodyRef wrapper */}

      {/* Cozy living room — every house is enterable. Renders only when near. */}
      <HouseInterior
        width={config.width}
        depth={config.depth}
        worldX={lot.housePivot[0]}
        worldZ={lot.housePivot[1]}
        seed={config.address.charCodeAt(2) * 13 + config.address.charCodeAt(4) * 7}
      />
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
