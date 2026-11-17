import { memo, useEffect, useState } from 'react';
import { create } from 'zustand';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useChatStore } from '../state/chatStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { useNpcStore } from '../state/npcStore';
import { useSkyStore } from '../state/skyStore';
import { dogNetIn, dogNetOut } from '../state/dogSync';
import { petChime, cheerSound } from '../audio';
import { hsHiddenFrom } from '../state/hideSeekStore';
import { HOUSES } from '../world/houses';
import { houseTransform, STREET_RADIUS, STRAIGHT_END_Z, STRAIGHT_HALF_ROAD } from '../world/streetLayout';
import { HERO_PIVOT_X, HERO_PIVOT_Z, HERO_YAW } from '../world/heroPlace';
import {
  CAS_EAST_X1, CAS_EAST_Z, CAS_HALF_W, CAS_NORTH_Z0, CART_X, CART_Z, GARDEN_HOMES, HOME_D, HOME_W,
  LOT_MAX_X, LOT_MAX_Z, LOT_MIN_X, LOT_MIN_Z, PARMER_CENTER_X, PARMER_Z1, PLAYGROUND_X, PLAYGROUND_Z,
  POND_RX, POND_RZ, POND_X, POND_Z, SCHOOL_DR_W, SCHOOL_DR_X, SCHOOL_DR_Z1, WEST_BLVD_W, WEST_BLVD_Z,
  WEST_BULB_R, WEST_BULB_X, WINGA_BACK_Z, WINGA_FRONT_Z, WINGA_MAX_X, WINGA_MIN_X, WINGB_BACK_X,
  WINGB_FRONT_X, WINGB_MAX_Z, WINGB_MIN_Z,
} from '../world/acrossBlvd';
import {
  BRIDGE_X0, BRIDGE_X1, CAMPUS, CONNECTOR_Z, CREEK_NORTH, CREEK_SOUTH, GREEN_TRAIL, NORTH_TRAIL, POOL,
  RAIL_TRAIL_X, RAIL_TRAIL_Z_N, RAIL_TRAIL_Z_S, RAIL_X, RAIL_X_B, RAIL_MID_X, RAIL_Z_N, TRAILHEAD,
} from '../world/westAvery';
import { SCHOOL_MAX_X, SCHOOL_MAX_Z, SCHOOL_MIN_X, SCHOOL_MIN_Z, SCHOOL_SHIFT_X } from '../world/school';
import { NPCS, planNpc } from '../world/npcs';
import { NPC_HOME_BELOW_EL, realSecondsAt, sunElevation } from '../world/npcTime';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import type { CharacterId } from '../types';
import {
  rail, TRACK_Z_S, STATIONS, PLATFORM_X0, PLATFORM_X1, PLATFORM_HALF_LEN, HOWARD_Z, LAKELINE_Z, LAKELINE_PLAT, rampSpan,
  LAKELINE_BLVD_Z, PARMER_Z,
} from '../world/redLine';
import { BURNET, PLAZA, STREET, LAWN, FOUNTAIN, SHOPS, SHOP_DEPTH, TOWERS, STAGE, PLAY, TACO_TRUCK, WALK_Z, shopFront } from '../world/domain';
import { LOTS, SH45, CREEK, MOPAC, QUARRY } from '../world/corridor';

// The neighbourhood map (Free Play). Since the world grew west to the school
// and north past the pond, "where IS the pool?" became a real question — so
// there's a little north-up minimap in the corner, and M (or a tap on it)
// opens the whole map with everything labelled, everyone's position, the
// train, Sparky, and where your current delivery needs to go.
//
// Drawn straight from the world's own layout constants (world X → map x,
// world Z → map y, so north is up) — it can't drift from the real geography.

/** A place the player asked to be guided to ("take me to the pool"). */
export interface Guide { x: number; z: number; icon: string; label: string }
interface MapStore {
  open: boolean;
  toggle: () => void;
  close: () => void;
  guide: Guide | null;
  setGuide: (g: Guide | null) => void;
  /** Big map flipped to the OTHER sheet (true = the Domain, false = home);
   *  null = show wherever I am. Forgotten whenever the map closes. */
  peek: boolean | null;
  setPeek: (south: boolean) => void;
}
export const useMapStore = create<MapStore>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open, peek: null })),
  close: () => set({ open: false, peek: null }),
  peek: null,
  setPeek: (peek) => set({ peek }),
  guide: null,
  setGuide: (guide) => set({ guide }),
}));
/** Close enough to count as "you made it". */
const ARRIVE_M = 11;

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
// Map extent in world metres.
const X0 = -292, X1 = 92, Z0 = -338, Z1 = 82;
// The Domain's own sheet (same shape as the home one, so the frame never jumps).
const DX0 = -402, DX1 = -98, DZ0 = 438, DZ1 = DZ0 + ((DX1 - DX0) * (Z1 - Z0)) / (X1 - X0);
/** South of here you are "down the line" and the big map shows the Domain. */
const SOUTH_FROM_Z = 200;
const MINI_PX = 132;
const MINI_RANGE = 62; // metres from the centre to the rim of the minimap

