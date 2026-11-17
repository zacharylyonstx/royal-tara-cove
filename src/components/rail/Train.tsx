import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  rail, TRAIN_LEN, TRAIN_HALF_W, TRAIN_FLOOR_Y, TRAIN_ROOF_Y, CAB_Z, MODULE_HALF, MODULE_AISLE_HALF,
  DOOR_Z, DOOR_HALF, WALL_T, INNER_HALF_W, SEATS_LOCAL, sightAt, type StationId,
} from '../../world/redLine';
import { useSkyStore } from '../../state/skyStore';
import { moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { Batch, glass, glowPaint, paint } from './batch';

// The Red Line trainset: a Stadler GTW 2/6 — two low-floor passenger cars with
// a short diesel power module between them that you walk THROUGH. It never
// turns round (a cab at each end), so the model is simply slid along Z.
// Collision lives in world/redLine.ts (same dimensions, imported from there).

const WHITE = '#f1f2f4';
const RED = '#c8102e';
const BLUE = '#1f5fae';
const DARK = '#1c232c';
const GREY = '#9aa1a8';
const SEAT = '#2b5ca8';
const SEAT_DARK = '#1f3f78';
const YELLOW = '#f2c230';
const FLOOR = '#454e5b';
const H = TRAIN_HALF_W;
const L = TRAIN_LEN / 2;
const FY = TRAIN_FLOOR_Y;
const SILL = FY + 0.8;       // bottom of the windows
const HEAD = FY + 1.95;      // top of the windows
const SKIRT = 0.3;
const DOOR_TOP = TRAIN_ROOF_Y - 0.36; // header above it carries the line diagram

/** One door leaf: red panel with a window. Local origin = leaf centre, floor level. */
function leafParts(b: Batch, x: number, zc: number) {
  const w = DOOR_HALF;
  b.box('body', RED, 0.07, SILL - FY, w, x, FY + (SILL - FY) / 2, zc);
  b.box('body', RED, 0.07, DOOR_TOP - HEAD, w, x, (HEAD + DOOR_TOP) / 2, zc);
  b.box('body', RED, 0.07, HEAD - SILL, 0.09, x, (SILL + HEAD) / 2, zc - w / 2 + 0.045);
  b.box('body', RED, 0.07, HEAD - SILL, 0.09, x, (SILL + HEAD) / 2, zc + w / 2 - 0.045);
  b.box('glass', WHITE, 0.03, HEAD - SILL, w - 0.18, x, (SILL + HEAD) / 2, zc);
}

function buildTrain(platformSide: 1 | -1) {
  const b = new Batch();
  const wallX = (sx: number) => sx * (H - WALL_T / 2);

  // ---- floor, roof, underframe ----
  b.box('inside', FLOOR, H * 2 - 0.02, 0.14, TRAIN_LEN - 0.04, 0, FY - 0.07, 0);
  b.box('body', WHITE, H * 2, 0.14, TRAIN_LEN, 0, TRAIN_ROOF_Y - 0.03, 0);
  b.box('body', GREY, H * 1.5, 0.2, TRAIN_LEN - 3, 0, TRAIN_ROOF_Y + 0.12, 0);
  for (const s of [-1, 1]) {
    b.box('body', GREY, 1.7, 0.34, 3.4, 0, TRAIN_ROOF_Y + 0.36, s * 7.6);          // air-con pods
    b.box('body', DARK, H * 2 - 0.2, 0.42, CAB_Z - MODULE_HALF + 1.6, 0, SKIRT + 0.2, s * (MODULE_HALF + (CAB_Z - MODULE_HALF + 1.6) / 2)); // skirts
    b.box('body', '#2a2d31', 2.3, 0.5, 2.6, 0, 0.44, s * 11.2);                     // end bogies
    for (const wz of [-0.85, 0.85]) for (const wx of [-0.72, 0.72]) {
      b.cyl('body', '#3a3d42', 0.42, 0.42, 0.12, wx, 0.5, s * 11.2 + wz, 12, 0, Math.PI / 2);
    }
    for (const wx of [-0.72, 0.72]) b.cyl('body', '#3a3d42', 0.46, 0.46, 0.12, wx, 0.54, s * 1.1, 12, 0, Math.PI / 2);
    // Yellow threshold strips at the doors.
    for (const sx of [-1, 1]) b.box('inside', YELLOW, 0.22, 0.012, DOOR_HALF * 2, sx * (H - 0.14), FY + 0.007, s * DOOR_Z);
    // Ceiling light strip.
    b.box('glow', '#fff4dc', 0.34, 0.03, CAB_Z - MODULE_HALF - 0.8, 0, TRAIN_ROOF_Y - 0.12, s * (MODULE_HALF + CAB_Z) / 2);
    // Grab poles framing each doorway.
    for (const dz of [-DOOR_HALF - 0.12, DOOR_HALF + 0.12]) for (const px of [-0.7, 0.7]) {
      b.cyl('inside', YELLOW, 0.03, 0.03, TRAIN_ROOF_Y - FY - 0.1, px, (FY + TRAIN_ROOF_Y - 0.1) / 2, s * DOOR_Z + dz, 8);
    }
  }
  // Power module: its own axle box, louvred sides, exhaust stacks.
  b.box('body', '#2a2d31', 2.3, 0.5, 3.2, 0, 0.44, 0);
  for (const sx of [-1, 1]) {
    b.box('body', GREY, WALL_T, TRAIN_ROOF_Y - SKIRT, MODULE_HALF * 2, wallX(sx), (TRAIN_ROOF_Y + SKIRT) / 2, 0);
    for (const ly of [1.5, 1.85, 2.2, 2.55]) b.box('body', DARK, 0.03, 0.14, MODULE_HALF * 2 - 1, sx * (H + 0.012), ly, 0);
    b.box('body', RED, 0.03, 0.42, MODULE_HALF * 2, sx * (H + 0.01), 0.72, 0);
    // Engine rooms either side of the corridor (the inside faces you walk past).
    const erW = INNER_HALF_W - MODULE_AISLE_HALF;
    b.box('inside', '#c9ced4', erW, TRAIN_ROOF_Y - FY - 0.1, MODULE_HALF * 2, sx * (MODULE_AISLE_HALF + erW / 2), (FY + TRAIN_ROOF_Y - 0.1) / 2, 0);
    b.box('inside', YELLOW, 0.012, 0.16, MODULE_HALF * 2 - 0.3, sx * (MODULE_AISLE_HALF - 0.008), FY + 1.1, 0);
    b.cyl('body', '#2a2d31', 0.14, 0.16, 0.5, sx * 0.6, TRAIN_ROOF_Y + 0.4, 0.8, 8);
  }

  // ---- side walls: paint below + above, glass between, slim pillars ----
  const wallSeg = (sx: number, z0: number, z1: number, cab: boolean) => {
    const len = z1 - z0, zc = (z0 + z1) / 2, x = wallX(sx);
    b.box('body', cab ? RED : WHITE, WALL_T, SILL - SKIRT, len, x, (SILL + SKIRT) / 2, zc);
    b.box('body', WHITE, WALL_T, TRAIN_ROOF_Y - HEAD, len, x, (HEAD + TRAIN_ROOF_Y) / 2, zc);
    b.box('glass', WHITE, 0.035, HEAD - SILL, len, x, (SILL + HEAD) / 2, zc);
    b.box('body', DARK, WALL_T + 0.01, HEAD - SILL, 0.16, x, (SILL + HEAD) / 2, z0 + 0.08);
    b.box('body', DARK, WALL_T + 0.01, HEAD - SILL, 0.16, x, (SILL + HEAD) / 2, z1 - 0.08);
    if (len > 3) b.box('body', DARK, WALL_T + 0.01, HEAD - SILL, 0.12, x, (SILL + HEAD) / 2, zc);
    if (!cab) {
      // Livery: a red band low on the body with a thin blue pinstripe over it.
      b.box('body', RED, 0.02, 0.36, len, sx * (H + 0.008), 0.7, zc);
      b.box('body', BLUE, 0.02, 0.07, len, sx * (H + 0.008), 0.98, zc);
    }
  };
  for (const sx of [-1, 1] as const) {
    for (const s of [-1, 1]) {
      const a = [MODULE_HALF, DOOR_Z - DOOR_HALF, DOOR_Z + DOOR_HALF, CAB_Z, L];
      const seg = (i: number, cab: boolean) => {
        const z0 = s > 0 ? a[i] : -a[i + 1], z1 = s > 0 ? a[i + 1] : -a[i];
        wallSeg(sx, z0, z1, cab);
      };
      seg(0, false); seg(2, false); seg(3, true);
      // Header over the doorway.
      b.box('body', WHITE, WALL_T, TRAIN_ROOF_Y - DOOR_TOP, DOOR_HALF * 2, wallX(sx), (TRAIN_ROOF_Y + DOOR_TOP) / 2, s * DOOR_Z);
      // The doors on the side that never meets a platform stay shut.
      if (sx !== platformSide) for (const half of [-1, 1]) leafParts(b, sx * (H - 0.045), s * DOOR_Z + half * DOOR_HALF / 2);
    }
  }

  // ---- cab ends ----
  for (const s of [-1, 1]) {
    const z = s * (L - 0.06);
    b.box('body', RED, H * 2, SILL + 0.15 - SKIRT, 0.12, 0, (SILL + 0.15 + SKIRT) / 2, z);
    b.box('body', DARK, H * 2 - 0.5, 0.5, 0.5, 0, 0.62, s * (L + 0.2));               // coupler cover
    b.box('body', WHITE, H * 2, TRAIN_ROOF_Y - HEAD - 0.1, 0.12, 0, (HEAD + 0.1 + TRAIN_ROOF_Y) / 2, z);
    for (const px of [-H + 0.09, H - 0.09]) b.box('body', DARK, 0.18, HEAD - SILL, 0.12, px, (SILL + HEAD) / 2 + 0.1, z);
    b.box('windshield', WHITE, H * 2 - 0.36, HEAD - SILL - 0.05, 0.05, 0, (SILL + HEAD) / 2 + 0.12, z);
    // Driver's desk + seat (a driver sits in whichever cab is leading).
    b.box('inside', '#30363f', H * 2 - 0.5, 0.5, 0.6, 0, FY + 0.75, s * (L - 0.6));
    b.box('inside', SEAT_DARK, 0.5, 0.5, 0.5, 0, FY + 0.25, s * (L - 1.45));
    // Glass partition behind the cab, with a frame.
    b.box('glass', WHITE, H * 2 - 0.3, TRAIN_ROOF_Y - FY - 0.4, 0.04, 0, FY + (TRAIN_ROOF_Y - FY - 0.4) / 2 + 0.05, s * CAB_Z);
    for (const px of [-INNER_HALF_W + 0.05, INNER_HALF_W - 0.05]) b.box('inside', GREY, 0.1, TRAIN_ROOF_Y - FY - 0.1, 0.08, px, (FY + TRAIN_ROOF_Y - 0.1) / 2, s * CAB_Z);
    b.box('inside', GREY, H * 2 - 0.3, 0.32, 0.08, 0, TRAIN_ROOF_Y - 0.26, s * CAB_Z);
    // LED sign housings: over the cab partition and over the module doorway.
    b.box('inside', '#101317', 1.7, 0.26, 0.05, 0, TRAIN_ROOF_Y - 0.27, s * (CAB_Z - 0.07));
    b.box('inside', '#101317', MODULE_AISLE_HALF * 2 + 0.5, 0.24, 0.05, 0, TRAIN_ROOF_Y - 0.24, s * (MODULE_HALF + 0.03));
  }

  // ---- seats ----
  for (const st of SEATS_LOCAL) {
    const along = st.face === 'n' || st.face === 's';
    b.box('inside', '#2b3340', st.w - 0.06, 0.4, st.d - 0.06, st.x, FY + 0.2, st.z);
    b.box('inside', SEAT, st.w, 0.12, st.d, st.x, FY + 0.46, st.z);
    if (along) {
      const back = st.face === 's' ? -1 : 1; // backrest is behind the sitter
      b.box('inside', SEAT, st.w, 0.72, 0.1, st.x, FY + 0.82, st.z + back * (st.d / 2 - 0.05));
      b.box('inside', SEAT_DARK, st.w, 0.16, 0.11, st.x, FY + 1.1, st.z + back * (st.d / 2 - 0.05));
    } else {
      const back = st.face === 'e' ? -1 : 1;
      b.box('inside', SEAT, 0.1, 0.56, st.d, st.x + back * (st.w / 2 - 0.05), FY + 0.78, st.z);
    }
  }
  return b.build();
}

/** The two leaves of one platform-side doorway (they slide apart along Z). */
function buildLeaf() {
  const b = new Batch();
  leafParts(b, 0, 0);
  return b.build();
}

const NAME: Record<StationId, string> = { avery: 'AVERY RANCH', domain: 'THE DOMAIN' };

function Train({ i }: { i: number }) {
  const group = useRef<THREE.Group>(null);
  const leaves = useRef<(THREE.Group | null)[]>([]);
  const drivers = useRef<(THREE.Group | null)[]>([]);
  const platformSide: 1 | -1 = i === 0 ? 1 : -1;
  const geo = useMemo(() => buildTrain(platformSide), [platformSide]);
  const leaf = useMemo(() => buildLeaf(), []);
  const mats = useMemo(() => {
    const mk = (c: string) => new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: c, emissiveIntensity: 0.1 });
    return {
      white: [mk('#fff3c8'), mk('#fff3c8')],
      red: [mk('#ff2a1e'), mk('#ff2a1e')],
      body: paint(0.45, 0.2),
      inside: glowPaint(0.8),
      glow: glowPaint(0.5),
      glass: glass('#a8cbdc', 0.17),
      windshield: glass('#3b4a57', 0.42),
      leaf: paint(0.45, 0.2),
    };
  }, []);
  // What the signs say — only re-rendered when the text changes.
  const [dest, setDest] = useState<StationId>('domain');
  const [led, setLed] = useState('');
  const last = useRef({ dest: 'domain' as StationId, led: '' });

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = rail.live;
    if (!rail.live) return;
    const tr = rail.trains[i];
    g.position.set(tr.x, 0, tr.z);
    // Doors: each pair parts along the car.
    const open = tr.door * (DOOR_HALF - 0.06);
    leaves.current.forEach((lf, k) => {
      if (!lf) return;
      const s = k < 2 ? -1 : 1, half = k % 2 === 0 ? -1 : 1;
      lf.position.z = s * DOOR_Z + half * (DOOR_HALF / 2 + open);
    });
    // Headlights lead, tail lights trail; the driver changes ends.
    const south = tr.dir === 1;
    const { white, red } = mats;
    white[0].emissiveIntensity = south ? 0.1 : 3; red[0].emissiveIntensity = south ? 2.2 : 0.1;   // north end
    white[1].emissiveIntensity = south ? 3 : 0.1; red[1].emissiveIntensity = south ? 0.1 : 2.2;   // south end
    if (drivers.current[0]) drivers.current[0]!.visible = !south;
    if (drivers.current[1]) drivers.current[1]!.visible = south;
    // Interior lighting comes up as the daylight goes.
    const sky = useSkyStore.getState();
    const lampsOn = skyPalette(sunDirection(sky.dayFraction).elevationDeg, moonDirection(sky.dayFraction).elevationDeg).lamps;
    mats.inside.emissiveIntensity = 0.95 * lampsOn;
    mats.glow.emissiveIntensity = 0.5 + 1.6 * lampsOn;
    // Signs.
    const l = last.current;
    if (tr.next !== l.dest) { l.dest = tr.next; setDest(tr.next); }
    let text: string;
    if (tr.at) text = tr.door > 0.2 ? `${NAME[tr.at]}  ·  TO ${NAME[tr.next]}` : `NEXT STOP  ${NAME[tr.next]}`;
    else if (tr.arrivesIn < 14) text = `ARRIVING  ${NAME[tr.next]}`;
    else { const sg = sightAt(tr.z); text = sg ? sg.label.toUpperCase() : `NEXT STOP  ${NAME[tr.next]}`; }
    if (text !== l.led) { l.led = text; setLed(text); }
  });

  const px = platformSide * (H - 0.045);
  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.inside} material={mats.inside} receiveShadow />
      <mesh geometry={geo.glow} material={mats.glow} />
      <mesh geometry={geo.glass} material={mats.glass} renderOrder={4} />
      <mesh geometry={geo.windshield} material={mats.windshield} renderOrder={4} />
      {/* Platform-side doors: [north pair, south pair]. */}
      {[0, 1, 2, 3].map((k) => (
        <group key={k} ref={(el) => { leaves.current[k] = el; }} position={[px, 0, 0]}>
          <mesh geometry={leaf.body} material={mats.leaf} />
          <mesh geometry={leaf.glass} material={mats.glass} renderOrder={4} />
        </group>
      ))}
      {/* Lights + destination sign + driver at each end (0 = north, 1 = south). */}
      {[-1, 1].map((s, e) => (
        <group key={s}>
          {[-0.95, 0.95].map((x) => (
            <mesh key={x} position={[x, 1.05, s * (L + 0.02)]} material={mats.white[e]}>
              <sphereGeometry args={[0.15, 10, 8]} />
            </mesh>
          ))}
          {[-0.58, 0.58].map((x) => (
            <mesh key={x} position={[x, 1.05, s * (L + 0.02)]} material={mats.red[e]}>
              <sphereGeometry args={[0.1, 8, 6]} />
            </mesh>
          ))}
          <mesh position={[0, TRAIN_ROOF_Y - 0.3, s * (L + 0.012)]}>
            <boxGeometry args={[1.9, 0.3, 0.03]} />
            <meshBasicMaterial color="#0c0e11" />
          </mesh>
          <Text position={[0, TRAIN_ROOF_Y - 0.3, s * (L + 0.035)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} fontSize={0.2} color="#ffb21e" anchorX="center" anchorY="middle" letterSpacing={0.06}>
            {NAME[dest]}
          </Text>
          <group ref={(el) => { drivers.current[e] = el; }} position={[0, FY, s * (L - 1.45)]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
            <mesh position={[0, 0.82, 0]}>
              <capsuleGeometry args={[0.2, 0.42, 4, 10]} />
              <meshStandardMaterial color="#27406b" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.36, 0]}>
              <sphereGeometry args={[0.15, 12, 10]} />
              <meshStandardMaterial color="#c99872" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.47, -0.02]}>
              <cylinderGeometry args={[0.16, 0.16, 0.08, 12]} />
              <meshStandardMaterial color="#1c2a4a" roughness={0.7} />
            </mesh>
          </group>
          {/* Inside: the amber next-stop display, facing down the saloon. */}
          <Text position={[0, TRAIN_ROOF_Y - 0.27, s * (CAB_Z - 0.105)]} rotation={[0, s > 0 ? Math.PI : 0, 0]} fontSize={0.105} maxWidth={1.6} color="#ffb21e" anchorX="center" anchorY="middle" letterSpacing={0.05}>
            {led}
          </Text>
          <Text position={[0, TRAIN_ROOF_Y - 0.24, s * (MODULE_HALF + 0.065)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} fontSize={0.085} maxWidth={1.5} color="#ffb21e" anchorX="center" anchorY="middle" letterSpacing={0.04}>
            {led}
          </Text>
          {/* Line diagram over the platform-side door. */}
          <Text position={[platformSide * (INNER_HALF_W - 0.01), DOOR_TOP + 0.13, s * DOOR_Z]} rotation={[0, -platformSide * Math.PI / 2, 0]} fontSize={0.062} color="#c8102e" anchorX="center" anchorY="middle" letterSpacing={0.03}>
            {'AVERY RANCH  •  Lakeline  •  Howard  •  THE DOMAIN'}
          </Text>
        </group>
      ))}
      {/* Name on the flanks. */}
      {[-1, 1].map((sx) => [-1, 1].map((s) => (
        <Text key={`${sx}${s}`} position={[sx * (H + 0.02), 1.32, s * 4.4]} rotation={[0, sx * Math.PI / 2, 0]} fontSize={0.3} color={RED} anchorX="center" anchorY="middle" letterSpacing={0.07}>
          MetroRail
        </Text>
      )))}
    </group>
  );
}

/** Both trainsets (Free Play; hidden and parked elsewhere otherwise). */
export function Trains() {
  return (
    <>
      <Train i={0} />
      <Train i={1} />
    </>
  );
}
