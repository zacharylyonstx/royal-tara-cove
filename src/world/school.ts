// "Avery Ranch Elementary" — a pretend-play school west of the duck pond.
// A stage for teacher/student role-play: two classrooms, a cafeteria, a
// library/art room, a locker-lined hallway. No quizzes, no UI — just a place.
//
// Layout source of truth. ALL constants are WORLD coordinates (+X east,
// −Z north, ground y=0) except the SCHOOL_* group transform.
//
// The building renders inside <group position={[SCHOOL_CX,0,SCHOOL_CZ]}
// rotation={[0,SCHOOL_YAW,0]}> with SCHOOL_YAW = −π/2, so the group's LOCAL
// −Z wall (where the Door component must live, at local z = −SCHOOL_HALF_D)
// is the WORLD +X (east) front wall, facing the pond and playground.
// Mapping (verified numerically in scripts + the door registration math in
// Door.tsx): local (x, z) → world (SCHOOL_CX − z, SCHOOL_CZ + x), i.e.
//   world x = SCHOOL_CX − local_z   (local −Z = east/front)
//   world z = SCHOOL_CZ + local_x   (local +X = south)
// Inverse (used by School.tsx to render a world-coordinate plan inside the
// yawed group): local_x = wz − SCHOOL_CZ, local_z = SCHOOL_CX − wx.
import { rectAt } from './colliders';
import type { RectCollider } from '../types';

// --- Building transform + footprint (world) ---
export const SCHOOL_CX = -77;
export const SCHOOL_CZ = -208;
export const SCHOOL_YAW = -Math.PI / 2;
/** Local X half-size (= world Z half-extent, 14 m across). */
export const SCHOOL_HALF_W = 7;
/** Local Z half-size (= world X half-extent, 22 m long). */
export const SCHOOL_HALF_D = 11;
export const SCHOOL_MIN_X = -88; // back (west) wall
export const SCHOOL_MAX_X = -66; // front (east) wall — faces the pond
export const SCHOOL_MIN_Z = -215; // north wall
export const SCHOOL_MAX_Z = -201; // south wall
export const SCHOOL_WALL_H = 4.2;
export const EXT_WALL_T = 0.3;
export const INT_WALL_T = 0.2;

// --- Front door (a REAL openable Door component) ---
export const SCHOOL_DOOR_ID = 'school-front';
export const SCHOOL_DOOR_Z = -208; // world z of the door center on the x=−66 wall
export const SCHOOL_DOOR_W = 1.6;
export const SCHOOL_DOOR_H = 2.4;
// Door.tsx registers an AXIS-ALIGNED closed-collider (1.6 along world X ×
// 0.12 along world Z) regardless of houseYaw — on this Z-running wall that
// only seals a 0.12 m band of the 1.6 m gap. Two vestibule jamb pilasters
// just INSIDE the opening (strictly west of the wall slab, rendered as cream
// entry columns) narrow the physical passage to 1.16 m so a CLOSED door
// leaves no player-sized (0.64 m) side band, while an OPEN door still gives
// a comfortable walkway.
export const JAMB_X = -66.38;    // center (extent −66.6..−66.16; wall slab is −66.15..−65.85)
export const JAMB_D = 0.44;      // depth along world X
export const JAMB_W = 0.22;      // thickness along world Z
export const JAMB_N_Z = -208.69; // extent −208.8..−208.58
export const JAMB_S_Z = -207.31; // extent −207.42..−207.2
export const JAMB_H = 2.4;

// --- Interior plan (world) ---
/** Central hallway: front door west to the back wall. */
export const HALL_N_Z = -210;
export const HALL_S_Z = -206;
/** North/south room divider between classroom and cafeteria/library. */
export const DIV_X = -76;
/** Room doorway gaps onto the hall (no door panels; 1.6 m wide). */
export const ROOM_GAP_W = 1.6;
export const CLASSA_DOOR_X = -86;   // on the z=−210 wall
export const CLASSB_DOOR_X = -86;   // on the z=−206 wall
export const CAFE_DOOR_X = -69.4;   // on the z=−210 wall
export const LIB_DOOR_X = -69.4;    // on the z=−206 wall

// --- Hallway lockers (against the hall's north wall, near the entrance) ---
export const LOCKER_Z = -209.675;   // depth 0.45, back against the z=−210 wall face
export const LOCKER_W = 0.35;
export const LOCKER_D = 0.45;
export const LOCKER_H = 2.0;
export const LOCKER_XS: number[] = Array.from({ length: 12 }, (_, i) => -80 + i * 0.62);
export const LOCKER_COLORS = ['#3a6db0', '#b03a2e', '#2e7a6e', '#e8821e'];