const PLAYER_COLOR: Record<CharacterId, string> = { dad: '#3a6db0', penny: '#e26aa1', luke: '#3fa34d' };

const pts = (p: [number, number][]) => p.map(([x, z]) => `${x},${z}`).join(' ');
const SCHOOL = { x0: SCHOOL_MIN_X + SCHOOL_SHIFT_X, x1: SCHOOL_MAX_X + SCHOOL_SHIFT_X, z0: SCHOOL_MIN_Z, z1: SCHOOL_MAX_Z };

interface Landmark {
  x: number; z: number; icon: string; label: string;
  dx?: number; dz?: number; anchor?: 'start' | 'middle' | 'end';
  /** Offer it as a "take me there" destination (with where to stand). */
  go?: [number, number];
}
const LANDMARKS: Landmark[] = [
  { x: HERO_PIVOT_X, z: HERO_PIVOT_Z, icon: '🏠', label: 'Our house', dz: 17, go: [HERO_PIVOT_X, HERO_PIVOT_Z - 13] },
  { x: (SCHOOL.x0 + SCHOOL.x1) / 2, z: (SCHOOL.z0 + SCHOOL.z1) / 2, icon: '🏫', label: 'Rutledge Elementary', dx: -24, dz: -32, anchor: 'start', go: [SCHOOL.x1 + 4, (SCHOOL.z0 + SCHOOL.z1) / 2] },
  { x: CAMPUS.playground.x, z: CAMPUS.playground.z, icon: '🛝', label: 'Recess', dz: 14 },
  { x: (POOL.water.minX + POOL.water.maxX) / 2, z: (POOL.water.minZ + POOL.water.maxZ) / 2, icon: '🏊', label: 'Pool', dz: -13, go: [POOL.deck.maxX + 2, POOL.gateEastZ] },
  { x: POND_X, z: POND_Z, icon: '🦆', label: 'Duck pond', dz: -15, go: [POND_X + 2, POND_Z + POND_RZ + 3] },
  { x: PLAYGROUND_X, z: PLAYGROUND_Z + 13, icon: '🛝', label: '' },
  { x: (WINGA_MIN_X + WINGA_MAX_X) / 2, z: (LOT_MIN_Z + LOT_MAX_Z) / 2, icon: '🛍️', label: 'Shops', dz: -27, go: [(WINGA_MIN_X + WINGA_MAX_X) / 2, WINGA_FRONT_Z + 4] },
  { x: WINGB_FRONT_X - 4, z: WINGB_MAX_Z - 4, icon: '🐶', label: 'Woof Gang', dz: 13, go: [WINGB_FRONT_X - 5, WINGB_MAX_Z - 4] },
  { x: CART_X, z: CART_Z, icon: '🍦', label: '' },
  { x: RAIL_MID_X, z: STATIONS.avery.z, icon: '🚆', label: 'Train to the Domain', dx: 10, dz: -6, anchor: 'start', go: [RAIL_MID_X, rampSpan(STATIONS.avery).z1 + 2.5] },
  { x: RAIL_MID_X, z: WEST_BLVD_Z, icon: '🚦', label: '', dz: 16 },
  { x: (BRIDGE_X0 + BRIDGE_X1) / 2, z: CONNECTOR_Z, icon: '🌉', label: 'Footbridge', dz: 13 },
  { x: TRAILHEAD.x, z: TRAILHEAD.z, icon: '🌲', label: 'Brushy Creek trail', dz: -11, go: [TRAILHEAD.x, TRAILHEAD.z + 4] },
];
/** Down the line: the Domain's own places. */
const DOMAIN_LANDMARKS: Landmark[] = [
  { x: RAIL_MID_X, z: STATIONS.domain.z, icon: '🚆', label: 'Train home', dx: 9, dz: -4, anchor: 'start', go: [RAIL_MID_X, rampSpan(STATIONS.domain).z1 + 2.5] },
  { x: STREET.x1 - 12, z: STREET.z, icon: '🛍️', label: 'Rock Rose shops', dz: -5, go: [STREET.x1 - 4, STREET.z] },
  { x: (SHOPS[0].x0 + SHOPS[0].x1) / 2, z: STREET.z - STREET.half - 6, icon: '🍦', label: '' },
  { x: (SHOPS[8].x0 + SHOPS[8].x1) / 2, z: STREET.z + STREET.half + 6, icon: '🍿', label: '' },
  { x: FOUNTAIN.x, z: FOUNTAIN.z, icon: '⛲', label: 'Fountain', dz: -7, go: [FOUNTAIN.x + 6, FOUNTAIN.z] },
  { x: PLAY.x, z: PLAY.z, icon: '🛝', label: 'The Lawn', dz: 13, go: [PLAY.x + 4, PLAY.z - 5] },
  { x: STAGE.x, z: STAGE.z, icon: '🎤', label: 'Stage', dz: -8, go: [STAGE.x + 6, STAGE.z] },
  { x: TACO_TRUCK.x, z: TACO_TRUCK.z, icon: '🌮', label: '', dz: -8 },
];
const ALL_LANDMARKS = [...LANDMARKS, ...DOMAIN_LANDMARKS];
const DESTINATIONS = LANDMARKS.filter((l) => l.go);
const DOMAIN_DESTINATIONS = DOMAIN_LANDMARKS.filter((l) => l.go);

