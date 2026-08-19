import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { Door } from '../Door';
import {
  SCHOOL_CX, SCHOOL_CZ, SCHOOL_YAW, SCHOOL_HALF_D,
  SCHOOL_MIN_X, SCHOOL_MAX_X, SCHOOL_MIN_Z, SCHOOL_MAX_Z,
  SCHOOL_WALL_H, EXT_WALL_T, INT_WALL_T,
  SCHOOL_DOOR_ID, SCHOOL_DOOR_Z, SCHOOL_DOOR_W, SCHOOL_DOOR_H,
  JAMB_X, JAMB_D, JAMB_W, JAMB_N_Z, JAMB_S_Z, JAMB_H,
  HALL_N_Z, HALL_S_Z, DIV_X, ROOM_GAP_W,
  CLASSA_DOOR_X, CLASSB_DOOR_X, CAFE_DOOR_X, LIB_DOOR_X,
  LOCKER_Z, LOCKER_W, LOCKER_D, LOCKER_H, LOCKER_XS, LOCKER_COLORS,
  WHITEBOARD_WALL_X, TEACHER_DESK_X, TEACHER_CHAIR_X,
  CLASSA_TEACHER_Z, CLASSB_TEACHER_Z,
  DESK_ROW_XS, DESK_W, DESK_D, CHAIR_DX,
  CLASSA_DESK_ZS, CLASSB_DESK_ZS,
  COUNTER_X, COUNTER_Z, COUNTER_W, COUNTER_D, COUNTER_H,
  CAFE_TABLE_XS, CAFE_TABLE_Z, CAFE_TABLE_W, CAFE_TABLE_L,
  CAFE_BENCH_DX, CAFE_BENCH_W, CAFE_BENCH_L,
  SHELF_X, SHELF_ZS, SHELF_W, SHELF_L, SHELF_H,
  EASEL_X, EASEL_Z, ART_TABLE_X, ART_TABLE_Z,
  WALKWAY_Z, WALKWAY_END_X, FLAG_X, FLAG_Z,
  YARD_BENCH_X, YARD_BENCH_Z, ZONE_SIGN_X, ZONE_SIGN_Z,
} from '../../world/school';

// The whole school renders inside a group yawed −π/2 so the Door component's
// local −Z wall is the WORLD east (front) wall. Everything below is laid out
// in WORLD coordinates (matching school.ts colliders exactly) and converted:
//   local x = worldZ − SCHOOL_CZ,  local z = SCHOOL_CX − worldX
const lp = (wx: number, wz: number, y: number): [number, number, number] =>
  [wz - SCHOOL_CZ, y, SCHOOL_CX - wx];
// rotation.y (in the yawed group) that makes a default plane/Text face a world direction:
const FACE_E = Math.PI;
const FACE_W = 0;
const FACE_N = -Math.PI / 2;
const FACE_S = Math.PI / 2;

const MARKER_BLUE = '#2456b8';

/**
 * "Avery Ranch Elementary" — a calm, low-poly pretend-play school west of the
 * duck pond. Two classrooms with whiteboards + desks, a cafeteria, a
 * library/art room, and a locker-lined hallway behind a real openable red
 * front door. Pure stage — no quizzes, no UI. Colliders live in
 * world/school.ts (buildSchoolColliders, appended in buildAcrossBlvdColliders).
 */