// --- Classrooms (A north: z −215..−210, B south: z −206..−201; both x −88..−76).
// Whiteboard + teacher live on the WEST wall; desks face west in 2 rows of 3.
export const WHITEBOARD_WALL_X = -87.85; // west wall inner face
export const TEACHER_DESK_X = -87.1;     // 0.7 deep (x) × 1.6 wide (z)
export const TEACHER_CHAIR_X = -86.45;
export const CLASSA_TEACHER_Z = -214;
export const CLASSB_TEACHER_Z = -202;
export const DESK_ROW_XS = [-84.6, -82.2]; // front row (near whiteboard), back row
export const DESK_W = 0.9;  // along z (desks face west)
export const DESK_D = 0.6;  // along x
export const CHAIR_DX = 0.55; // chair sits east of its desk
export const CHAIR_S = 0.45;
export const CLASSA_DESK_ZS = [-213.8, -212.4, -211.0];
export const CLASSB_DESK_ZS = [-205.0, -203.6, -202.2];

// --- Cafeteria (north-east room: x −76..−66, z −215..−210) ---
export const COUNTER_X = -72;      // serving counter along the north wall
export const COUNTER_Z = -214.575; // extent −214.85..−214.3
export const COUNTER_W = 6;
export const COUNTER_D = 0.55;
export const COUNTER_H = 0.95;
export const CAFE_TABLE_XS = [-74.2, -71, -67.8];
export const CAFE_TABLE_Z = -212;
export const CAFE_TABLE_W = 0.9; // along x
export const CAFE_TABLE_L = 3.0; // along z
export const CAFE_BENCH_DX = 0.6;
export const CAFE_BENCH_W = 0.35;
export const CAFE_BENCH_L = 2.6;

// --- Library / art room (south-east room: x −76..−66, z −206..−201) ---
export const SHELF_X = -75.7;             // two bookshelves against the divider wall
export const SHELF_ZS = [-204.4, -202.3];
export const SHELF_W = 0.4;  // along x
export const SHELF_L = 2.2;  // along z
export const SHELF_H = 2.1;
export const EASEL_X = -67.6;
export const EASEL_Z = -203.4;
export const ART_TABLE_X = -72.8;
export const ART_TABLE_Z = -203.6;

// --- Schoolyard (east of the front wall, toward the pond/playground) ---
export const WALKWAY_Z = -208;    // concrete walk, door east to x≈−62
export const WALKWAY_END_X = -61.9;
export const FLAG_X = -63;
export const FLAG_Z = -204;
export const YARD_BENCH_X = -65.35;
export const YARD_BENCH_Z = -210.3;
export const ZONE_SIGN_X = -62.6;
export const ZONE_SIGN_Z = -211.5;

/**
 * Static colliders for the school (WORLD coords; appended from
 * buildAcrossBlvdColliders). Walls are thin rects with gaps at the front
 * door and each room doorway; furniture gets small low colliders so kids
 * never get stuck (main aisles stay ≥1.4 m; the front door gap is 1.6 m).
 */