/** Stations, and everything down the Red Line: the country it crosses and the Domain. */
function SouthArt({ labels }: { labels: boolean }) {
  const road = '#5d6470';
  const plat = (z: number, x0 = PLATFORM_X0, x1 = PLATFORM_X1, half = PLATFORM_HALF_LEN) => (
    <rect x={x0} y={z - half} width={x1 - x0} height={half * 2} rx={1} fill="#e8e2d2" stroke="#c8102e" strokeWidth={0.8} />
  );
  return (
    <g>
      {/* Land south of the neighbourhood (drawn under the rails by z-order below). */}
      <rect x={-470} y={Z1} width={420} height={700} fill="#96c873" />
      <rect x={QUARRY.x0} y={QUARRY.z0} width={QUARRY.x1 - QUARRY.x0} height={QUARRY.z1 - QUARRY.z0} rx={8} fill="#e6e0cf" stroke="#b9ad90" strokeWidth={1.2} />
      <rect x={QUARRY.x0 + 8} y={QUARRY.z0 + 22} width={44} height={24} rx={8} fill="#3fb6b2" />
      <rect x={-470} y={CREEK.z0} width={420} height={CREEK.z1 - CREEK.z0} fill="#5aa9e6" />
      <rect x={-470} y={SH45.z0} width={420} height={SH45.z1 - SH45.z0} fill={road} />
      <rect x={-470} y={MOPAC.z0} width={420} height={MOPAC.z1 - MOPAC.z0} fill="#7a808a" />
      {[LAKELINE_BLVD_Z, PARMER_Z].map((z) => <rect key={z} x={-236} y={z - 5.5} width={132} height={11} fill={road} />)}
      {LOTS.map((l) => <rect key={l.name} x={l.x0} y={l.z0} width={l.x1 - l.x0} height={l.z1 - l.z0} fill="#8b919b" />)}
      {/* The Domain */}
      <rect x={BURNET.x0} y={BURNET.z0} width={BURNET.x1 - BURNET.x0} height={BURNET.z1 - BURNET.z0} fill={road} />
      <rect x={PLAZA.x0} y={PLAZA.z0} width={PLAZA.x1 - PLAZA.x0} height={PLAZA.z1 - PLAZA.z0} fill="#e2d6bd" />
      <rect x={STREET.x0 - 6} y={STREET.z - STREET.half} width={STREET.x1 - STREET.x0 + 6} height={STREET.half * 2} fill="#e2d6bd" />
      <rect x={BURNET.x0} y={WALK_Z - 3} width={BURNET.x1 - BURNET.x0} height={6} fill="#f3f1e8" opacity={0.85} />
      <rect x={LAWN.x0} y={LAWN.z0} width={LAWN.x1 - LAWN.x0} height={LAWN.z1 - LAWN.z0} rx={4} fill="#7cc05f" stroke="#e2d6bd" strokeWidth={2} />
      <circle cx={FOUNTAIN.x} cy={FOUNTAIN.z} r={FOUNTAIN.r} fill="#5aa9e6" stroke="#fff" strokeWidth={0.8} />
      <rect x={STAGE.x - STAGE.w / 2} y={STAGE.z - STAGE.d / 2} width={STAGE.w} height={STAGE.d} fill="#a0764d" />
      {TOWERS.map((t, i) => <rect key={i} x={t.x0} y={t.z0} width={t.x1 - t.x0} height={t.z1 - t.z0} fill="#aab7c4" stroke="#6d7f91" strokeWidth={0.8} />)}
      {SHOPS.map((sh) => {
        const f = shopFront(sh.side), z0 = f.face > 0 ? f.z - SHOP_DEPTH : f.z;
        return <rect key={sh.id} x={sh.x0} y={z0} width={sh.x1 - sh.x0} height={SHOP_DEPTH} fill={sh.awning} stroke="#3b4652" strokeWidth={0.7} />;
      })}
      {/* Platforms: the two you can use, and the two the train passes. */}
      {plat(STATIONS.avery.z)}
      {plat(STATIONS.domain.z)}
      {plat(HOWARD_Z)}
      {plat(LAKELINE_Z, LAKELINE_PLAT.x0, LAKELINE_PLAT.x1, LAKELINE_PLAT.half)}
      {labels && (
        <g fontFamily={FONT} fontWeight={700} fill="#ffffff" opacity={0.95} fontSize={5.4} textAnchor="middle" style={{ letterSpacing: 0.5 }}>
          <text transform={`translate(${(BURNET.x0 + BURNET.x1) / 2 + 2} 580) rotate(-90)`}>BURNET RD</text>
          <text x={-330} y={MOPAC.z0 + 11}>MoPAC EXPRESSWAY</text>
          <text x={-330} y={CREEK.z0 - 3} fill="#2f6f9f">Walnut Creek</text>
          <text x={(STREET.x0 + STREET.x1) / 2} y={STREET.z + 2} fill="#3b4652">ROCK ROSE</text>
          <text x={RAIL_MID_X + 26} y={HOWARD_Z + 2} fill="#3a3f47">Howard Station</text>
        </g>
      )}
    </g>
  );
}

