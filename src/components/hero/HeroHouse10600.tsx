import * as THREE from 'three';
import type { Floor, HouseConfig, Lot, RectCollider } from '../../types';
import { Roof } from '../Roof';
import { Door } from '../Door';
import { WindowUnit } from '../houseDetail';
import { LiveOak } from '../vegetation/LiveOak';
import { Interior10600 } from './Interior10600';
import { mat } from '../../world/materials';
import { INTERIOR_WALLS, WALL_THICK } from './floorPlan';

const STORY_H = 3.0;
const GARAGE_W = 6.4;
const GARAGE_H = 2.6;
const DOOR_W = 1.1;
const DOOR_H = 2.2;
const WALL_T = 0.2;

// Porch dimensions
const PORCH_DEPTH = 2.8;
const PORCH_WIDTH = 5.5;
// Patio slider sits in Luke's bedroom (x = -1..+2 in the floorPlan manifest).
// Shared by the back-wall mesh, the Door, and the exterior collider gap.
const PATIO_SLIDER_X = 0.5;

interface HeroHouseProps {
  config: HouseConfig;
  lot: Lot;
}

export function HeroHouse10600({ config, lot }: HeroHouseProps) {
  const wallH = STORY_H * config.stories; // 6m for 2-story
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  // garageOnLeft is false → garage on +X side; door on -X side near edge
  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 2.0 : -halfW + 2.4;
  // Real 10600: brick veneer front, tan HardiPlank lap siding on sides/rear.
  const sidingMaterial = mat.lapSiding(config.sidingColor ?? config.wallColor);
  const brickMaterial = mat.brick(config.brickColor ?? config.stoneColor ?? '#9c5a45');

  return (
    <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
      {/* Foundation slab */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[config.width + 0.6, 0.1, config.depth + 0.6]} />
        <meshStandardMaterial color="#9c9890" roughness={0.85} />
      </mesh>

      {/* Side walls (lap siding) */}
      <Wall position={[-halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={sidingMaterial} />
      <Wall position={[halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={sidingMaterial} />

      {/* Back wall (lap siding) with patio sliding door cutout in middle */}
      <BackWallWithSlider width={config.width} height={wallH} z={halfD} centerX={PATIO_SLIDER_X} material={sidingMaterial} />

      {/* Front wall (brick veneer) with garage + front door + bay window cutouts */}
      <FrontWall
        config={config}
        width={config.width}
        height={wallH}
        z={-halfD}
        material={brickMaterial}
        garageCenterX={garageCenterX}
        doorCenterX={doorCenterX}
      />

      {/* Ground-floor great-room window — the big mulled picture window that
          faces the street (this was previously blank brick). */}
      {/* Tall formal living/dining window — its height hints at the double-height
          ceiling inside. Topped by a brick arch (the remembered arched window). */}
      <WindowUnit
        position={[(doorCenterX + garageCenterX) / 2, 1.95, -halfD - 0.18]}
        w={3.0} h={2.7} cols={3} rows={3}
        facing="-z" trimColor={config.trimColor}
      />
      <mesh position={[(doorCenterX + garageCenterX) / 2, 3.35, -halfD - 0.13]} rotation={[0, Math.PI, 0]} castShadow>
        <circleGeometry args={[1.62, 24, 0, Math.PI]} />
        <primitive object={mat.brick(config.brickColor ?? '#ddb999')} attach="material" />
      </mesh>
      {/* white keystone/trim band along the arch base */}
      <mesh position={[(doorCenterX + garageCenterX) / 2, 3.34, -halfD - 0.2]} castShadow>
        <boxGeometry args={[3.3, 0.12, 0.1]} />
        <meshStandardMaterial color={config.trimColor} roughness={0.7} />
      </mesh>

      {/* Upper-floor windows on front (visible because we're 2 stories) */}
      {config.stories === 2 && (
        <>
          <WindowUnit position={[doorCenterX, STORY_H + 1.55, -halfD - 0.18]} w={1.2} h={1.45} cols={2} rows={3} facing="-z" shutters shutterColor="#26352a" trimColor={config.trimColor} />
          <WindowUnit position={[doorCenterX + (config.garageOnLeft ? -2.5 : 2.5), STORY_H + 1.55, -halfD - 0.18]} w={1.2} h={1.45} cols={2} rows={3} facing="-z" shutters shutterColor="#26352a" trimColor={config.trimColor} />
          <WindowUnit position={[(doorCenterX + garageCenterX) / 2, STORY_H + 1.55, -halfD - 0.18]} w={1.8} h={1.45} cols={3} rows={3} facing="-z" trimColor={config.trimColor} />
          <WindowUnit position={[garageCenterX - 1.5, STORY_H + 1.55, -halfD - 0.18]} w={1.2} h={1.45} cols={2} rows={3} facing="-z" shutters shutterColor="#26352a" trimColor={config.trimColor} />
          <WindowUnit position={[garageCenterX + 1.5, STORY_H + 1.55, -halfD - 0.18]} w={1.2} h={1.45} cols={2} rows={3} facing="-z" shutters shutterColor="#26352a" trimColor={config.trimColor} />
          {/* Side windows upstairs */}
          <WindowUnit position={[-halfW - 0.18, STORY_H + 1.55, -halfD * 0.4]} w={1.0} h={1.3} cols={2} rows={2} facing="-x" trimColor={config.trimColor} />
          <WindowUnit position={[-halfW - 0.18, STORY_H + 1.55, halfD * 0.4]} w={1.0} h={1.3} cols={2} rows={2} facing="-x" trimColor={config.trimColor} />
          <WindowUnit position={[halfW + 0.18, STORY_H + 1.55, -halfD * 0.4]} w={1.0} h={1.3} cols={2} rows={2} facing="x" trimColor={config.trimColor} />
          <WindowUnit position={[halfW + 0.18, STORY_H + 1.55, halfD * 0.4]} w={1.0} h={1.3} cols={2} rows={2} facing="x" trimColor={config.trimColor} />
        </>
      )}

      {/* Bay window (small bumpout under the great-room window) — brick to match front */}
      <BayWindow
        x={doorCenterX + (config.garageOnLeft ? -2.5 : 2.5)}
        z={-halfD - 0.5}
        width={2.4}
        depth={0.8}
        wallMaterial={brickMaterial}
      />

      {/* Hipped roof */}
      <group position={[0, wallH + 0.1, 0]}>
        <Roof
          width={config.width}
          depth={config.depth}
          height={config.depth / 4}
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
        x={PATIO_SLIDER_X}
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

      {/* Coach lights flanking the garage door */}
      <CoachLight position={[garageCenterX - GARAGE_W / 2 - 0.25, 1.9, -halfD - 0.12]} />
      <CoachLight position={[garageCenterX + GARAGE_W / 2 + 0.25, 1.9, -halfD - 0.12]} />

      {/* Gutter along the front eaves */}
      <Gutter width={config.width + 0.6} z={-halfD - 0.4} y={wallH + 0.05} />
      {/* Downspouts at corners */}
      <Downspout x={-halfW - 0.18} z={-halfD - 0.3} h={wallH + 0.1} />
      <Downspout x={halfW + 0.18} z={-halfD - 0.3} h={wallH + 0.1} />

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

      {/* --- Front-yard memory landmarks --- */}
      {/* The big live oak on the LEFT front yard with a circular brick ring. */}
      <LiveOak position={[-halfW + 1.5, 0, -halfD - 5.2]} scale={1.55} seed={4} />
      <mesh position={[-halfW + 1.5, 0.09, -halfD - 5.2]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.18, 22]} />
        <meshStandardMaterial color="#a8835f" roughness={0.9} />
      </mesh>
      <mesh position={[-halfW + 1.5, 0.16, -halfD - 5.2]} receiveShadow>
        <cylinderGeometry args={[1.25, 1.25, 0.1, 22]} />
        <meshStandardMaterial color="#4a3526" roughness={1} />
      </mesh>
      {/* Rounded shrub mass along the front, in front of the formal window. */}
      {[-3.3, -2.2, -1.1, 0.0, 1.1].map((dx, i) => (
        <mesh key={`shrub-${i}`} position={[(doorCenterX + garageCenterX) / 2 + dx, 0.42, -halfD - 0.95]} castShadow>
          <icosahedronGeometry args={[0.46 + (i % 2) * 0.07, 0]} />
          <meshStandardMaterial color={i % 2 ? '#4a7a3a' : '#3f6e34'} roughness={1} flatShading />
        </mesh>
      ))}
      {/* American flag angled off the left porch column. */}
      <group position={[doorCenterX - PORCH_WIDTH / 2 + 0.25, 2.25, -halfD - PORCH_DEPTH + 0.35]} rotation={[0, 0, -0.9]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 8]} />
          <meshStandardMaterial color="#caa14a" metalness={0.5} roughness={0.4} />
        </mesh>
        <group position={[0, 1.05, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh><boxGeometry args={[0.62, 0.02, 0.42]} /><meshStandardMaterial color="#b22234" /></mesh>
          <mesh position={[0, 0.011, 0.06]}><boxGeometry args={[0.62, 0.02, 0.06]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 0.011, 0.18]}><boxGeometry args={[0.62, 0.02, 0.06]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[-0.16, 0.012, -0.12]}><boxGeometry args={[0.3, 0.02, 0.18]} /><meshStandardMaterial color="#3c3b6e" /></mesh>
        </group>
      </group>
      {/* Greenbelt: dense trees behind the back fence (the "backs to woods" feel). */}
      {[-7, -2.5, 2, 6.5].map((gx, i) => (
        <LiveOak key={`green-${i}`} position={[gx, 0, halfD + 17 + (i % 2) * 3]} scale={1.7} seed={i + 20} />
      ))}

      {/* Back deck off the patio slider */}
      <BackDeck z={halfD + 0.4} width={config.width - 2} depth={3.5} />

      {/* String lights criss-crossing back deck */}
      <StringLights z={halfD + 2.0} width={config.width - 2.5} />

      {/* Pool in the backyard */}
      <Pool x={2} z={halfD + 9} width={5} depth={3.5} />

      {/* Interior — only rendered when player is within 30m to keep perf tidy */}
      <Interior10600 depth={config.depth} doorCenterX={doorCenterX} garageCenterX={garageCenterX} />
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
  centerX,
  material,
}: {
  width: number;
  height: number;
  z: number;
  centerX: number;
  material: THREE.Material;
}) {
  const sliderW = 1.6;
  const halfSlider = sliderW / 2;
  const leftEnd = -width / 2;
  const rightEnd = width / 2;
  const sliderLeft = centerX - halfSlider;
  const sliderRight = centerX + halfSlider;
  const leftW = sliderLeft - leftEnd;
  const rightW = rightEnd - sliderRight;
  return (
    <>
      <mesh position={[leftEnd + leftW / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[leftW, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[sliderRight + rightW / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[rightW, height, WALL_T]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* header above slider */}
      <mesh position={[centerX, height - 0.15, z]} castShadow receiveShadow>
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
  void config; // accepted for symmetry with sibling builders, not currently used
  const cy = Math.cos(lot.houseYaw);
  const sy = Math.sin(lot.houseYaw);

  const out: RectCollider[] = [];
  for (const w of INTERIOR_WALLS) {
    // Split the wall into solid segments around its openings.
    const ops = [...w.openings].sort((a, b) => a.from - b.from);
    const segments: { from: number; to: number }[] = [];
    let cursor = w.from;
    for (const op of ops) {
      if (op.from - cursor > 0.001) segments.push({ from: cursor, to: op.from });
      cursor = op.to;
    }
    if (w.to - cursor > 0.001) segments.push({ from: cursor, to: w.to });

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const center = (s.from + s.to) / 2;
      const span = s.to - s.from;
      // House-local axis-aligned box; corners rotated to world via houseYaw.
      const halfA = span / 2;
      const halfB = WALL_THICK / 2;
      let cx: number, cz: number, halfX: number, halfZ: number;
      if (w.axis === 'x') {
        cx = center; cz = w.at; halfX = halfA; halfZ = halfB;
      } else {
        cx = w.at; cz = center; halfX = halfB; halfZ = halfA;
      }
      const corners: [number, number][] = [
        [cx - halfX, cz - halfZ], [cx + halfX, cz - halfZ],
        [cx + halfX, cz + halfZ], [cx - halfX, cz + halfZ],
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
      out.push({ minX, maxX, minZ, maxZ, minY: 0, maxY: 3, tag: `interior-${w.tag}-${i}` });
    }
  }
  return out;
}

/**
 * Exterior wall colliders for 10600 — replaces the solid house-body AABB
 * that would otherwise block the front door entirely. Walls are split
 * around the front door (1.1m gap) and back patio slider (1.6m gap) so
 * those Door entries can actually be passed through when open. Garage
 * door + bay window stay as solid walls (no expectation of walking
 * through a closed garage door). A thin ceiling collider keeps the
 * player off the roof.
 */
export function buildHeroExteriorColliders(config: HouseConfig, lot: Lot): RectCollider[] {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const wallH = STORY_H * config.stories;
  const doorCenterX = config.garageOnLeft ? halfW - 2.0 : -halfW + 2.4;
  const doorHalf = DOOR_W / 2;
  const sliderHalf = 1.6 / 2;

  // Each entry is an axis-aligned rectangle in HOUSE-LOCAL (x, z) space.
  const localWalls = [
    // Front wall: split around front door
    { cx: (-halfW + (doorCenterX - doorHalf)) / 2, cz: -halfD, sx: (doorCenterX - doorHalf) - (-halfW), sz: WALL_T, tag: 'front-l' },
    { cx: ((doorCenterX + doorHalf) + halfW) / 2, cz: -halfD, sx: halfW - (doorCenterX + doorHalf), sz: WALL_T, tag: 'front-r' },
    // Back wall: split around patio slider relocated to x = +0.5 (inside Luke's room)
    { cx: (-halfW + (PATIO_SLIDER_X - sliderHalf)) / 2, cz: halfD, sx: (PATIO_SLIDER_X - sliderHalf) - (-halfW), sz: WALL_T, tag: 'back-l' },
    { cx: ((PATIO_SLIDER_X + sliderHalf) + halfW) / 2, cz: halfD, sx: halfW - (PATIO_SLIDER_X + sliderHalf), sz: WALL_T, tag: 'back-r' },
    // Left side wall: solid
    { cx: -halfW, cz: 0, sx: WALL_T, sz: 2 * halfD, tag: 'side-l' },
    // Right side wall: solid
    { cx: halfW, cz: 0, sx: WALL_T, sz: 2 * halfD, tag: 'side-r' },
  ];

  const cy = Math.cos(lot.houseYaw);
  const sy = Math.sin(lot.houseYaw);
  const out: RectCollider[] = localWalls.map((w) => {
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
    return { minX, maxX, minZ, maxZ, minY: 0, maxY: wallH, tag: `hero-ext-${w.tag}` };
  });

  // (Ceiling collider intentionally omitted: resolveMotion is purely 2D in
  // XZ and would treat a roof-height AABB as a wall, blocking entry through
  // the front door. Player can't jump 6m anyway — gravity caps it.)
  return out;
}

/**
 * Floors that the player can stand on inside the hero house. Two pieces:
 *   1. A staircase ramp running west-to-east (climbs as x increases) along
 *      the back-left wall of the great room.
 *   2. A second-floor loft platform spanning the back-half of the upstairs.
 *
 * Local coords (rotated to world via lot.houseYaw):
 *   stairs base: (x=-8.4..-5.0, z=-2.5..-1.4) climbs 0 → STORY_H
 *   loft floor: (x=-9..-2, z=-3..3.5) at y = STORY_H
 */
export function buildHeroFloors(_config: HouseConfig, lot: Lot): Floor[] {
  const cy = Math.cos(lot.houseYaw);
  const sy = Math.sin(lot.houseYaw);
  // Convert each axis-aligned LOCAL rect to a WORLD-aligned bounding rect.
  // (For yaws that are multiples of π/2 this is exact. The hero house at
  // angleDeg=90 has yaw=0, so local==world here.)
  const toWorldRect = (lx0: number, lz0: number, lx1: number, lz1: number) => {
    const corners: [number, number][] = [
      [lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1],
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
    return { minX, maxX, minZ, maxZ };
  };

  // Stairs run along the right wall and climb FRONT→BACK (+Z); loft spans the full
  // great-room width over the back portion. Must match StairsAndLoft.tsx.
  const stairs = toWorldRect(-8.85, -3.7, -7.6, -0.3);
  const loft = toWorldRect(-9.0, -3.0, 2.0, 0.0);

  return [
    // Staircase ramp: climbs as z INCREASES (front -3.7 → back -0.3).
    { ...stairs, baseY: 0, topY: STORY_H, axis: 'z' as const },
    // Flat upper-floor loft.
    { ...loft, baseY: STORY_H, topY: STORY_H },
  ];
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