export function buildSchoolColliders(): RectCollider[] {
  const out: RectCollider[] = [];
  const H = SCHOOL_WALL_H;
  const doorHalf = SCHOOL_DOOR_W / 2;
  const gapHalf = ROOM_GAP_W / 2;

  // ---- Exterior walls (0.3 thick, corner-overlapped so there are no
  // thread-able corner gaps — the pond lesson) ----
  const wall = (cx: number, cz: number, sx: number, sz: number, tag: string) =>
    out.push(rectAt(cx, cz, sx, sz, { maxY: H, tag }));
  // Front (east) wall at x=−66, split around the 1.6 m door gap at z=−208.
  const frontNLen = SCHOOL_DOOR_Z - doorHalf - SCHOOL_MIN_Z; // −208.8 − (−215) = 6.2
  const frontSLen = SCHOOL_MAX_Z - (SCHOOL_DOOR_Z + doorHalf); // −201 − (−207.2) = 6.2
  wall(SCHOOL_MAX_X, SCHOOL_MIN_Z + frontNLen / 2, EXT_WALL_T, frontNLen, 'school-wall-front-n');
  wall(SCHOOL_MAX_X, SCHOOL_MAX_Z - frontSLen / 2, EXT_WALL_T, frontSLen, 'school-wall-front-s');
  // Back (west) wall, solid.
  wall(SCHOOL_MIN_X, SCHOOL_DOOR_Z, EXT_WALL_T, SCHOOL_MAX_Z - SCHOOL_MIN_Z + EXT_WALL_T, 'school-wall-back');
  // North + south walls, solid.
  wall(SCHOOL_CX, SCHOOL_MIN_Z, SCHOOL_MAX_X - SCHOOL_MIN_X + EXT_WALL_T, EXT_WALL_T, 'school-wall-north');
  wall(SCHOOL_CX, SCHOOL_MAX_Z, SCHOOL_MAX_X - SCHOOL_MIN_X + EXT_WALL_T, EXT_WALL_T, 'school-wall-south');

  // ---- Vestibule jamb pilasters (seal the closed front door; see above) ----
  out.push(rectAt(JAMB_X, JAMB_N_Z, JAMB_D, JAMB_W, { maxY: JAMB_H, tag: 'school-jamb' }));
  out.push(rectAt(JAMB_X, JAMB_S_Z, JAMB_D, JAMB_W, { maxY: JAMB_H, tag: 'school-jamb' }));

  // ---- Interior walls (0.2 thick) ----
  // Hall north + south walls: three segments each, gapped at the classroom
  // doorway (x −86) and the cafeteria/library doorway (x −69.4).
  for (const [wz, classDoorX, eastDoorX, side] of [
    [HALL_N_Z, CLASSA_DOOR_X, CAFE_DOOR_X, 'n'],
    [HALL_S_Z, CLASSB_DOOR_X, LIB_DOOR_X, 's'],
  ] as [number, number, number, string][]) {
    const aL = SCHOOL_MIN_X;              // −88
    const aR = classDoorX - gapHalf;      // −86.8
    const bL = classDoorX + gapHalf;      // −85.2
    const bR = eastDoorX - gapHalf;       // −70.2
    const cL = eastDoorX + gapHalf;       // −68.6
    const cR = SCHOOL_MAX_X;              // −66
    wall((aL + aR) / 2, wz, aR - aL, INT_WALL_T, `school-wall-hall-${side}1`);
    wall((bL + bR) / 2, wz, bR - bL, INT_WALL_T, `school-wall-hall-${side}2`);
    wall((cL + cR) / 2, wz, cR - cL, INT_WALL_T, `school-wall-hall-${side}3`);
  }
  // Room dividers at x=−76 (classroom | cafeteria and classroom | library).
  wall(DIV_X, (SCHOOL_MIN_Z + HALL_N_Z) / 2, INT_WALL_T, HALL_N_Z - SCHOOL_MIN_Z, 'school-wall-div-n');
  wall(DIV_X, (HALL_S_Z + SCHOOL_MAX_Z) / 2, INT_WALL_T, SCHOOL_MAX_Z - HALL_S_Z, 'school-wall-div-s');

  // ---- Hallway lockers (one row rect; 0.45 deep, hall stays 3.55 m clear) ----
  const lockMin = LOCKER_XS[0] - LOCKER_W / 2;
  const lockMax = LOCKER_XS[LOCKER_XS.length - 1] + LOCKER_W / 2;
  out.push(rectAt((lockMin + lockMax) / 2, LOCKER_Z, lockMax - lockMin, LOCKER_D, { maxY: LOCKER_H, tag: 'school-lockers' }));

  // ---- Classrooms A + B (teacher desk + chair, 2×3 student desks + chairs) ----
  for (const [teacherZ, deskZs] of [
    [CLASSA_TEACHER_Z, CLASSA_DESK_ZS],
    [CLASSB_TEACHER_Z, CLASSB_DESK_ZS],
  ] as [number, number[]][]) {
    out.push(rectAt(TEACHER_DESK_X, teacherZ, 0.7, 1.6, { maxY: 1.0, tag: 'school-desk' }));
    out.push(rectAt(TEACHER_CHAIR_X, teacherZ, CHAIR_S, CHAIR_S, { maxY: 0.8, tag: 'school-chair' }));
    for (const dx of DESK_ROW_XS) {
      for (const dz of deskZs) {
        out.push(rectAt(dx, dz, DESK_D, DESK_W, { maxY: 1.0, tag: 'school-desk' }));
        out.push(rectAt(dx + CHAIR_DX, dz, CHAIR_S, CHAIR_S, { maxY: 0.8, tag: 'school-chair' }));
      }
    }
  }

  // ---- Cafeteria (serving counter + 3 long tables with benches both sides) ----
  out.push(rectAt(COUNTER_X, COUNTER_Z, COUNTER_W, COUNTER_D, { maxY: COUNTER_H, tag: 'school-counter' }));
  for (const tx of CAFE_TABLE_XS) {
    out.push(rectAt(tx, CAFE_TABLE_Z, CAFE_TABLE_W, CAFE_TABLE_L, { maxY: 0.9, tag: 'school-table' }));
    out.push(rectAt(tx - CAFE_BENCH_DX, CAFE_TABLE_Z, CAFE_BENCH_W, CAFE_BENCH_L, { maxY: 0.5, tag: 'school-bench' }));
    out.push(rectAt(tx + CAFE_BENCH_DX, CAFE_TABLE_Z, CAFE_BENCH_W, CAFE_BENCH_L, { maxY: 0.5, tag: 'school-bench' }));
  }

  // ---- Library / art room ----
  for (const sz of SHELF_ZS) out.push(rectAt(SHELF_X, sz, SHELF_W, SHELF_L, { maxY: SHELF_H, tag: 'school-shelf' }));
  out.push(rectAt(EASEL_X, EASEL_Z, 0.7, 0.7, { maxY: 1.5, tag: 'school-easel' }));
  out.push(rectAt(ART_TABLE_X, ART_TABLE_Z, 1.2, 1.2, { maxY: 0.9, tag: 'school-arttable' }));

  // ---- Schoolyard props ----
  out.push(rectAt(FLAG_X, FLAG_Z, 0.25, 0.25, { maxY: 6, tag: 'school-flagpole' }));
  out.push(rectAt(YARD_BENCH_X, YARD_BENCH_Z, 0.5, 1.7, { maxY: 1.0, tag: 'school-yardbench' }));
  out.push(rectAt(ZONE_SIGN_X, ZONE_SIGN_Z, 0.25, 0.25, { maxY: 2.4, tag: 'school-zonesign' }));

  return out;
}