/** The static drawing: land, water, roads, rails, trails, buildings. */
const MapArt = memo(function MapArt({ labels }: { labels: boolean }) {
  const road = '#5d6470';
  const stickN = STRAIGHT_END_Z - 4; // where the stick meets the boulevard
  return (
    <g>
      <rect x={X0} y={Z0} width={X1 - X0} height={Z1 - Z0} fill="#96c873" />
      <SouthArt labels={labels} />
      {/* Greenbelt along the creek + the park north of the boulevard */}
      <polyline points={pts([...CREEK_SOUTH, ...CREEK_NORTH])} fill="none" stroke="#7fb65f" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx={CAMPUS.field.x} cy={CAMPUS.field.z} rx={CAMPUS.field.rx} ry={CAMPUS.field.rz} fill="#84bd62" stroke="#e9e2c8" strokeWidth={1.2} />

      {/* Water */}
      <polyline points={pts(CREEK_SOUTH)} fill="none" stroke="#5aa9e6" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts(CREEK_NORTH)} fill="none" stroke="#5aa9e6" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx={POND_X} cy={POND_Z} rx={POND_RX} ry={POND_RZ} fill="#5aa9e6" stroke="#3d86c2" strokeWidth={1} />
      <rect x={POOL.deck.minX} y={POOL.deck.minZ} width={POOL.deck.maxX - POOL.deck.minX} height={POOL.deck.maxZ - POOL.deck.minZ} rx={1.5} fill="#e8e0cf" />
      <rect x={POOL.water.minX} y={POOL.water.minZ} width={POOL.water.maxX - POOL.water.minX} height={POOL.water.maxZ - POOL.water.minZ} rx={1.5} fill="#49c3e8" />

      {/* Trails */}
      <g fill="none" stroke="#e0c08d" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3">
        <polyline points={pts(GREEN_TRAIL)} />
        <polyline points={pts(NORTH_TRAIL)} />
        <line x1={GREEN_TRAIL[3][0]} y1={CONNECTOR_Z} x2={RAIL_TRAIL_X} y2={CONNECTOR_Z} />
        <line x1={RAIL_TRAIL_X} y1={RAIL_TRAIL_Z_S} x2={RAIL_TRAIL_X} y2={RAIL_TRAIL_Z_N} />
      </g>

      {/* Roads */}
      <g stroke={road} strokeLinecap="butt" fill="none">
        <line x1={WEST_BULB_X} y1={WEST_BLVD_Z} x2={X1} y2={WEST_BLVD_Z} strokeWidth={WEST_BLVD_W} />
        <line x1={0} y1={-STREET_RADIUS + 2} x2={0} y2={stickN} strokeWidth={STRAIGHT_HALF_ROAD * 2} />
        <line x1={PARMER_CENTER_X} y1={WEST_BLVD_Z - 4} x2={PARMER_CENTER_X} y2={PARMER_Z1} strokeWidth={17} />
        <polyline points={`0,${CAS_NORTH_Z0 + 2} 0,${CAS_EAST_Z} ${CAS_EAST_X1},${CAS_EAST_Z}`} strokeWidth={CAS_HALF_W * 2} strokeLinejoin="round" />
        <line x1={SCHOOL_DR_X} y1={WEST_BLVD_Z} x2={SCHOOL_DR_X} y2={SCHOOL_DR_Z1} strokeWidth={SCHOOL_DR_W} />
      </g>
      <circle cx={0} cy={0} r={STREET_RADIUS} fill={road} />
      <circle cx={WEST_BULB_X} cy={WEST_BLVD_Z} r={WEST_BULB_R} fill={road} />
      <rect x={CAMPUS.lot.minX} y={CAMPUS.lot.minZ} width={CAMPUS.lot.maxX - CAMPUS.lot.minX} height={CAMPUS.lot.maxZ - CAMPUS.lot.minZ} fill="#737a86" />
      <rect x={LOT_MIN_X} y={LOT_MIN_Z} width={LOT_MAX_X - LOT_MIN_X} height={LOT_MAX_Z - LOT_MIN_Z} fill="#737a86" />
      <line x1={WEST_BULB_X} y1={WEST_BLVD_Z} x2={X1} y2={WEST_BLVD_Z} stroke="#f2d04b" strokeWidth={0.7} strokeDasharray="4 3" />

      {/* Railway */}
      {[RAIL_X, RAIL_X_B].map((rx) => (
        <g key={rx}>
          <line x1={rx} y1={RAIL_Z_N} x2={rx} y2={TRACK_Z_S} stroke="#3a3f47" strokeWidth={3} />
          <line x1={rx} y1={RAIL_Z_N} x2={rx} y2={TRACK_Z_S} stroke="#d8d2c4" strokeWidth={1.4} strokeDasharray="1.2 3" />
        </g>
      ))}

      {/* Houses on Royal Tara */}
      {HOUSES.map((h) => {
        const t = h.isHero ? { worldX: HERO_PIVOT_X, worldZ: HERO_PIVOT_Z, yaw: HERO_YAW } : houseTransform(h.position, h.depth);
        return (
          <rect
            key={h.address}
            x={-h.width / 2} y={-h.depth / 2} width={h.width} height={h.depth} rx={1}
            transform={`translate(${t.worldX} ${t.worldZ}) rotate(${(-t.yaw * 180) / Math.PI})`}
            fill={h.isHero ? '#f6c945' : '#c9b49a'} stroke={h.isHero ? '#a8740a' : '#8d7a63'} strokeWidth={h.isHero ? 1.4 : 0.7}
          />
        );
      })}
      {/* Casitas garden homes */}
      {GARDEN_HOMES.map((g, i) => {
        const side = Math.abs(Math.abs(g.faceYaw) - Math.PI / 2) < 0.1;
        const w = side ? HOME_D : HOME_W, d = side ? HOME_W : HOME_D;
        return <rect key={i} x={g.x - w / 2} y={g.z - d / 2} width={w} height={d} rx={0.8} fill="#d9c8ad" stroke="#8d7a63" strokeWidth={0.6} />;
      })}
      {/* Shops */}
      <rect x={WINGA_MIN_X} y={WINGA_BACK_Z} width={WINGA_MAX_X - WINGA_MIN_X} height={WINGA_FRONT_Z - WINGA_BACK_Z} fill="#d98f5f" stroke="#8a5632" strokeWidth={0.8} />
      <rect x={WINGB_FRONT_X} y={WINGB_MIN_Z} width={WINGB_BACK_X - WINGB_FRONT_X} height={WINGB_MAX_Z - WINGB_MIN_Z} fill="#d98f5f" stroke="#8a5632" strokeWidth={0.8} />
      {/* Rutledge Elementary */}
      <g fill="#b9c4d4" stroke="#5f6b7d" strokeWidth={0.8}>
        <rect x={SCHOOL.x0} y={SCHOOL.z0} width={SCHOOL.x1 - SCHOOL.x0} height={SCHOOL.z1 - SCHOOL.z0} />
        <rect x={CAMPUS.wingB.minX} y={CAMPUS.wingB.minZ} width={CAMPUS.wingB.maxX - CAMPUS.wingB.minX} height={CAMPUS.wingB.maxZ - CAMPUS.wingB.minZ} />
        <rect x={CAMPUS.link.minX} y={CAMPUS.link.minZ} width={CAMPUS.link.maxX - CAMPUS.link.minX} height={CAMPUS.link.maxZ - CAMPUS.link.minZ} />
        {CAMPUS.portables.map((p, i) => <rect key={i} x={p.x - p.w / 2} y={p.z - p.d / 2} width={p.w} height={p.d} fill="#e9ecef" />)}
      </g>
      <rect x={CAMPUS.court.x - CAMPUS.court.w / 2} y={CAMPUS.court.z - CAMPUS.court.d / 2} width={CAMPUS.court.w} height={CAMPUS.court.d} fill="#c9743f" stroke="#fff" strokeWidth={0.5} />

      {/* Street names (big map only) */}
      {labels && (
        <g fontFamily={FONT} fontWeight={700} fill="#ffffff" opacity={0.92} fontSize={6.2} textAnchor="middle" style={{ letterSpacing: 0.6 }}>
          <text transform="translate(2.2 -98) rotate(-90)">ROYAL TARA COVE</text>
          <text x={-110} y={WEST_BLVD_Z + 2.3}>AVERY RANCH BLVD</text>
          <text transform={`translate(${PARMER_CENTER_X + 2.2} -221) rotate(-90)`}>PARMER LN</text>
          <text transform={`translate(${RAIL_X - 4.5} -110) rotate(-90)`} fill="#3a3f47">METRORAIL RED LINE</text>
        </g>
      )}
    </g>
  );
});

