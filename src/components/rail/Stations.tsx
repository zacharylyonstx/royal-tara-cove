import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import {
  STATIONS, PLATFORM_X0, PLATFORM_X1, PLATFORM_Y, PLATFORM_HALF_LEN, RAMP_LEN, CANOPY_POSTS, rampSpan,
  HOWARD_Z, LAKELINE_Z, LAKELINE_PLAT, CITY_STOPS, SIDE_PLAT_HALF, sidePlatX, departures, rail, TRACK_Z_S, type Station, type StationId,
} from '../../world/redLine';
import { RAIL_MID_X, RAIL_X, RAIL_X_B, WEST_BLVD_Z } from '../../world/westAvery';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { Batch, glowPaint, paint } from './batch';

// The Red Line's stations. Avery Ranch, The Domain, Downtown and Bastrop are
// island platforms you can walk onto (floors + colliders: world/redLine.ts);
// the real stops in between are rolled straight through.

const CONCRETE = '#c9c5ba';
const PAVE = '#d8d3c6';
const STEEL = '#5f7383';
const NAVY = '#16335c';
const RED = '#c8102e';
const TACTILE = '#e8c33a';
const MID = RAIL_MID_X;
const W = PLATFORM_X1 - PLATFORM_X0;

function fmt(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Slab, tactile edges, canopy and benches of an island platform at z. */
function island(b: Batch, z: number, accent: string) {
  const zN = z - PLATFORM_HALF_LEN;
  b.box('solid', CONCRETE, W, PLATFORM_Y, PLATFORM_HALF_LEN * 2, MID, PLATFORM_Y / 2, z);
  b.box('solid', PAVE, W - 1.1, 0.02, PLATFORM_HALF_LEN * 2 - 0.2, MID, PLATFORM_Y + 0.008, z);
  for (const x of [PLATFORM_X0 + 0.27, PLATFORM_X1 - 0.27]) b.box('solid', TACTILE, 0.5, 0.022, PLATFORM_HALF_LEN * 2, x, PLATFORM_Y + 0.01, z);
  // Canopy: columns, a spine beam, and a gull-wing roof.
  for (const dz of CANOPY_POSTS) {
    b.cyl('solid', STEEL, 0.13, 0.15, 3.5, MID, PLATFORM_Y + 1.75, z + dz, 10);
    b.box('solid', STEEL, W - 0.4, 0.12, 0.14, MID, PLATFORM_Y + 3.42, z + dz);
  }
  b.box('solid', accent, 0.26, 0.26, 30, MID, PLATFORM_Y + 3.45, z);
  for (const sx of [-1, 1]) {
    b.box('solid', '#dfe5ea', W / 2 + 0.3, 0.07, 30, MID + sx * (W / 4 + 0.1), PLATFORM_Y + 3.75, z, 0, 0, sx * 0.2);
    // Lights tucked under the roof.
    b.box('glow', '#fff1cf', 0.16, 0.05, 27, MID + sx * 1.1, PLATFORM_Y + 3.38, z);
  }
  // Benches between the columns.
  for (const dz of [-8, 0, 8]) {
    b.box('solid', '#8a6a48', 0.5, 0.07, 1.9, MID, PLATFORM_Y + 0.46, z + dz);
    b.box('solid', '#8a6a48', 0.07, 0.45, 1.9, MID, PLATFORM_Y + 0.72, z + dz);
    for (const e of [-0.8, 0.8]) b.box('solid', STEEL, 0.44, 0.44, 0.07, MID, PLATFORM_Y + 0.22, z + dz + e);
  }
  // Name boards hanging under the canopy (the lettering is drawn as Text).
  for (const dz of [-8, 8]) b.box('solid', NAVY, 0.1, 0.52, 3.4, MID, PLATFORM_Y + 2.85, z + dz);
  return zN;
}

/** A side platform with a shelter, beside one track (+1 = east). */
function sidePlatform(b: Batch, z: number, side: 1 | -1, accent: string, pyramid: boolean) {
  const { x0, x1 } = sidePlatX(side);
  const cx = (x0 + x1) / 2, w = x1 - x0, back = side > 0 ? x1 - 0.5 : x0 + 0.5, edge = side > 0 ? x0 + 0.27 : x1 - 0.27;
  b.box('solid', CONCRETE, w, PLATFORM_Y, SIDE_PLAT_HALF * 2, cx, PLATFORM_Y / 2, z);
  b.box('solid', TACTILE, 0.5, 0.022, SIDE_PLAT_HALF * 2, edge, PLATFORM_Y + 0.01, z);
  for (const dz of [-9, -3, 3, 9]) b.cyl('solid', accent, 0.11, 0.13, 3.1, back, PLATFORM_Y + 1.55, z + dz, 10);
  if (pyramid) {
    // Highland's shelters: a little pyramid roof on each pair of posts.
    for (const dz of [-6, 6]) b.cyl('solid', '#dfe5ea', 0.2, 4.4, 1.5, cx, PLATFORM_Y + 3.85, z + dz, 4, 0, 0, Math.PI / 4);
  } else {
    b.box('solid', '#dfe5ea', w + 0.7, 0.08, 20, cx, PLATFORM_Y + 3.2, z, 0, 0, -side * 0.12);
  }
  b.box('solid', accent, 0.2, 0.2, 20, back, PLATFORM_Y + 3.08, z);
  b.box('glow', '#fff1cf', 0.14, 0.05, 17, cx, PLATFORM_Y + 3.02, z);
  b.box('solid', NAVY, 0.1, 0.52, 3.6, cx, PLATFORM_Y + 2.5, z);
  for (const dz of [-6, 6]) {
    b.box('solid', '#8a6a48', 0.5, 0.07, 1.9, back - side * 0.5, PLATFORM_Y + 0.46, z + dz);
    b.box('solid', '#8a6a48', 0.07, 0.45, 1.9, back - side * 0.26, PLATFORM_Y + 0.72, z + dz);
  }
}

function buildStations() {
  const b = new Batch();
  for (const s of Object.values(STATIONS)) {
    island(b, s.z, RED);
    // Access ramp with handrails; a railing closes the far end.
    const r = rampSpan(s);
    const ang = Math.atan2(PLATFORM_Y, RAMP_LEN) * s.rampDir;
    const rl = Math.hypot(RAMP_LEN, PLATFORM_Y);
    b.box('solid', CONCRETE, W - 1, 0.14, rl, MID, PLATFORM_Y / 2 - 0.07, (r.z0 + r.z1) / 2, 0, ang);
    for (const x of [PLATFORM_X0 + 0.5, PLATFORM_X1 - 0.5]) {
      b.box('solid', STEEL, 0.06, 0.06, rl, x, PLATFORM_Y / 2 + 1.0, (r.z0 + r.z1) / 2, 0, ang);
      for (const t of [0.02, 0.5, 0.98]) {
        const z = r.z0 + (r.z1 - r.z0) * t;
        const y = PLATFORM_Y * (s.rampDir > 0 ? 1 - t : t);
        b.box('solid', STEEL, 0.06, 1.0, 0.06, x, y + 0.5, z);
      }
      // Side cheeks so the ramp reads as solid from the tracks.
      b.box('solid', CONCRETE, 0.12, PLATFORM_Y, rl, x, 0, (r.z0 + r.z1) / 2, 0, ang);
    }
    const mouthZ = s.z + s.rampDir * PLATFORM_HALF_LEN;
    for (const x of [PLATFORM_X0 + 0.25, PLATFORM_X1 - 0.25]) b.box('solid', STEEL, 0.5, 1.05, 0.07, x, PLATFORM_Y + 0.52, mouthZ);
    const endZ = s.z - s.rampDir * PLATFORM_HALF_LEN;
    b.box('solid', STEEL, W, 0.07, 0.07, MID, PLATFORM_Y + 1.05, endZ);
    b.box('solid', STEEL, W, 0.07, 0.07, MID, PLATFORM_Y + 0.55, endZ);
    for (const x of [PLATFORM_X0 + 0.05, MID, PLATFORM_X1 - 0.05]) b.box('solid', STEEL, 0.07, 1.05, 0.07, x, PLATFORM_Y + 0.52, endZ);
    // Ticket machine + the departure board's housing.
    b.box('solid', '#dfe3e8', 0.7, 1.7, 0.5, MID, PLATFORM_Y + 0.85, s.z + s.rampDir * 15.2);
    b.box('glow', '#3aa0ff', 0.44, 0.34, 0.03, MID, PLATFORM_Y + 1.25, s.z + s.rampDir * 15.2 - s.rampDir * 0.27);
    b.box('solid', '#0c0e11', 0.14, 0.66, 3.3, MID, PLATFORM_Y + 2.8, s.z);
    // Landing at the foot of the ramp, between the tracks.
    const foot = s.rampDir > 0 ? r.z1 : r.z0;
    b.box('solid', PAVE, W - 1, 0.03, 5.6, MID, 0.05, foot + s.rampDir * 2.8);
  }
  // --- Avery Ranch: walkway down the median to the boulevard, and a little
  //     park-and-ride plaza east of the tracks (crossing boards over the rail).
  const aFoot = rampSpan(STATIONS.avery).z1;
  const blvdWalk = WEST_BLVD_Z - 6.7;
  b.box('solid', PAVE, W - 1, 0.03, blvdWalk - aFoot, MID, 0.05, (aFoot + blvdWalk) / 2);
  b.box('solid', '#6b5a48', 4.6, 0.05, 3.4, RAIL_X_B, 0.2, aFoot + 2.4);                 // crossing boards
  b.box('solid', PAVE, 6, 0.03, 3.4, RAIL_X_B + 5.2, 0.04, aFoot + 2.4);
  b.box('solid', PAVE, 15, 0.03, 16, RAIL_X_B + 15.5, 0.04, aFoot - 4);                  // plaza
  b.box('solid', PAVE, 2.4, 0.03, blvdWalk - aFoot - 4, RAIL_X_B + 15.5, 0.04, (aFoot + 4 + blvdWalk) / 2);
  for (const k of [0, 1, 2, 3]) {                                                        // bike rack hoops
    b.box('solid', STEEL, 0.06, 0.8, 0.06, RAIL_X_B + 20, 0.4, aFoot - 8 + k * 0.9);
  }
  b.box('solid', STEEL, 0.06, 0.06, 2.9, RAIL_X_B + 20, 0.8, aFoot - 6.65);
  b.box('solid', '#8a6a48', 1.9, 0.07, 0.5, RAIL_X_B + 14, 0.46, aFoot - 10.5);
  b.box('solid', STEEL, 0.07, 0.44, 0.44, RAIL_X_B + 13.2, 0.22, aFoot - 10.5);
  b.box('solid', STEEL, 0.07, 0.44, 0.44, RAIL_X_B + 14.8, 0.22, aFoot - 10.5);
  // Station totem by the boulevard.
  b.box('solid', NAVY, 2.6, 2.9, 0.3, RAIL_X_B + 12.2, 1.45, blvdWalk - 2.4);
  b.box('solid', RED, 2.6, 0.3, 0.32, RAIL_X_B + 12.2, 2.95, blvdWalk - 2.4);
  // --- The Domain: crossing boards west over the rail to the station plaza.
  const dFoot = rampSpan(STATIONS.domain).z1;
  b.box('solid', '#6b5a48', 4.6, 0.05, 3.6, RAIL_X, 0.2, dFoot + 2.6);

  // --- Downtown: crossing boards west over the rail to the plaza.
  const tFoot = rampSpan(STATIONS.downtown).z1;
  b.box('solid', '#6b5a48', 4.6, 0.05, 3.6, RAIL_X, 0.2, tFoot + 2.6);
  // --- Bastrop: the end of the line. Buffer stops, and the walk straight on
  //     south off the end of the island to Sam Houston Drive.
  for (const x of [RAIL_X, RAIL_X_B]) {
    b.box('solid', '#3a3d42', 2.3, 0.9, 0.5, x, 0.65, TRACK_Z_S + 0.5);
    b.box('solid', RED, 2.5, 0.5, 0.2, x, 1.1, TRACK_Z_S + 0.2);
    for (const dx of [-0.9, 0.9]) b.box('solid', '#3a3d42', 0.2, 0.9, 1.6, x + dx, 0.45, TRACK_Z_S + 1.2, 0, 0.5);
  }
  // --- The real stops between the Domain and Downtown (not served).
  for (const c of CITY_STOPS) {
    if (c.kind === 'island') { island(b, c.z, c.accent); continue; }
    for (const side of [1, -1] as const) {
      if (c.kind === 'both' || c.kind === (side > 0 ? 'east' : 'west')) sidePlatform(b, c.z, side, c.accent, c.name === 'HIGHLAND');
    }
  }

  // --- Howard: the same island platform, in its own colours (not served).
  island(b, HOWARD_Z, '#2f7d5b');
  // --- Lakeline: a side platform with a long shelter (not served).
  const lx = (LAKELINE_PLAT.x0 + LAKELINE_PLAT.x1) / 2, lw = LAKELINE_PLAT.x1 - LAKELINE_PLAT.x0;
  b.box('solid', CONCRETE, lw, PLATFORM_Y, LAKELINE_PLAT.half * 2, lx, PLATFORM_Y / 2, LAKELINE_Z);
  b.box('solid', TACTILE, 0.5, 0.022, LAKELINE_PLAT.half * 2, LAKELINE_PLAT.x0 + 0.27, PLATFORM_Y + 0.01, LAKELINE_Z);
  for (const dz of [-10, -3.3, 3.3, 10]) b.cyl('solid', STEEL, 0.12, 0.14, 3.2, LAKELINE_PLAT.x1 - 0.5, PLATFORM_Y + 1.6, LAKELINE_Z + dz, 10);
  b.box('solid', '#dfe5ea', lw + 0.6, 0.08, 24, lx, PLATFORM_Y + 3.3, LAKELINE_Z, 0, 0, 0.12);
  b.box('solid', '#e08a2a', 0.22, 0.22, 24, LAKELINE_PLAT.x1 - 0.5, PLATFORM_Y + 3.15, LAKELINE_Z);
  b.box('solid', NAVY, 0.1, 0.52, 3.4, lx, PLATFORM_Y + 2.6, LAKELINE_Z);
  return b.build();
}

const BOARD_NAME: Record<StationId, string> = { avery: 'AVERY RANCH', domain: 'THE DOMAIN', downtown: 'DOWNTOWN', bastrop: 'BASTROP' };

/** "BASTROP 0:42 / AVERY RANCH 1:10", hung over the middle of the island. */
function DepartureBoard({ s }: { s: Station }) {
  const [lines, setLines] = useState<[string, string]>(['', '']);
  const last = useRef('');
  useEffect(() => {
    const tick = () => {
      if (!rail.live) return;
      const deps = departures(s.id, rail.T);
      let l1: string, l2: string;
      if (deps.length === 1) {
        const d = deps[0];
        l1 = `TO ${BOARD_NAME[d.dest]}`;
        l2 = d.boarding ? `BOARDING · DOORS CLOSE ${fmt(d.doorsFor)}` : `NEXT TRAIN ${fmt(d.inS)}`;
      } else {
        // Southbound leaves from the west face, northbound from the east face.
        [l1, l2] = deps.map((d) => `${d.dir > 0 ? '◀ ' : ''}${BOARD_NAME[d.dest]}  ${d.boarding ? 'BOARDING' : fmt(d.inS)}${d.dir < 0 ? ' ▶' : ''}`);
      }
      const key = l1 + l2;
      if (key !== last.current) { last.current = key; setLines([l1, l2]); }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [s.id]);
  return (
    <group position={[MID, PLATFORM_Y + 2.8, s.z]}>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.08, 0, 0]} rotation={[0, sx * Math.PI / 2, 0]}>
          <Text position={[0, 0.15, 0]} fontSize={0.2} color="#ffb21e" anchorX="center" anchorY="middle" letterSpacing={0.05}>{lines[0]}</Text>
          <Text position={[0, -0.14, 0]} fontSize={0.17} color="#ffd98a" anchorX="center" anchorY="middle" letterSpacing={0.04}>{lines[1]}</Text>
        </group>
      ))}
    </group>
  );
}

