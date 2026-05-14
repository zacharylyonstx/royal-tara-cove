import * as THREE from 'three';
import type { HouseConfig, Lot, RectCollider } from '../../types';
import { Roof } from '../Roof';
import { Door } from '../Door';
import { Interior10600 } from './Interior10600';
import { mat } from '../../world/materials';

const STORY_H = 3.0;
const ROOF_H = 2.4;
const STONE_H = 1.6;
const GARAGE_W = 6.4;
const GARAGE_H = 2.6;
const DOOR_W = 1.1;
const DOOR_H = 2.2;
const WALL_T = 0.2;

// Porch dimensions
const PORCH_DEPTH = 2.8;
const PORCH_WIDTH = 5.5;

interface HeroHouseProps {
  config: HouseConfig;
  lot: Lot;
}

export function HeroHouse10600({ config, lot }: HeroHouseProps) {
  const wallH = STORY_H;
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  // garageOnLeft is false → garage on +X side; door on -X side near edge
  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 2.0 : -halfW + 2.4;
  const wallMaterial = mat.stucco(config.wallColor);

  return (
    <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
      {/* Foundation slab */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[config.width + 0.6, 0.1, config.depth + 0.6]} />
        <meshStandardMaterial color="#9c9890" roughness={0.85} />
      </mesh>

      {/* Side walls */}
      <Wall position={[-halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={wallMaterial} />
      <Wall position={[halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={wallMaterial} />

      {/* Back wall (with patio sliding door cutout in middle) */}
      <BackWallWithSlider width={config.width} height={wallH} z={halfD} material={wallMaterial} />

      {/* Front wall with garage cutout + front door cutout + bay window cutout */}
      <FrontWall
        config={config}
        width={config.width}
        height={wallH}
        z={-halfD}
        material={wallMaterial}
        garageCenterX={garageCenterX}
        doorCenterX={doorCenterX}
      />

      {/* Stone wainscot */}
      <StoneWainscot
        width={config.width}
        height={STONE_H}
        z={-halfD - 0.06}
        color={config.stoneColor}
        excludeRanges={[
          { x: garageCenterX, w: GARAGE_W },
          { x: doorCenterX, w: DOOR_W },
          { x: doorCenterX + (config.garageOnLeft ? -2.5 : 2.5), w: 2.6 }, // bay
        ]}
      />

      {/* Bay window (small bumpout under the great-room window) */}
      <BayWindow
        x={doorCenterX + (config.garageOnLeft ? -2.5 : 2.5)}
        z={-halfD - 0.5}
        width={2.4}
        depth={0.8}
        wallMaterial={wallMaterial}
      />

      {/* Hipped roof */}
      <group position={[0, wallH + 0.1, 0]}>
        <Roof
          width={config.width}
          depth={config.depth}
          height={ROOF_H}
          color={config.roofColor}
          hipped={true}
        />
      </group>

      {/* Front door */}
      <Door
        id={`hero-front-${config.address}`}
        x={doorCenterX}
        z={-halfD}
        width={DOOR_W}
        height={DOOR_H}
        color={config.doorColor}
        trimColor={config.trimColor}
        houseWorldX={lot.housePivot[0]}
        houseWorldZ={lot.housePivot[1]}
        houseYaw={lot.houseYaw}
        hinge="left"
      />

      {/* Sliding patio door */}
      <Door
        id={`hero-patio-${config.address}`}
        x={0}
        z={halfD}
        width={1.4}
        height={DOOR_H}
        color="#3a4a5a"
        trimColor={config.trimColor}
        houseWorldX={lot.housePivot[0]}
        houseWorldZ={lot.housePivot[1]}
        houseYaw={lot.houseYaw}
        hinge="right"
      />

      {/* Covered porch (over front door and bay) */}
      <CoveredPorch
        center={[doorCenterX, 0, -halfD - PORCH_DEPTH / 2]}
        width={PORCH_WIDTH}
        depth={PORCH_DEPTH}
        height={2.4}
      />

      {/* Garage door */}
      <GarageDoor x={garageCenterX} z={-halfD} />

      {/* Address plaque */}
      <AddressPlaque x={config.garageOnLeft ? halfW - 0.6 : -halfW + 0.6} y={2.7} z={-halfD - 0.07} />

      {/* Big "10600" copper numbers on the stone wainscot */}
      <BigAddressNumbers x={config.garageOnLeft ? halfW - 1.2 : -halfW + 0.8} y={1.0} z={-halfD - 0.12} />

      {/* Shutters flanking front windows */}
      <Shutter x={doorCenterX + (config.garageOnLeft ? -2.5 : 2.5) - 1.4} y={1.55} z={-halfD - 0.08} />
      <Shutter x={doorCenterX + (config.garageOnLeft ? -2.5 : 2.5) + 1.4} y={1.55} z={-halfD - 0.08} />

      {/* Coach lights flanking the garage door */}
      <CoachLight position={[garageCenterX - GARAGE_W / 2 - 0.25, 1.9, -halfD - 0.12]} />
      <CoachLight position={[garageCenterX + GARAGE_W / 2 + 0.25, 1.9, -halfD - 0.12]} />

      {/* Gutter along the front eaves */}
      <Gutter width={config.width + 0.6} z={-halfD - 0.4} y={wallH + 0.05} />
      {/* Downspouts at corners */}
      <Downspout x={-halfW - 0.18} z={-halfD - 0.3} h={wallH + 0.1} />
      <Downspout x={halfW + 0.18} z={-halfD - 0.3} h={wallH + 0.1} />

      {/* Wreath on the front door */}
      <Wreath x={doorCenterX} y={DOOR_H * 0.55 + 0.1} z={-halfD - 0.05} />

      {/* Doormat */}
      <mesh position={[doorCenterX, 0.13, -halfD - 0.55]} receiveShadow>
        <boxGeometry args={[1.4, 0.04, 0.7]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.95} />
      </mesh>
      {/* HOWDY text on doormat is a stretch — use a simple light center stripe */}
      <mesh position={[doorCenterX, 0.151, -halfD - 0.55]}>
        <boxGeometry args={[1.0, 0.005, 0.45]} />
        <meshStandardMaterial color="#b08458" roughness={0.95} />
      </mesh>

      {/* Porch railing between the columns */}
      <PorchRailing
        x={doorCenterX}
        z={-halfD - PORCH_DEPTH + 0.2}
        width={PORCH_WIDTH - 1}
      />

      {/* Back deck off the patio slider */}
      <BackDeck z={halfD + 0.4} width={config.width - 2} depth={3.5} />

      {/* String lights criss-crossing back deck */}
      <StringLights z={halfD + 2.0} width={config.width - 2.5} />

      {/* Pool in the backyard */}
      <Pool x={2} z={halfD + 9} width={5} depth={3.5} />

      {/* Interior — only rendered when player is within 30m to keep perf tidy */}
      <Interior10600 width={config.width} depth={config.depth} doorCenterX={doorCenterX} garageCenterX={garageCenterX} />
    </group>
  );
}

function Wall({
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

function BackWallWithSlider({
  width,
  height,
  z,
  material,
}: {
  width: number;
  height: number;
  z: number;
  material: THREE.Material;
}) {
  const sliderW = 1.6;
  const sideW = (width - sliderW) / 2;
  return (
    <>
      <mesh position={[-(sliderW / 2 + sideW / 2), height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[sideW, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[sliderW / 2 + sideW / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[sideW, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* header above slider */}
      <mesh position={[0, height - 0.15, z]} castShadow receiveShadow>
        <boxGeometry args={[sliderW + 0.2, 0.3, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
    </>
  );
}

function FrontWall({
  config,
  width,
  height,
  z,
  material,
  garageCenterX,
  doorCenterX,
}: {
  config: HouseConfig;
  width: number;
  height: number;
  z: number;
  material: THREE.Material;
  garageCenterX: number;
  doorCenterX: number;
}) {
  const bayCenterX = doorCenterX + (config.garageOnLeft ? -2.5 : 2.5);
  const openings = [
    { x: garageCenterX, w: GARAGE_W, h: GARAGE_H },
    { x: doorCenterX, w: DOOR_W, h: DOOR_H },
    { x: bayCenterX, w: 2.4, h: 1.6 }, // bay window opening
  ].sort((a, b) => a.x - b.x);

  const panels: React.ReactElement[] = [];
  let cursor = -width / 2;
  let key = 0;

  for (const op of openings) {
    const opLeft = op.x - op.w / 2;
    const opRight = op.x + op.w / 2;

    if (opLeft - cursor > 0.01) {
      const w = opLeft - cursor;
      panels.push(
        <mesh key={`l${key}`} position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[w, height, WALL_T]} />
          <primitive object={material} attach="material" />
        </mesh>,
      );
    }

    const aboveH = height - op.h;
    if (aboveH > 0.01) {
      panels.push(
        <mesh key={`a${key}`} position={[op.x, op.h + aboveH / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[op.w, aboveH, WALL_T]} />
          <primitive object={material} attach="material" />
        </mesh>,
      );
    }

    // For bay window: there's a sill below — keep solid wall up to 0.6m
    if (op === openings.find((o) => o.x === bayCenterX)) {
      panels.push(
        <mesh key={`b${key}`} position={[op.x, 0.4 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[op.w, 0.8, WALL_T]} />
          <primitive object={material} attach="material" />
        </mesh>,
      );
    }

    cursor = opRight;
    key++;
  }

  if (width / 2 - cursor > 0.01) {
    const w = width / 2 - cursor;
    panels.push(
      <mesh key="r" position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[w, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>,
    );
  }

  return <>{panels}</>;
}

function StoneWainscot({
  width,
  height,
  z,
  color,
  excludeRanges,
}: {
  width: number;
  height: number;
  z: number;
  color: string;
  excludeRanges: { x: number; w: number }[];
}) {
  const sorted = [...excludeRanges].sort((a, b) => a.x - b.x);
  const stoneMaterial = mat.stone(color);
  const panels: React.ReactElement[] = [];
  let cursor = -width / 2 + 0.1;
  let key = 0;

  for (const op of sorted) {
    const opLeft = op.x - op.w / 2 - 0.05;
    if (opLeft - cursor > 0.05) {
      const w = opLeft - cursor;
      panels.push(
        <mesh key={`s${key}`} position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[w, height, 0.1]} />
          <primitive object={stoneMaterial} attach="material" />
        </mesh>,
      );
    }
    cursor = op.x + op.w / 2 + 0.05;
    key++;
  }
  const right = width / 2 - 0.1;
  if (right - cursor > 0.05) {
    const w = right - cursor;
    panels.push(
      <mesh key="sr" position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[w, height, 0.1]} />
        <primitive object={stoneMaterial} attach="material" />
      </mesh>,
    );
  }
  return <>{panels}</>;
}

function BayWindow({
  x,
  z,
  width,
  depth,
  wallMaterial,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  wallMaterial: THREE.Material;
}) {
  // A box bay sticking out: low wall (sill), then glass panels facing forward,
  // small hipped cap on top.
  const sillH = 1.0;
  const glassH = 1.4;
  return (
    <group position={[x, 0, z]}>
      {/* sill walls (3 sides) */}
      <mesh position={[0, sillH / 2 + 0.1, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, sillH, 0.12]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
      <mesh position={[width / 2, sillH / 2 + 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, sillH, depth]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
      <mesh position={[-width / 2, sillH / 2 + 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, sillH, depth]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
      {/* Glass panels */}
      <mesh position={[0, sillH + glassH / 2 + 0.1, depth / 2 + 0.005]}>
        <boxGeometry args={[width - 0.1, glassH, 0.04]} />
        <primitive object={mat.glass()} attach="material" />
      </mesh>
      {/* trim above */}
      <mesh position={[0, sillH + glassH + 0.18, depth / 2]} castShadow>
        <boxGeometry args={[width + 0.1, 0.16, 0.18]} />
        <meshStandardMaterial color="#f5ecd9" roughness={0.7} />
      </mesh>
      {/* small hipped cap */}
      <mesh position={[0, sillH + glassH + 0.45, depth / 2 - 0.05]} rotation={[Math.PI / 8, 0, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.1, depth + 0.3]} />
        <meshStandardMaterial color="#5d4a37" />
      </mesh>
    </group>
  );
}

function CoveredPorch({
  center,
  width,
  depth,
  height,
}: {
  center: [number, number, number];
  width: number;
  depth: number;
  height: number;
}) {
  return (
    <group position={center}>
      {/* concrete porch slab */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[width, 0.12, depth]} />
        <primitive object={mat.concrete()} attach="material" />
      </mesh>
      {/* columns at outer corners */}
      {[
        [-width / 2 + 0.2, 0, depth / 2 - 0.2],
        [width / 2 - 0.2, 0, depth / 2 - 0.2],
      ].map(([x, _y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* base */}
          <mesh position={[0, 0.18, 0]} castShadow>
            <boxGeometry args={[0.4, 0.36, 0.4]} />
            <primitive object={mat.stone('#cabb96')} attach="material" />
          </mesh>
          {/* shaft */}
          <mesh position={[0, 0.18 + (height - 0.5) / 2, 0]} castShadow>
            <boxGeometry args={[0.28, height - 0.5, 0.28]} />
            <meshStandardMaterial color="#f5ecd9" roughness={0.7} />
          </mesh>
          {/* capital */}
          <mesh position={[0, height - 0.05, 0]} castShadow>
            <boxGeometry args={[0.42, 0.1, 0.42]} />
            <meshStandardMaterial color="#f5ecd9" />
          </mesh>
        </group>
      ))}
      {/* porch ceiling/roof slab */}
      <mesh position={[0, height + 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.2, 0.18, depth + 0.1]} />
        <meshStandardMaterial color="#5d4a37" />
      </mesh>
      {/* porch ceiling soft underglow */}
      <pointLight position={[0, height - 0.2, 0]} intensity={0.3} color="#fff5d8" distance={5} decay={2} />
    </group>
  );
}

function GarageDoor({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, GARAGE_H + 0.18, 0]} castShadow>
        <boxGeometry args={[GARAGE_W + 0.3, 0.2, 0.24]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.85} />
      </mesh>
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
      <mesh position={[0, 0.1 + (GARAGE_H - 0.05) * 0.875, 0.0]}>
        <boxGeometry args={[GARAGE_W - 0.6, 0.34, 0.02]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.5} roughness={0.2} emissive="#0d1620" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function AddressPlaque({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[1.0, 0.36, 0.06]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.5} />
      </mesh>
    </group>
  );
}

function BigAddressNumbers({ x, y, z }: { x: number; y: number; z: number }) {
  // Just stylized boxes per digit; readable from a distance even without
  // full text geometry.
  const digits = '10600'.split('');
  return (
    <group position={[x, y, z]}>
      {digits.map((_d, i) => (
        <mesh key={i} position={[i * 0.28 - (digits.length - 1) * 0.14, 0, 0]} castShadow>
          <boxGeometry args={[0.22, 0.34, 0.04]} />
          <meshStandardMaterial color="#c8a32a" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {/* subtle "10600" backplate so the numbers read */}
      <mesh position={[0, 0, -0.025]}>
        <boxGeometry args={[digits.length * 0.28 + 0.16, 0.5, 0.02]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Shutter({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.34, 1.4, 0.04]} />
        <meshStandardMaterial color="#2d4a2d" roughness={0.8} />
      </mesh>
      {/* slats */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 0.65 - i * 0.18, 0.025]}>
          <boxGeometry args={[0.3, 0.14, 0.01]} />
          <meshStandardMaterial color="#3a5a3a" />
        </mesh>
      ))}
    </group>
  );
}

function CoachLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* mounting plate */}
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.1, 0.04]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* lantern body */}
      <mesh position={[0, -0.18, 0.08]} castShadow>
        <boxGeometry args={[0.18, 0.32, 0.18]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* glass insert */}
      <mesh position={[0, -0.18, 0.18]}>
        <boxGeometry args={[0.14, 0.26, 0.02]} />
        <meshStandardMaterial color="#fff0a8" emissive="#ffd866" emissiveIntensity={0.85} />
      </mesh>
      <pointLight position={[0, -0.18, 0.25]} intensity={0.5} color="#ffd866" distance={4} decay={2} />
    </group>
  );
}

function Gutter({ width, z, y }: { width: number; z: number; y: number }) {
  return (
    <mesh position={[0, y, z]} castShadow>
      <boxGeometry args={[width, 0.12, 0.18]} />
      <meshStandardMaterial color="#dcd6c8" roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

function Downspout({ x, z, h }: { x: number; z: number; h: number }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <boxGeometry args={[0.1, h, 0.1]} />
      <meshStandardMaterial color="#dcd6c8" roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

function Wreath({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.22, 0.06, 8, 18]} />
        <meshStandardMaterial color="#3a6e34" roughness={0.95} />
      </mesh>
      {/* berries */}
      {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.05]} castShadow>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#c8392a" />
        </mesh>
      ))}
      {/* bow */}
      <mesh position={[0, -0.22, 0.06]} castShadow>
        <boxGeometry args={[0.14, 0.07, 0.02]} />
        <meshStandardMaterial color="#a8392a" />
      </mesh>
    </group>
  );
}

function PorchRailing({ x, z, width }: { x: number; z: number; width: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* top rail */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* bottom rail */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* balusters */}
      {Array.from({ length: 12 }, (_, i) => {
        const bx = -width / 2 + (width / 12) * (i + 0.5);
        return (
          <mesh key={i} position={[bx, 0.62, 0]} castShadow>
            <boxGeometry args={[0.03, 0.7, 0.03]} />
            <meshStandardMaterial color="#f5ecd9" />
          </mesh>
        );
      })}
    </group>
  );
}

function BackDeck({ z, width, depth }: { z: number; width: number; depth: number }) {
  return (
    <group position={[0, 0, z + depth / 2]}>
      {/* deck slab */}
      <mesh position={[0, 0.16, 0]} receiveShadow castShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color="#a07a52" roughness={0.95} />
      </mesh>
      {/* plank lines */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 0.193, -depth / 2 + (depth / 8) * (i + 0.5)]}>
          <boxGeometry args={[width - 0.05, 0.005, 0.02]} />
          <meshStandardMaterial color="#5a3a22" />
        </mesh>
      ))}
      {/* rail posts at the corners */}
      {[-width / 2, width / 2].map((x, i) => (
        <mesh key={i} position={[x, 0.6, depth / 2]} castShadow>
          <boxGeometry args={[0.12, 1.2, 0.12]} />
          <meshStandardMaterial color="#7a5a32" />
        </mesh>
      ))}
      {/* back rail */}
      <mesh position={[0, 1.1, depth / 2]} castShadow>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color="#7a5a32" />
      </mesh>
      <mesh position={[0, 0.4, depth / 2]} castShadow>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color="#7a5a32" />
      </mesh>
    </group>
  );
}

function StringLights({ z, width }: { z: number; width: number }) {
  // Two zig-zags of warm bulbs
  const bulbs: { pos: [number, number, number] }[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = -width / 2 + width * t;
    const y = 2.6 + Math.sin(t * Math.PI) * 0.7; // sag
    bulbs.push({ pos: [x, y, z] });
  }
  return (
    <group>
      {bulbs.map((b, i) => (
        <group key={i} position={b.pos}>
          <mesh castShadow>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#fff0a8" emissive="#ffd866" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Pool({ x, z, width, depth }: { x: number; z: number; width: number; depth: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* coping (brick rim) */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[width + 0.4, 0.12, depth + 0.4]} />
        <meshStandardMaterial color="#a07050" roughness={0.85} />
      </mesh>
      {/* water */}
      <mesh position={[0, 0.13, 0]} receiveShadow>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial color="#2aa6e6" roughness={0.15} metalness={0.4} emissive="#0a3a5a" emissiveIntensity={0.2} transparent opacity={0.85} />
      </mesh>
      {/* lounge chairs */}
      {[-width / 2 - 0.6, width / 2 + 0.6].map((lx, i) => (
        <group key={i} position={[lx, 0, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.5, 0.06, 1.6]} />
            <meshStandardMaterial color="#dcd6c8" />
          </mesh>
          {[-0.18, 0.18].flatMap((bx) => [-0.7, 0.7].map((bz) => [bx, 0.11, bz] as const)).map(([bx, by, bz], j) => (
            <mesh key={j} position={[bx, by, bz]} castShadow>
              <boxGeometry args={[0.04, 0.22, 0.04]} />
              <meshStandardMaterial color="#3a3a3c" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// --- Collider builders for the interior — exported so Game.tsx can include them in staticColliders ---

export function buildInteriorColliders(config: HouseConfig, lot: Lot): RectCollider[] {
  // Interior wall layout (HOUSE-LOCAL coords; +X right, -Z front, +Z back).
  // Then transform to world.
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  // Hallway runs east-west across the middle. Bedrooms in the back half.
  // Garage is on the right (config.garageOnLeft = false).
  // Living/great room: front-left half. Kitchen: middle. Bedrooms: back.

  const localWalls: { cx: number; cz: number; sx: number; sz: number; tag: string }[] = [];

  // Wall between living room and kitchen (north-south wall through middle, leaving doorway)
  localWalls.push({ cx: -1.5, cz: -1.0, sx: 0.15, sz: 4.0, tag: 'lr-kitchen' });

  // Wall between kitchen and hallway (east-west)
  localWalls.push({ cx: -3.0, cz: 1.5, sx: 5.0, sz: 0.15, tag: 'kitchen-hall' });

  // Wall separating bedrooms from hallway
  localWalls.push({ cx: -2.5, cz: 4.0, sx: 6.0, sz: 0.15, tag: 'hall-bed-back' });

  // Bedroom dividers
  localWalls.push({ cx: -5.5, cz: 5.5, sx: 0.15, sz: 3.0, tag: 'penny-luke' });
  localWalls.push({ cx: 0.5, cz: 5.5, sx: 0.15, sz: 3.0, tag: 'master-luke' });

  // Garage interior wall (separates garage from house interior)
  localWalls.push({ cx: 2.0, cz: 0, sx: 0.15, sz: 2 * halfD - 0.4, tag: 'garage-house' });

  // Bathroom walls
  localWalls.push({ cx: 3.0, cz: 4.0, sx: 0.15, sz: 3.0, tag: 'bath-1' });
  localWalls.push({ cx: 4.0, cz: 5.5, sx: 2.0, sz: 0.15, tag: 'bath-2' });

  // Transform to world.
  const cy = Math.cos(lot.houseYaw);
  const sy = Math.sin(lot.houseYaw);
  return localWalls.map((w) => {
    // Each wall is an axis-aligned box in local coords. After yaw rotation,
    // the bounding box may grow. We approximate by rotating the four corners.
    const halfSx = w.sx / 2;
    const halfSz = w.sz / 2;
    const corners: [number, number][] = [
      [w.cx - halfSx, w.cz - halfSz],
      [w.cx + halfSx, w.cz - halfSz],
      [w.cx + halfSx, w.cz + halfSz],
      [w.cx - halfSx, w.cz + halfSz],
    ];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [lx, lz] of corners) {
      const wx = lot.housePivot[0] + lx * cy + lz * sy;
      const wz = lot.housePivot[1] - lx * sy + lz * cy;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
    return { minX, maxX, minZ, maxZ, minY: 0, maxY: 3, tag: `interior-${w.tag}` };
  });
  // suppress unused
  void halfW; void halfD;
}

export function buildPorchColliders(config: HouseConfig, lot: Lot): RectCollider[] {
  const halfD = config.depth / 2;
  const doorCenterX = config.garageOnLeft ? config.width / 2 - 2.0 : -config.width / 2 + 2.4;
  const cy = Math.cos(lot.houseYaw);
  const sy = Math.sin(lot.houseYaw);
  // Two columns at front-outer corners of porch
  const cols: [number, number][] = [
    [doorCenterX - PORCH_WIDTH / 2 + 0.2, -halfD - PORCH_DEPTH + 0.2],
    [doorCenterX + PORCH_WIDTH / 2 - 0.2, -halfD - PORCH_DEPTH + 0.2],
  ];
  return cols.map((c, i) => {
    const wx = lot.housePivot[0] + c[0] * cy + c[1] * sy;
    const wz = lot.housePivot[1] - c[0] * sy + c[1] * cy;
    return {
      minX: wx - 0.2, maxX: wx + 0.2,
      minZ: wz - 0.2, maxZ: wz + 0.2,
      minY: 0, maxY: 2.6,
      tag: `porch-col-${i}`,
    };
  });
}