/** Everything that moves: the train, Sparky, the family, the delivery pin. */
function LiveMarkers({ big }: { big: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), big ? 120 : 160);
    return () => clearInterval(id);
  }, [big]);
  const g = useGameStore.getState();
  const net = useNetStore.getState();
  const me = net.myCharacterId ?? g.activeCharacterId;
  const f = useSkyStore.getState().dayFraction;
  const T = realSecondsAt(f);
  const s = big ? 1 : 0.62; // marker scale
  const out: React.ReactNode[] = [];

  // Train
  if (rail.live) {
    rail.trains.forEach((tr, i) => {
      out.push(<text key={`train${i}`} x={tr.x} y={tr.z + 4} fontSize={13 * s} textAnchor="middle">🚆</text>);
    });
  }
  // Sparky
  const dog = net.isHost ? dogNetOut : dogNetIn;
  out.push(<text key="dog" x={dog.x} y={dog.z + 3} fontSize={9 * s} textAnchor="middle">🐕</text>);

  // Where my delivery goes
  const carrying = useNpcStore.getState().carrying;
  if (carrying) {
    const idx = NPCS.findIndex((n) => n.id === carrying.toId);
    if (idx >= 0) {
      const plan = planNpc(NPCS[idx], idx, T, sunElevation(f) < NPC_HOME_BELOW_EL);
      const pulse = 7 + (Math.sin(performance.now() / 260) + 1) * 2.5;
      out.push(
        <g key="errand">
          <circle cx={plan.x} cy={plan.z} r={pulse * s} fill="none" stroke="#f6c945" strokeWidth={1.6 * s} />
          <text x={plan.x} y={plan.z + 4 * s} fontSize={12 * s} textAnchor="middle">⭐</text>
          {big && (
            <text x={plan.x} y={plan.z - 10} fontSize={6.4} fontFamily={FONT} fontWeight={800} textAnchor="middle" fill="#3a2a00" stroke="#fff6cf" strokeWidth={2.2} paintOrder="stroke">
              {carrying.item} for {carrying.toName}
            </text>
          )}
        </g>,
      );
    }
  }

  // The family. Everyone a real person is playing, plus me on top.
  const humans = new Set<CharacterId>();
  for (const p of Object.values(net.peers)) if (p.characterId) humans.add(p.characterId);
  humans.add(me);
  for (const id of CHARACTER_ORDER) {
    if (!humans.has(id) || id === me) continue;
    if (hsHiddenFrom(me, id)) continue; // hide-and-seek: no peeking at the map
    const p = g.positions[id];
    out.push(
      <g key={id}>
        <circle cx={p.x} cy={p.z} r={5.2 * s} fill={PLAYER_COLOR[id]} stroke="#fff" strokeWidth={1.3 * s} />
        <text x={p.x} y={p.z + 2.6 * s} fontSize={6.6 * s} textAnchor="middle">{CHARACTERS[id].emoji}</text>
        {big && <text x={p.x} y={p.z - 8} fontSize={6} fontFamily={FONT} fontWeight={800} textAnchor="middle" fill="#fff" stroke="#1d2530" strokeWidth={2} paintOrder="stroke">{CHARACTERS[id].name}</text>}
      </g>,
    );
  }
  const p = g.positions[me];
  const yaw = g.yaws[me];
  out.push(
    <g key="me" transform={`translate(${p.x} ${p.z})`}>
      <g transform={`rotate(${(-yaw * 180) / Math.PI})`}>
        <polygon points={`0,${-10 * s} ${6.4 * s},${6 * s} 0,${2.6 * s} ${-6.4 * s},${6 * s}`} fill={PLAYER_COLOR[me]} stroke="#fff" strokeWidth={1.5 * s} strokeLinejoin="round" />
      </g>
      {big && <text y={-13} fontSize={6.4} fontFamily={FONT} fontWeight={800} textAnchor="middle" fill="#fff" stroke="#1d2530" strokeWidth={2.2} paintOrder="stroke">You</text>}
    </g>,
  );
  return <>{out}</>;
}