function NameBoards({ z, name, x = MID, y = PLATFORM_Y + 2.85, offsets = [-8, 8] }: { z: number; name: string; x?: number; y?: number; offsets?: number[] }) {
  return (
    <>
      {offsets.map((dz) => [-1, 1].map((sx) => (
        <Text key={`${dz}${sx}`} position={[x + sx * 0.06, y, z + dz]} rotation={[0, sx * Math.PI / 2, 0]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          {name}
        </Text>
      )))}
    </>
  );
}

export function Stations() {
  const geo = useMemo(() => buildStations(), []);
  const mats = useMemo(() => ({ solid: paint(0.85), glow: glowPaint(0.5) }), []);
  useFrame(() => {
    const sky = useSkyStore.getState();
    const on = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.glow.emissiveIntensity = 0.35 + 2.2 * on;
  });
  const blvdWalk = WEST_BLVD_Z - 6.7;
  return (
    <group>
      <mesh geometry={geo.solid} material={mats.solid} castShadow receiveShadow />
      <mesh geometry={geo.glow} material={mats.glow} />
      {Object.values(STATIONS).map((s) => (
        <group key={s.id}>
          <NameBoards z={s.z} name={s.name.toUpperCase()} />
          <DepartureBoard s={s} />
        </group>
      ))}
      <NameBoards z={HOWARD_Z} name="HOWARD" />
      {CITY_STOPS.map((c) => (c.kind === 'island'
        ? <NameBoards key={c.name} z={c.z} name={c.name} />
        : ([1, -1] as const).filter((side) => c.kind === 'both' || c.kind === (side > 0 ? 'east' : 'west')).map((side) => {
          const sx = sidePlatX(side);
          return <NameBoards key={c.name + side} z={c.z} name={c.name} x={(sx.x0 + sx.x1) / 2} y={PLATFORM_Y + 2.5} offsets={[0]} />;
        })))}
      <NameBoards z={LAKELINE_Z} name="LAKELINE" x={(LAKELINE_PLAT.x0 + LAKELINE_PLAT.x1) / 2} y={PLATFORM_Y + 2.6} offsets={[0]} />
      {/* The totem you see from Avery Ranch Blvd. */}
      <group position={[RAIL_X_B + 12.2, 0, blvdWalk - 2.4]}>
        {[1, -1].map((f) => (
          <group key={f} position={[0, 0, f * 0.17]} rotation={[0, f > 0 ? 0 : Math.PI, 0]}>
            <Text position={[0, 2.35, 0]} fontSize={0.36} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.05}>MetroRail</Text>
            <Text position={[0, 1.8, 0]} fontSize={0.27} color="#ffd98a" anchorX="center" anchorY="middle" letterSpacing={0.06}>AVERY RANCH</Text>
            <Text position={[0, 1.42, 0]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.06}>STATION</Text>
            <Text position={[0, 0.85, 0]} fontSize={0.17} color="#cfe0ff" anchorX="center" anchorY="middle" maxWidth={2.3} textAlign="center">Trains to The Domain, Downtown Austin and Bastrop</Text>
          </group>
        ))}
      </group>
    </group>
  );
}