export function School() {
  const R = useMemo(() => {
    const std = (color: string, roughness = 0.9, extra?: Partial<THREE.MeshStandardMaterialParameters>) =>
      new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    return {
      box: new THREE.BoxGeometry(1, 1, 1),
      plane: new THREE.PlaneGeometry(1, 1),
      mats: {
        brick: std('#c9a97c', 0.95),
        cream: std('#efe6d4', 0.9),
        trim: std('#f3eee4', 0.7),
        roof: std('#565a5e', 0.95),
        parapet: std('#b09a78', 0.9),
        floorGreen: std('#7c9a6f', 1),
        floorBeige: std('#d8cfba', 1),
        floorLib: std('#cfc0a8', 1),
        concrete: std('#c9c2b4', 1),
        glass: std('#27323c', 0.15, { metalness: 0.4, transparent: true, opacity: 0.92 }),
        wood: std('#8a6a4a', 0.8),
        woodLight: std('#b08d5e', 0.8),
        deskTop: std('#d9c8a8', 0.7),
        tableTop: std('#e8e2d2', 0.7),
        tableBase: std('#9aa0a6', 0.55, { metalness: 0.35 }),
        boardWhite: std('#f8f6f0', 0.35),
        signGreen: std('#274e36', 0.8),
        metal: std('#7a8288', 0.4, { metalness: 0.6 }),
        red: std('#b03a2e', 0.7),
        white: std('#f5f2ea', 0.7),
        signYG: std('#cdd94e', 0.7),
        panel: std('#fbf7ec', 0.6, { emissive: '#fff6e0', emissiveIntensity: 0.6 }),
        accents: LOCKER_COLORS.map((c) => std(c, 0.7)),
      },
    };
  }, []);
  const M = R.mats;

  // World-plan box: sx along world X, sz along world Z, h tall, centered at y.
  const B = (key: string, wx: number, wz: number, y: number, sx: number, sz: number, h: number, mat: THREE.Material) => (
    <mesh key={key} geometry={R.box} material={mat} position={lp(wx, wz, y)} scale={[sz, h, sx]} castShadow receiveShadow />
  );
  // Flat floor rect (world-plan), slightly above the ground plane.
  const F = (key: string, wx: number, wz: number, sx: number, sz: number, mat: THREE.Material, y = 0.012) => (
    <mesh key={key} geometry={R.plane} material={mat} position={lp(wx, wz, y)} rotation={[-Math.PI / 2, 0, 0]} scale={[sz, sx, 1]} receiveShadow />
  );
  // Wall-mounted plane facing a world direction.
  const WP = (key: string, wx: number, wz: number, y: number, w: number, h: number, face: number, mat: THREE.Material) => (
    <mesh key={key} geometry={R.plane} material={mat} position={lp(wx, wz, y)} rotation={[0, face, 0]} scale={[w, h, 1]} />
  );

  const wallH = SCHOOL_WALL_H;
  const doorHalf = SCHOOL_DOOR_W / 2;
  const gapHalf = ROOM_GAP_W / 2;

  // ---- Walls (visuals mirror buildSchoolColliders segment-for-segment) ----
  const walls: ReactNode[] = [];
  // Front (east) wall split around the door gap + header over the door.
  const frontNC = (SCHOOL_MIN_Z + (SCHOOL_DOOR_Z - doorHalf)) / 2;
  const frontSC = ((SCHOOL_DOOR_Z + doorHalf) + SCHOOL_MAX_Z) / 2;
  const frontSeg = SCHOOL_DOOR_Z - doorHalf - SCHOOL_MIN_Z;
  walls.push(B('w-front-n', SCHOOL_MAX_X, frontNC, wallH / 2, EXT_WALL_T, frontSeg, wallH, M.brick));
  walls.push(B('w-front-s', SCHOOL_MAX_X, frontSC, wallH / 2, EXT_WALL_T, frontSeg, wallH, M.brick));
  walls.push(B('w-front-hdr', SCHOOL_MAX_X, SCHOOL_DOOR_Z, (SCHOOL_DOOR_H + wallH) / 2, EXT_WALL_T, SCHOOL_DOOR_W, wallH - SCHOOL_DOOR_H, M.brick));
  walls.push(B('w-back', SCHOOL_MIN_X, SCHOOL_DOOR_Z, wallH / 2, EXT_WALL_T, SCHOOL_MAX_Z - SCHOOL_MIN_Z + EXT_WALL_T, wallH, M.brick));
  walls.push(B('w-north', SCHOOL_CX, SCHOOL_MIN_Z, wallH / 2, SCHOOL_MAX_X - SCHOOL_MIN_X + EXT_WALL_T, EXT_WALL_T, wallH, M.brick));
  walls.push(B('w-south', SCHOOL_CX, SCHOOL_MAX_Z, wallH / 2, SCHOOL_MAX_X - SCHOOL_MIN_X + EXT_WALL_T, EXT_WALL_T, wallH, M.brick));
  // Vestibule jamb pilasters (they also make the closed front door seal — see school.ts).
  walls.push(B('w-jamb-n', JAMB_X, JAMB_N_Z, JAMB_H / 2, JAMB_D, JAMB_W, JAMB_H, M.cream));
  walls.push(B('w-jamb-s', JAMB_X, JAMB_S_Z, JAMB_H / 2, JAMB_D, JAMB_W, JAMB_H, M.cream));
  // Hall walls (three segments each) + doorway headers.
  for (const [wz, classDoorX, eastDoorX, side] of [
    [HALL_N_Z, CLASSA_DOOR_X, CAFE_DOOR_X, 'n'],
    [HALL_S_Z, CLASSB_DOOR_X, LIB_DOOR_X, 's'],
  ] as [number, number, number, string][]) {
    const aR = classDoorX - gapHalf;
    const bL = classDoorX + gapHalf;
    const bR = eastDoorX - gapHalf;
    const cL = eastDoorX + gapHalf;
    walls.push(B(`w-hall-${side}1`, (SCHOOL_MIN_X + aR) / 2, wz, wallH / 2, aR - SCHOOL_MIN_X, INT_WALL_T, wallH, M.cream));
    walls.push(B(`w-hall-${side}2`, (bL + bR) / 2, wz, wallH / 2, bR - bL, INT_WALL_T, wallH, M.cream));
    walls.push(B(`w-hall-${side}3`, (cL + SCHOOL_MAX_X) / 2, wz, wallH / 2, SCHOOL_MAX_X - cL, INT_WALL_T, wallH, M.cream));
    walls.push(B(`w-hdr-${side}a`, classDoorX, wz, (2.4 + wallH) / 2, ROOM_GAP_W, INT_WALL_T, wallH - 2.4, M.cream));
    walls.push(B(`w-hdr-${side}b`, eastDoorX, wz, (2.4 + wallH) / 2, ROOM_GAP_W, INT_WALL_T, wallH - 2.4, M.cream));
  }
  walls.push(B('w-div-n', DIV_X, (SCHOOL_MIN_Z + HALL_N_Z) / 2, wallH / 2, INT_WALL_T, HALL_N_Z - SCHOOL_MIN_Z, wallH, M.cream));
  walls.push(B('w-div-s', DIV_X, (HALL_S_Z + SCHOOL_MAX_Z) / 2, wallH / 2, INT_WALL_T, SCHOOL_MAX_Z - HALL_S_Z, wallH, M.cream));

  // ---- Windows (dark glass planes on the exterior faces) ----
  const windows: ReactNode[] = [];
  for (const wx of [-85, -82, -79, -74, -71, -68]) {
    windows.push(WP(`win-n${wx}`, wx, SCHOOL_MIN_Z - EXT_WALL_T / 2 - 0.02, 1.75, 1.2, 1.3, FACE_N, M.glass));
    windows.push(WP(`win-s${wx}`, wx, SCHOOL_MAX_Z + EXT_WALL_T / 2 + 0.02, 1.75, 1.2, 1.3, FACE_S, M.glass));
  }
  for (const wz of [-211.3, -204.7]) {
    windows.push(WP(`win-e${wz}`, SCHOOL_MAX_X + EXT_WALL_T / 2 + 0.02, wz, 1.75, 1.2, 1.3, FACE_E, M.glass));
  }

  // ---- Classrooms A (north) + B (south): whiteboard wall = WEST ----
  const classrooms = ([
    { id: 'a', teacherZ: CLASSA_TEACHER_Z, deskZs: CLASSA_DESK_ZS, boardZ: -212.5, clockZ: -210.55, rug: '#4a7fb5' },
    { id: 'b', teacherZ: CLASSB_TEACHER_Z, deskZs: CLASSB_DESK_ZS, boardZ: -203.5, clockZ: -205.45, rug: '#c76a4a' },
  ] as const).map((c) => (
    <group key={`class-${c.id}`}>
      {/* Whiteboard: frame + board + marker text + tray */}
      {B(`wb-frame-${c.id}`, WHITEBOARD_WALL_X + 0.04, c.boardZ, 1.85, 0.08, 3.24, 1.44, M.trim)}
      {WP(`wb-board-${c.id}`, WHITEBOARD_WALL_X + 0.1, c.boardZ, 1.85, 3, 1.2, FACE_E, M.boardWhite)}
      <Text position={lp(WHITEBOARD_WALL_X + 0.13, c.boardZ, 2.05)} rotation={[0, FACE_E, 0]} fontSize={0.24} color={MARKER_BLUE} anchorX="center" anchorY="middle">
        Good morning, class!
      </Text>
      <Text position={lp(WHITEBOARD_WALL_X + 0.13, c.boardZ, 1.68)} rotation={[0, FACE_E, 0]} fontSize={0.16} color={MARKER_BLUE} anchorX="center" anchorY="middle">
        Today: show and tell
      </Text>
      {B(`wb-tray-${c.id}`, WHITEBOARD_WALL_X + 0.09, c.boardZ, 1.18, 0.1, 2.6, 0.05, M.trim)}
      {/* ABC strip above the whiteboard */}
      {(['A', 'B', 'C'] as const).map((letter, i) => (
        <group key={`abc-${c.id}-${letter}`}>
          {/* Viewer faces −X here, so screen-right is −Z: walk z DOWN so it reads A-B-C. */}
          {WP(`abcsq-${c.id}-${i}`, WHITEBOARD_WALL_X + 0.06, c.boardZ + 0.8 - i * 0.8, 3.0, 0.55, 0.55, FACE_E, M.accents[i])}
          <Text position={lp(WHITEBOARD_WALL_X + 0.08, c.boardZ + 0.8 - i * 0.8, 3.0)} rotation={[0, FACE_E, 0]} fontSize={0.3} color="#fff8ec" anchorX="center" anchorY="middle">
            {letter}
          </Text>
        </group>
      ))}
      {/* Wall clock (flat cylinder + hands) */}
      <group position={lp(WHITEBOARD_WALL_X + 0.06, c.clockZ, 3.1)} rotation={[0, FACE_E, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={M.metal}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 20]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]} material={M.boardWhite}>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 20]} />
        </mesh>
        <mesh geometry={R.box} material={M.roof} position={[0, 0.07, 0.032]} scale={[0.03, 0.15, 0.015]} />
        <mesh geometry={R.box} material={M.roof} position={[0.05, 0, 0.032]} rotation={[0, 0, Math.PI / 2]} scale={[0.03, 0.11, 0.015]} />
      </group>
      {/* Teacher desk + chair (front of the room, by the whiteboard) */}
      {B(`tdesk-${c.id}`, TEACHER_DESK_X, c.teacherZ, 0.36, 0.7, 1.6, 0.72, M.wood)}
      {B(`tdesktop-${c.id}`, TEACHER_DESK_X, c.teacherZ, 0.75, 0.78, 1.68, 0.06, M.deskTop)}
      {B(`tchair-${c.id}`, TEACHER_CHAIR_X, c.teacherZ, 0.21, 0.4, 0.4, 0.42, M.accents[3])}
      {B(`tchairback-${c.id}`, TEACHER_CHAIR_X + 0.185, c.teacherZ, 0.67, 0.05, 0.42, 0.5, M.accents[3])}
      {/* 6 student desks (2 rows of 3, facing the whiteboard) + chairs */}
      {DESK_ROW_XS.map((dx, ri) =>
        c.deskZs.map((dz, ci) => (
          <group key={`desk-${c.id}-${ri}-${ci}`}>
            {B(`d-${c.id}-${ri}-${ci}`, dx, dz, 0.34, DESK_D, DESK_W, 0.68, M.woodLight)}
            {B(`dt-${c.id}-${ri}-${ci}`, dx, dz, 0.71, DESK_D + 0.06, DESK_W + 0.06, 0.05, M.deskTop)}
            {B(`ch-${c.id}-${ri}-${ci}`, dx + CHAIR_DX, dz, 0.21, 0.4, 0.4, 0.42, M.accents[(ri * 3 + ci) % 4])}
            {B(`chb-${c.id}-${ri}-${ci}`, dx + CHAIR_DX + 0.185, dz, 0.67, 0.05, 0.42, 0.5, M.accents[(ri * 3 + ci) % 4])}
          </group>
        )),
      )}
      {/* Reading rug in the open corner */}
      <mesh position={lp(-78.5, c.boardZ, 0.016)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.3, 24]} />
        <meshStandardMaterial color={c.rug} roughness={1} />
      </mesh>
    </group>
  ));

  // ---- Locker row (hall north wall, near the entrance) ----
  const lockers = LOCKER_XS.map((x, i) => (
    <group key={`locker-${i}`}>
      {B(`lk-${i}`, x, LOCKER_Z, LOCKER_H / 2, LOCKER_W - 0.03, LOCKER_D, LOCKER_H, M.accents[i % 4])}
      {B(`lkh-${i}`, x + 0.1, LOCKER_Z + LOCKER_D / 2 + 0.005, 1.05, 0.05, 0.02, 0.12, M.metal)}
    </group>
  ));

  // ---- Cafeteria: serving counter + trays + 3 long tables with benches ----
  const cafeteria = (
    <group>
      {B('counter', COUNTER_X, COUNTER_Z, COUNTER_H / 2, COUNTER_W, COUNTER_D, COUNTER_H, M.cream)}
      {B('countertop', COUNTER_X, COUNTER_Z, COUNTER_H + 0.03, COUNTER_W + 0.12, COUNTER_D + 0.12, 0.06, M.tableBase)}
      {[-74.5, -73.2, -70.8, -69.5].map((tx, i) =>
        B(`tray-${i}`, tx, COUNTER_Z + 0.05, COUNTER_H + 0.1, 0.32, 0.26, 0.07, M.accents[i % 4]))}
      {CAFE_TABLE_XS.map((tx, i) => (
        <group key={`cafetable-${i}`}>
          {B(`ct-${i}`, tx, CAFE_TABLE_Z, 0.72, CAFE_TABLE_W, CAFE_TABLE_L, 0.06, M.tableTop)}
          {B(`ctb-${i}`, tx, CAFE_TABLE_Z, 0.36, CAFE_TABLE_W - 0.25, CAFE_TABLE_L - 0.4, 0.7, M.tableBase)}
          {B(`cbw-${i}`, tx - CAFE_BENCH_DX, CAFE_TABLE_Z, 0.225, CAFE_BENCH_W, CAFE_BENCH_L, 0.45, M.woodLight)}
          {B(`cbe-${i}`, tx + CAFE_BENCH_DX, CAFE_TABLE_Z, 0.225, CAFE_BENCH_W, CAFE_BENCH_L, 0.45, M.woodLight)}
        </group>
      ))}
    </group>
  );

  // ---- Library / art room: bookshelves + easel + art table + rug ----
  const library = (
    <group>
      {SHELF_ZS.map((sz, i) => (
        <group key={`shelf-${i}`}>
          {B(`sh-${i}`, SHELF_X, sz, SHELF_H / 2, SHELF_W, SHELF_L, SHELF_H, M.wood)}
          {[0.55, 1.1, 1.65].map((y, r) =>
            B(`shb-${i}-${r}`, SHELF_X + SHELF_W / 2 + 0.04, sz, y, 0.1, SHELF_L - 0.3, 0.34, M.accents[(i + r) % 4]))}
        </group>
      ))}
      {/* Easel with a kid painting */}
      {B('easel-l1', EASEL_X, EASEL_Z - 0.25, 0.75, 0.07, 0.07, 1.5, M.wood)}
      {B('easel-l2', EASEL_X, EASEL_Z + 0.25, 0.75, 0.07, 0.07, 1.5, M.wood)}
      {B('easel-board', EASEL_X, EASEL_Z, 1.05, 0.06, 0.7, 0.9, M.boardWhite)}
      {WP('easel-art1', EASEL_X - 0.05, EASEL_Z - 0.12, 1.12, 0.22, 0.22, FACE_W, M.accents[1])}
      {WP('easel-art2', EASEL_X - 0.05, EASEL_Z + 0.14, 0.98, 0.26, 0.2, FACE_W, M.accents[2])}
      {/* Art table + rug + floor cushions */}
      {B('arttable', ART_TABLE_X, ART_TABLE_Z, 0.35, 1.1, 1.1, 0.7, M.woodLight)}
      {B('arttabletop', ART_TABLE_X, ART_TABLE_Z, 0.73, 1.2, 1.2, 0.06, M.deskTop)}
      <mesh position={lp(-69.4, -203.0, 0.016)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.2, 24]} />
        <meshStandardMaterial color="#b5a06a" roughness={1} />
      </mesh>
      <mesh position={lp(-71.0, -202.4, 0.09)} material={M.accents[3]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.18, 14]} />
      </mesh>
      <mesh position={lp(-68.2, -202.2, 0.09)} material={M.accents[2]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.18, 14]} />
      </mesh>
    </group>
  );

  // ---- Ceiling light panels (emissive, so interiors read bright + warm) ----
  const lights = [
    [-84, -208], [-77, -208], [-70, -208], // hallway
    [-82, -212.5], [-82, -203.5],          // classrooms
    [-71, -212.5], [-71, -203.5],          // cafeteria + library
  ].map(([wx, wz], i) => B(`light-${i}`, wx, wz, 4.05, 1.8, 0.9, 0.06, M.panel));

  // ---- Schoolyard: walkway, flagpole, bench, sign ----
  const yard = (
    <group>
      {F('walkway', (SCHOOL_MAX_X + WALKWAY_END_X) / 2 + 0.05, WALKWAY_Z, WALKWAY_END_X - SCHOOL_MAX_X - 0.1, 2.0, M.concrete, 0.014)}
      {/* Flagpole */}
      <mesh position={lp(FLAG_X, FLAG_Z, 3)} material={M.metal} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 6, 10]} />
      </mesh>
      <mesh position={lp(FLAG_X, FLAG_Z, 6.08)} material={M.metal}>
        <sphereGeometry args={[0.1, 10, 10]} />
      </mesh>
      {B('flag', FLAG_X + 0.5, FLAG_Z, 5.38, 0.9, 0.04, 0.5, M.red)}
      {B('flagstripe', FLAG_X + 0.5, FLAG_Z, 5.06, 0.9, 0.05, 0.14, M.white)}
      {/* Bench by the front door */}
      {B('ybench-seat', YARD_BENCH_X, YARD_BENCH_Z, 0.45, 0.45, 1.7, 0.08, M.woodLight)}
      {B('ybench-back', YARD_BENCH_X - 0.21, YARD_BENCH_Z, 0.75, 0.08, 1.7, 0.7, M.woodLight)}
      {B('ybench-leg1', YARD_BENCH_X, YARD_BENCH_Z - 0.7, 0.22, 0.4, 0.1, 0.44, M.wood)}
      {B('ybench-leg2', YARD_BENCH_X, YARD_BENCH_Z + 0.7, 0.22, 0.4, 0.1, 0.44, M.wood)}
      {/* SCHOOL ZONE sign at the walkway mouth */}
      <mesh position={lp(ZONE_SIGN_X, ZONE_SIGN_Z, 1.1)} material={M.metal} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
      </mesh>
      {B('zsign-board', ZONE_SIGN_X, ZONE_SIGN_Z, 1.78, 0.06, 0.8, 0.85, M.signYG)}
      <Text position={lp(ZONE_SIGN_X + 0.05, ZONE_SIGN_Z, 1.95)} rotation={[0, FACE_E, 0]} fontSize={0.16} color="#2c2c2c" anchorX="center" anchorY="middle" letterSpacing={0.05}>
        SCHOOL
      </Text>
      <Text position={lp(ZONE_SIGN_X + 0.05, ZONE_SIGN_Z, 1.68)} rotation={[0, FACE_E, 0]} fontSize={0.16} color="#2c2c2c" anchorX="center" anchorY="middle" letterSpacing={0.05}>
        ZONE
      </Text>
    </group>
  );

  return (
    <group position={[SCHOOL_CX, 0, SCHOOL_CZ]} rotation={[0, SCHOOL_YAW, 0]}>
      {/* Floors (per-room tile planes) */}
      {F('fl-hall', SCHOOL_CX, (HALL_N_Z + HALL_S_Z) / 2, SCHOOL_MAX_X - SCHOOL_MIN_X, HALL_S_Z - HALL_N_Z, M.floorBeige)}
      {F('fl-classa', (SCHOOL_MIN_X + DIV_X) / 2, (SCHOOL_MIN_Z + HALL_N_Z) / 2, DIV_X - SCHOOL_MIN_X, HALL_N_Z - SCHOOL_MIN_Z, M.floorGreen)}
      {F('fl-classb', (SCHOOL_MIN_X + DIV_X) / 2, (HALL_S_Z + SCHOOL_MAX_Z) / 2, DIV_X - SCHOOL_MIN_X, SCHOOL_MAX_Z - HALL_S_Z, M.floorGreen)}
      {F('fl-cafe', (DIV_X + SCHOOL_MAX_X) / 2, (SCHOOL_MIN_Z + HALL_N_Z) / 2, SCHOOL_MAX_X - DIV_X, HALL_N_Z - SCHOOL_MIN_Z, M.floorBeige)}
      {F('fl-lib', (DIV_X + SCHOOL_MAX_X) / 2, (HALL_S_Z + SCHOOL_MAX_Z) / 2, SCHOOL_MAX_X - DIV_X, SCHOOL_MAX_Z - HALL_S_Z, M.floorLib)}

      {walls}
      {windows}

      {/* Flat roof slab + parapet */}
      {B('roof', SCHOOL_CX, SCHOOL_DOOR_Z, 4.38, SCHOOL_MAX_X - SCHOOL_MIN_X + 0.6, SCHOOL_MAX_Z - SCHOOL_MIN_Z + 0.6, 0.36, M.roof)}
      {B('parapet-n', SCHOOL_CX, SCHOOL_MIN_Z - 0.15, 4.76, SCHOOL_MAX_X - SCHOOL_MIN_X + 0.6, 0.3, 0.44, M.parapet)}
      {B('parapet-s', SCHOOL_CX, SCHOOL_MAX_Z + 0.15, 4.76, SCHOOL_MAX_X - SCHOOL_MIN_X + 0.6, 0.3, 0.44, M.parapet)}
      {B('parapet-e', SCHOOL_MAX_X + 0.15, SCHOOL_DOOR_Z, 4.76, 0.3, SCHOOL_MAX_Z - SCHOOL_MIN_Z, 0.44, M.parapet)}
      {B('parapet-w', SCHOOL_MIN_X - 0.15, SCHOOL_DOOR_Z, 4.76, 0.3, SCHOOL_MAX_Z - SCHOOL_MIN_Z, 0.44, M.parapet)}

      {/* Marquee over the front door */}
      {B('sign-board', SCHOOL_MAX_X + 0.2, SCHOOL_DOOR_Z, 3.35, 0.12, 9.6, 1.5, M.signGreen)}
      <Text position={lp(SCHOOL_MAX_X + 0.28, SCHOOL_DOOR_Z, 3.62)} rotation={[0, FACE_E, 0]} fontSize={0.55} color="#fff8ec" anchorX="center" anchorY="middle" letterSpacing={0.06}>
        AVERY RANCH ELEMENTARY
      </Text>
      <Text position={lp(SCHOOL_MAX_X + 0.28, SCHOOL_DOOR_Z, 2.98)} rotation={[0, FACE_E, 0]} fontSize={0.26} color="#e8d9a8" anchorX="center" anchorY="middle" letterSpacing={0.2}>
        HOME OF THE ARMADILLOS
      </Text>

      {lights}
      {lockers}
      {classrooms}
      {cafeteria}
      {library}
      {yard}

      {/* The red front door — a REAL openable Door on the local −Z (world east) wall. */}
      <Door
        id={SCHOOL_DOOR_ID}
        x={0}
        z={-SCHOOL_HALF_D}
        width={SCHOOL_DOOR_W}
        height={SCHOOL_DOOR_H}
        color="#a8333d"
        trimColor="#f3eee4"
        houseWorldX={SCHOOL_CX}
        houseWorldZ={SCHOOL_CZ}
        houseYaw={SCHOOL_YAW}
        hinge="left"
      />
    </group>
  );
}