function Landmarks({ big, list = ALL_LANDMARKS }: { big: boolean; list?: Landmark[] }) {
  return (
    <g fontFamily={FONT}>
      {list.map((l, i) => (
        <g
          key={i}
          style={big && l.go ? { cursor: 'pointer' } : undefined}
          onClick={big && l.go ? (e) => { e.stopPropagation(); startGuide(l); } : undefined}
        >
          {big && l.go && <circle cx={l.x} cy={l.z} r={10} fill="rgba(255,255,255,0.55)" stroke="#2a2433" strokeWidth={0.9} />}
          <text x={l.x} y={l.z + (big ? 4 : 5)} fontSize={big ? 11 : 14} textAnchor="middle">{l.icon}</text>
          {big && l.label && (
            <text
              x={l.x + (l.dx ?? 0)} y={l.z + (l.dz ?? 0) + (l.dx ? 2.5 : 0)} fontSize={8.4} fontWeight={800}
              textAnchor={l.anchor ?? 'middle'} fill="#1d2530" stroke="#ffffff" strokeWidth={2.8} paintOrder="stroke"
            >
              {l.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function startGuide(l: Landmark): void {
  const [x, z] = l.go ?? [l.x, l.z];
  useMapStore.getState().setGuide({ x, z, icon: l.icon, label: l.label });
  useMapStore.getState().close();
  petChime();
}

/** The dashed "this way" line from me to where I asked to go. */
function GuideLine({ big }: { big: boolean }) {
  const guide = useMapStore((s) => s.guide);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!guide) return;
    const id = setInterval(() => setTick((n) => n + 1), 160);
    return () => clearInterval(id);
  }, [guide]);
  if (!guide) return null;
  const g = useGameStore.getState();
  const p = g.positions[useNetStore.getState().myCharacterId ?? g.activeCharacterId];
  const dx = guide.x - p.x, dz = guide.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  // On the minimap the target is usually off the edge: pin a marker to the rim.
  const rim = MINI_RANGE - 9;
  const far = !big && d > rim;
  const mx = far ? p.x + (dx / d) * rim : guide.x;
  const mz = far ? p.z + (dz / d) * rim : guide.z;
  return (
    <g>
      <line x1={p.x} y1={p.z} x2={mx} y2={mz} stroke="#ff4d8d" strokeWidth={big ? 2.2 : 2.6} strokeDasharray="5 4" strokeLinecap="round" opacity={0.9} />
      <circle cx={mx} cy={mz} r={big ? 9 : 8} fill="#ff4d8d" stroke="#fff" strokeWidth={1.4} />
      <text x={mx} y={mz + 4} fontSize={big ? 10 : 10} textAnchor="middle">{guide.icon}</text>
    </g>
  );
}

/** Follows my position so the minimap can centre on it (throttled). */
function useMyPosition(active: boolean): { x: number; z: number } {
  const [pos, setPos] = useState({ x: 0, z: 0 });
  useEffect(() => {
    if (!active) return;
    const read = () => {
      const g = useGameStore.getState();
      const p = g.positions[useNetStore.getState().myCharacterId ?? g.activeCharacterId];
      setPos((cur) => (Math.abs(cur.x - p.x) + Math.abs(cur.z - p.z) > 0.25 ? { x: p.x, z: p.z } : cur));
    };
    read();
    const id = setInterval(read, 160);
    return () => clearInterval(id);
  }, [active]);
  return pos;
}

export function WorldMap() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const me = useNetStore((s) => s.myCharacterId);
  const spectator = useNetStore((s) => s.spectator);
  const wardrobeOpen = useWardrobeStore((s) => s.open);
  const open = useMapStore((s) => s.open);
  const live = gameMode === 'freeplay' && !welcomeOpen && !!me && !spectator && !wardrobeOpen;
  const pos = useMyPosition(live && !open);
  const guide = useMapStore((s) => s.guide);
  const [guideDist, setGuideDist] = useState(0);
  /** Which sheet the big map shows: where I am, unless I flipped it to peek. */
  const peek = useMapStore((s) => s.peek);

  // The big map needs the mouse (to pick a place) — hand the cursor back.
  useEffect(() => {
    if (open && document.pointerLockElement) document.exitPointerLock();
  }, [open]);

  // Guided walk: count down the distance, cheer on arrival.
  useEffect(() => {
    if (!live || !guide) return;
    const id = setInterval(() => {
      const g = useGameStore.getState();
      const p = g.positions[useNetStore.getState().myCharacterId ?? g.activeCharacterId];
      const d = Math.hypot(guide.x - p.x, guide.z - p.z);
      if (d < ARRIVE_M) {
        useMapStore.getState().setGuide(null);
        cheerSound();
      } else setGuideDist(Math.round(d / 5) * 5);
    }, 250);
    return () => clearInterval(id);
  }, [live, guide]);

  useEffect(() => {
    if (!live) { useMapStore.getState().close(); if (gameMode !== 'freeplay') useMapStore.getState().setGuide(null); return; }
    const onKey = (e: KeyboardEvent) => {
      if (useChatStore.getState().inputOpen) return;
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'm') useMapStore.getState().toggle();
      else if (k === 'escape') useMapStore.getState().close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, gameMode]);

  if (!live) return null;

  if (open) {
    const g0 = useGameStore.getState();
    const imSouth = g0.positions[me ?? g0.activeCharacterId].z > SOUTH_FROM_Z;
    const south = peek ?? imSouth;
    const vb = south ? `${DX0} ${DZ0} ${DX1 - DX0} ${DZ1 - DZ0}` : `${X0} ${Z0} ${X1 - X0} ${Z1 - Z0}`;
    const dests = south ? DOMAIN_DESTINATIONS : DESTINATIONS;
    return (
      <div
        onClick={() => useMapStore.getState().close()}
        style={{
          position: 'fixed', inset: 0, zIndex: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(12, 20, 30, 0.45)', backdropFilter: 'blur(3px)', fontFamily: FONT,
        }}
      >
        <div
          style={{
            position: 'relative', height: 'min(88vh, 104vw)', aspectRatio: `${X1 - X0} / ${Z1 - Z0}`,
            borderRadius: 18, overflow: 'hidden', border: '4px solid #fff7e0',
            boxShadow: '0 18px 50px rgba(0,0,0,0.5)', animation: 'pop-in 0.25s ease-out', background: '#96c873',
          }}
        >
          <svg viewBox={vb} width="100%" height="100%" style={{ display: 'block' }}>
            <MapArt labels />
            <GuideLine big />
            <Landmarks big list={south ? DOMAIN_LANDMARKS : LANDMARKS} />
            <LiveMarkers big />
          </svg>
          <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(255,253,246,0.94)', color: '#2a2433', padding: '6px 12px', borderRadius: 12, fontWeight: 800, fontSize: 15, border: '2px solid #2a2433' }}>
            🗺️ {south ? 'The Domain' : 'Royal Tara Cove'} <span style={{ fontWeight: 600, opacity: 0.7, fontSize: 12 }}>· north is up</span>
          </div>
          {/* The other end of the Red Line is on its own sheet. */}
          <button
            onClick={(e) => { e.stopPropagation(); useMapStore.getState().setPeek(!south); }}
            style={{
              position: 'absolute', top: 10, right: 12, background: '#c8102e', color: '#fff', border: '2px solid #fff', borderRadius: 12,
              padding: '6px 12px', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            🚆 {south ? 'Show Royal Tara Cove' : 'Show the Domain'}
          </button>
          {south !== imSouth && (
            <div style={{ position: 'absolute', top: 50, right: 12, background: 'rgba(20,28,38,0.82)', color: '#fff', padding: '4px 10px', borderRadius: 10, fontWeight: 700, fontSize: 12 }}>
              {south ? 'Ride the Red Line from Avery Ranch to get here' : 'Ride the Red Line back to get here'}
            </div>
          )}
          {/* "Take me there": big friendly buttons (the circles on the map work too). */}
          <div style={{ position: 'absolute', left: 12, bottom: 44, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255,253,246,0.94)', color: '#2a2433', padding: '3px 10px', borderRadius: 10, fontWeight: 800, fontSize: 12, border: '2px solid #2a2433' }}>
              Show me the way to…
            </div>
            {dests.map((l) => {
              const on = !!guide && guide.label === l.label;
              return (
                <button
                  key={l.label}
                  onClick={(e) => { e.stopPropagation(); if (on) { useMapStore.getState().setGuide(null); } else startGuide(l); }}
                  style={{
                    background: on ? '#ff4d8d' : 'rgba(255,253,246,0.96)', color: on ? '#fff' : '#2a2433',
                    border: '2px solid #2a2433', borderRadius: 12, padding: '5px 12px', fontFamily: FONT,
                    fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  }}
                >
                  {l.icon} {l.label}{on ? ' ✕' : ''}
                </button>
              );
            })}
          </div>
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,28,38,0.8)', color: '#fff', padding: '5px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
            tap a place to get directions · tap the map or press M to close
          </div>
        </div>
      </div>
    );
  }

  // Corner minimap: north-up, centred on me; tap/click (or M) for the big one.
  return (
    <>
    {guide && (
      <button
        onClick={() => useMapStore.getState().setGuide(null)}
        aria-label="Stop directions"
        style={{
          position: 'fixed',
          top: `calc(env(safe-area-inset-top, 0px) + ${98 + MINI_PX + 6}px)`,
          left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          background: '#ff4d8d', color: '#fff', border: '2px solid #fff', borderRadius: 999,
          padding: '4px 12px', fontFamily: FONT, fontSize: 13, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,0.35)', zIndex: 60, whiteSpace: 'nowrap',
        }}
      >
        {guide.icon} {guide.label} · {guideDist} m ✕
      </button>
    )}
    <button
      onClick={() => useMapStore.getState().toggle()}
      aria-label="Open the map"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 98px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        width: MINI_PX, height: MINI_PX, padding: 0, borderRadius: '50%', overflow: 'hidden',
        border: '3px solid #fff7e0', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', background: '#96c873',
        zIndex: 60, cursor: 'pointer',
      }}
    >
      <svg viewBox={`${pos.x - MINI_RANGE} ${pos.z - MINI_RANGE} ${MINI_RANGE * 2} ${MINI_RANGE * 2}`} width={MINI_PX} height={MINI_PX} style={{ display: 'block' }}>
        <MapArt labels={false} />
        <Landmarks big={false} />
        <GuideLine big={false} />
        <LiveMarkers big={false} />
      </svg>
      <span style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,28,38,0.78)', color: '#fff', fontFamily: FONT, fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999, pointerEvents: 'none' }}>
        MAP · M
      </span>
    </button>
    </>
  );
}
