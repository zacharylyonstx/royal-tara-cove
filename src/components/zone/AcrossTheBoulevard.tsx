import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { usePlayStore } from '../../state/playStore';
import { useZoneStore } from '../../state/zoneStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { duckQuack, petChime } from '../../audio';
import { HeartBurst } from './HeartBurst';
import { CharacterModel } from '../CharacterModel';
import { CHARACTERS } from '../../world/characters';
import { OUTFITS, defaultAppearance, PALETTE } from '../../world/wardrobe';
import { ParkedCar } from '../HouseProps';
import { CasitasHomes } from './CasitasHomes';
import { School } from './School';
import {
  POND_X, POND_Z, POND_RX, POND_RZ,
  DOCK_W, DOCK_START_Z, DOCK_END_Z, DOCK_Y,
  CAS_HALF_W, CAS_NORTH_X, CAS_NORTH_Z0, CAS_NORTH_Z1, CAS_EAST_Z, CAS_EAST_X0, CAS_EAST_X1,
  LOT_MIN_X, LOT_MAX_X, LOT_MIN_Z, LOT_MAX_Z, SHOPS_H,
  WINGA_MIN_X, WINGA_MAX_X, WINGA_FRONT_Z, WINGA_BACK_Z, WINGA_SHOPS,
  WINGB_FRONT_X, WINGB_BACK_X, WINGB_MIN_Z, WINGB_MAX_Z, WINGB_SHOPS,
  PARMER_CENTER_X, PARMER_MEDIAN_HALF, PARMER_LANE_W, PARMER_Z0, PARMER_Z1,
  PLAYGROUND_X, PLAYGROUND_Z, PICNIC_X, PICNIC_Z, CART_X, CART_Z, GOLFCART_X, GOLFCART_Z,
  WALL_Z, POND_OAKS, LOT_OAKS,
  type ShopUnit,
  BOUTIQUE_X, BOUTIQUE_Z,
} from '../../world/acrossBlvd';

const ASPHALT = '#3d4045';
const PATH_TAN = '#cbb693';

/**
 * "Across the Boulevard" — corrected to the real satellite layout: Casitas Dr
 * straight across with its garden homes, the duck pond west, The Plaza in the
 * dogleg by Parmer. Pure additive zone in the always-rendered world.
 */
export function AcrossTheBoulevard() {
  useEffect(() => {
    usePlayStore.getState().registerCar({
      id: 'pond-golfcart',
      x: GOLFCART_X, z: GOLFCART_Z,
      color: '#f2f0e8',
      kind: 'golfcart',
      yaw: -Math.PI / 2, // parked nose-west toward the pond
    });
    useZoneStore.getState().register({
      id: 'icecream-cart',
      kind: 'icecream',
      label: 'get ice cream 🍦',
      x: CART_X, z: CART_Z,
      radius: 2.6,
    });
    return () => useZoneStore.getState().unregister('icecream-cart');
  }, []);

  return (
    <group>
      <Crosswalk />
      <EntryWalls />
      <CasitasRoad />
      <ParmerLane />
      <CasitasHomes />
      <Paths />
      <Pond />
      <Dock />
      <Ducks />
      <PondSign />
      <Plaza />
      <School />

      {/* Playground corner (west of the pond, wood-chip pad). */}
      <mesh position={[PLAYGROUND_X, 0.012, PLAYGROUND_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6.5, 24]} />
        <meshStandardMaterial color="#8a6a4a" roughness={1} />
      </mesh>
      <GLBModel
        url={MODELS.playground.url}
        fitHeight={MODELS.playground.fitHeight}
        position={[PLAYGROUND_X, 0, PLAYGROUND_Z]}
        rotationY={Math.PI / 3}
      />

      {/* Picnic + benches facing the water. */}
      <GLBModel url={MODELS.picnictable.url} fitHeight={MODELS.picnictable.fitHeight} position={[PICNIC_X, 0, PICNIC_Z]} rotationY={0.5} />
      <GLBModel url={MODELS.parkbench.url} fitHeight={MODELS.parkbench.fitHeight} position={[POND_X - 6.5, 0, -200.2]} rotationY={Math.PI + 0.2} />
      <GLBModel url={MODELS.parkbench.url} fitHeight={MODELS.parkbench.fitHeight} position={[POND_X + 7, 0, -200.6]} rotationY={Math.PI - 0.25} />

      {/* Ice cream cart at the park path fork. */}
      <GLBModel url={MODELS.icecreamstand.url} fitHeight={MODELS.icecreamstand.fitHeight} position={[CART_X, 0, CART_Z]} rotationY={Math.PI / 2.6} />

      {/* The golf cart (drivable). */}
      <ParkedCar carId="pond-golfcart" />

      {/* Live oaks: pond ring + Plaza parking islands. */}
      {POND_OAKS.map((o, i) => (
        <GLBModel key={`po-${i}`} url={MODELS.oak.url} fitHeight={5.5 * o.s} position={[o.x, 0, o.z]} rotationY={(i * 47) % 6} />
      ))}
      {LOT_OAKS.map((o, i) => (
        <GLBModel key={`lo-${i}`} url={MODELS.oak.url} fitHeight={4.2} position={[o.x, 0, o.z]} rotationY={(i * 31) % 6} />
      ))}
    </group>
  );
}

/** Zebra crosswalk over the boulevard, continuing the street centerline. */
function Crosswalk() {
  const stripes = useMemo(() => Array.from({ length: 8 }, (_, i) => -178.4 - i * 1.5), []);
  return (
    <group>
      {stripes.map((z) => (
        <mesh key={z} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.4, 0.62]} />
          <meshStandardMaterial color="#e8e6df" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Low limestone monument walls flanking the Casitas entrance. */
function EntryWalls() {
  return (
    <group>
      {[-9, 9].map((x) => (
        <group key={x} position={[x, 0, WALL_Z]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[6.5, 1, 0.8]} />
            <meshStandardMaterial color="#ddd3bc" roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[6.8, 0.14, 1.0]} />
            <meshStandardMaterial color="#c9bda2" roughness={0.9} />
          </mesh>
          <Text
            position={[0, 0.58, 0.42]}
            fontSize={0.42}
            color="#5a5345"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.1}
          >
            CASITAS
          </Text>
        </group>
      ))}
    </group>
  );
}

/** Casitas Dr: north segment straight across, corner patch, east leg to Parmer. */
function CasitasRoad() {
  const northLen = CAS_NORTH_Z0 - CAS_NORTH_Z1; // 35
  const eastLen = CAS_EAST_X1 - CAS_EAST_X0;
  return (
    <group>
      {/* North segment */}
      <mesh position={[CAS_NORTH_X, 0.014, (CAS_NORTH_Z0 + CAS_NORTH_Z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CAS_HALF_W * 2, northLen]} />
        <meshStandardMaterial color={ASPHALT} roughness={0.95} />
      </mesh>
      {/* Corner patch joining north + east legs */}
      <mesh position={[(CAS_NORTH_X - CAS_HALF_W + (CAS_EAST_X0 + 12)) / 2, 0.014, (CAS_NORTH_Z1 + (CAS_EAST_Z - CAS_HALF_W)) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12 + CAS_HALF_W * 2 - 5, CAS_EAST_Z - CAS_HALF_W - CAS_NORTH_Z1 < 0 ? CAS_NORTH_Z1 - (CAS_EAST_Z - CAS_HALF_W) : 12]} />
        <meshStandardMaterial color={ASPHALT} roughness={0.95} />
      </mesh>
      {/* East leg */}
      <mesh position={[(CAS_EAST_X0 + CAS_EAST_X1) / 2, 0.014, CAS_EAST_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[eastLen, CAS_HALF_W * 2]} />
        <meshStandardMaterial color={ASPHALT} roughness={0.95} />
      </mesh>
      {/* Center dashes (north segment) */}
      {Array.from({ length: 6 }, (_, i) => CAS_NORTH_Z0 - 3 - i * 5.5).map((z) => (
        <mesh key={z} position={[CAS_NORTH_X, 0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.18, 2.0]} />
          <meshStandardMaterial color="#d8d4c4" roughness={0.9} />
        </mesh>
      ))}
      {/* Sidewalks flanking the north segment */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[CAS_NORTH_X + s * (CAS_HALF_W + 0.9), 0.013, (CAS_NORTH_Z0 + CAS_NORTH_Z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.4, northLen]} />
          <meshStandardMaterial color="#cdc6b8" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Parmer Ln: the big median-divided road on the zone's east edge. */
function ParmerLane() {
  const len = PARMER_Z0 - PARMER_Z1;
  const midZ = (PARMER_Z0 + PARMER_Z1) / 2;
  const westLaneX = PARMER_CENTER_X - PARMER_MEDIAN_HALF - PARMER_LANE_W / 2;
  const eastLaneX = PARMER_CENTER_X + PARMER_MEDIAN_HALF + PARMER_LANE_W / 2;
  const dashes = useMemo(() => Array.from({ length: 9 }, (_, i) => PARMER_Z0 - 4 - i * 6.5), []);
  return (
    <group>
      {[westLaneX, eastLaneX].map((x) => (
        <mesh key={x} position={[x, 0.014, midZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[PARMER_LANE_W, len]} />
          <meshStandardMaterial color={ASPHALT} roughness={0.95} />
        </mesh>
      ))}
      {/* Raised landscaped median with crepe myrtles — the Parmer signature. */}
      <mesh position={[PARMER_CENTER_X, 0.09, midZ]} receiveShadow>
        <boxGeometry args={[PARMER_MEDIAN_HALF * 2, 0.18, len]} />
        <meshStandardMaterial color="#6f9456" roughness={1} />
      </mesh>
      {[-196, -212, -228, -244].map((z) => (
        <GLBModel key={z} url={MODELS.crepemyrtle.url} fitHeight={3.4} position={[PARMER_CENTER_X, 0.15, z]} rotationY={(z * 13) % 6} />
      ))}
      {/* Lane dashes */}
      {dashes.map((z) => (
        <group key={z}>
          <mesh position={[westLaneX, 0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.18, 2.4]} />
            <meshStandardMaterial color="#d8d4c4" roughness={0.9} />
          </mesh>
          <mesh position={[eastLaneX, 0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.18, 2.4]} />
            <meshStandardMaterial color="#d8d4c4" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* PARMER LN street sign at the blvd corner. */}
      <group position={[PARMER_CENTER_X - PARMER_MEDIAN_HALF - PARMER_LANE_W - 1.2, 0, PARMER_Z0 - 1.5]}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
          <meshStandardMaterial color="#4a4a4e" roughness={0.6} metalness={0.5} />
        </mesh>
        <mesh position={[0, 2.85, 0]} castShadow>
          <boxGeometry args={[2.0, 0.42, 0.06]} />
          <meshStandardMaterial color="#1e5c34" roughness={0.6} />
        </mesh>
        <Text position={[0, 2.85, 0.05]} fontSize={0.24} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          W PARMER LN
        </Text>
        <Text position={[0, 2.85, -0.05]} rotation={[0, Math.PI, 0]} fontSize={0.24} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          W PARMER LN
        </Text>
      </group>
    </group>
  );
}

/** Park paths: west from the crosswalk landing to the pond + dock spur. */
function Paths() {
  return (
    <group>
      {/* West path along the blvd's north side to the pond. */}
      <mesh position={[(POND_X + 2) / 2 - 4, 0.013, -194]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.abs(POND_X) + 14, 2.6]} />
        <meshStandardMaterial color={PATH_TAN} roughness={1} />
      </mesh>
      {/* Spur north to the dock. */}
      <mesh position={[POND_X, 0.013, (-194 + DOCK_START_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.6, Math.abs(DOCK_START_Z + 194)]} />
        <meshStandardMaterial color={PATH_TAN} roughness={1} />
      </mesh>
      {/* Spur to the playground. */}
      <mesh position={[(POND_X + PLAYGROUND_X) / 2, 0.013, -203]} rotation={[-Math.PI / 2, 0, 0.5]} receiveShadow>
        <planeGeometry args={[Math.abs(PLAYGROUND_X - POND_X) + 8, 2.2]} />
        <meshStandardMaterial color={PATH_TAN} roughness={1} />
      </mesh>
    </group>
  );
}

/** The pond: still water, sandy shore, lily pads. */
function Pond() {
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);
  const { waterGeom, shoreGeom } = useMemo(() => {
    const mk = (rx: number, rz: number) => {
      const shape = new THREE.Shape();
      shape.ellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
      return new THREE.ShapeGeometry(shape, 36);
    };
    return { waterGeom: mk(POND_RX, POND_RZ), shoreGeom: mk(POND_RX + 1.6, POND_RZ + 1.6) };
  }, []);

  useFrame(({ clock }) => {
    const m = waterRef.current;
    if (!m) return;
    m.envMapIntensity = 1.1 + Math.sin(clock.elapsedTime * 0.7) * 0.25;
  });

  return (
    <group position={[POND_X, 0, POND_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} geometry={shoreGeom} receiveShadow>
        <meshStandardMaterial color="#c8b98e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} geometry={waterGeom}>
        <meshStandardMaterial
          ref={waterRef}
          color="#2e6e8e"
          roughness={0.08}
          metalness={0.25}
          transparent
          opacity={0.94}
        />
      </mesh>
      {[[4.5, -4.5], [6.5, -3.2], [5.5, -6], [8, -4.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation={[-Math.PI / 2, 0, i * 1.7]}>
          <circleGeometry args={[0.55 - i * 0.07, 12]} />
          <meshStandardMaterial color="#3f7a3c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Wooden fishing dock over the south shore. */
function Dock() {
  const midZ = (DOCK_START_Z + DOCK_END_Z) / 2;
  const len = DOCK_START_Z - DOCK_END_Z;
  const posts: [number, number][] = [
    [POND_X - DOCK_W / 2, DOCK_START_Z - 1], [POND_X + DOCK_W / 2, DOCK_START_Z - 1],
    [POND_X - DOCK_W / 2, midZ], [POND_X + DOCK_W / 2, midZ],
    [POND_X - DOCK_W / 2, DOCK_END_Z], [POND_X + DOCK_W / 2, DOCK_END_Z],
  ];
  return (
    <group>
      <mesh position={[POND_X, DOCK_Y, midZ]} castShadow receiveShadow>
        <boxGeometry args={[DOCK_W, 0.08, len]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      <mesh position={[POND_X, DOCK_Y / 2 - 0.02, DOCK_START_Z + 0.75]} castShadow>
        <boxGeometry args={[DOCK_W, DOCK_Y - 0.04, 1.5]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.95} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, DOCK_Y / 2 - 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, DOCK_Y + 0.5, 8]} />
          <meshStandardMaterial color="#6a4e34" roughness={0.95} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[POND_X + side * (DOCK_W / 2 + 0.05), DOCK_Y + 0.5, midZ]} castShadow>
            <boxGeometry args={[0.07, 0.07, len]} />
            <meshStandardMaterial color="#7a5c3e" roughness={0.9} />
          </mesh>
          {[DOCK_START_Z - 0.5, midZ, DOCK_END_Z + 0.3].map((z, i) => (
            <mesh key={i} position={[POND_X + side * (DOCK_W / 2 + 0.05), DOCK_Y + 0.25, z]} castShadow>
              <boxGeometry args={[0.06, 0.5, 0.06]} />
              <meshStandardMaterial color="#7a5c3e" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[POND_X, DOCK_Y + 0.5, DOCK_END_Z - 0.05]} castShadow>
        <boxGeometry args={[DOCK_W + 0.2, 0.07, 0.07]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Four mallards on slow swimming loops; quacks when the family is close.
 *  Each duck is a PETTABLE zone spot (the kids kept asking "can you pet him?"):
 *  two loops hug the shore and two pass the dock tip so every duck comes within
 *  reach; E / ✋ → quack + hearts + a happy tail-wiggle. */
const DUCK_PET_RADIUS = 3.0;
const DUCK_COUNT = 4;

function Ducks() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bodyRefs = useRef<(THREE.Group | null)[]>([]);
  const nextQuack = useRef(0);
  const lastSeenPetAt = useRef(0);
  const posPushAccum = useRef(0);
  // Per-duck "being petted until" (clock seconds) — refs so HeartBurst can read them.
  const petUntil = useMemo(() => Array.from({ length: DUCK_COUNT }, () => ({ current: 0 })), []);
  const ducks = useMemo(
    () => [
      { r: 5, speed: 0.14, phase: 0, dir: 1 },       // passes the dock tip
      { r: 11, speed: 0.1, phase: 2.1, dir: -1 },    // hugs the shore
      { r: 3.5, speed: 0.18, phase: 4.0, dir: 1 },   // right by the dock
      { r: 11.5, speed: 0.08, phase: 5.3, dir: -1 }, // hugs the shore
    ],
    [],
  );

  useEffect(() => {
    const zs = useZoneStore.getState();
    for (let i = 0; i < DUCK_COUNT; i++) {
      zs.register({ id: `duck-${i}`, kind: 'pet', label: 'pet duck 🦆', x: POND_X, z: POND_Z, radius: DUCK_PET_RADIUS });
    }
    return () => {
      for (let i = 0; i < DUCK_COUNT; i++) useZoneStore.getState().unregister(`duck-${i}`);
    };
  }, []);

  useFrame(({ clock }, dtRaw) => {
    const t = clock.elapsedTime;
    const dt = Math.min(dtRaw, 0.1);

    // React to a fresh pet on one of OUR ducks.
    const zs = useZoneStore.getState();
    if (zs.lastPetAt !== lastSeenPetAt.current && zs.lastPetId && zs.lastPetId.startsWith('duck-')) {
      lastSeenPetAt.current = zs.lastPetAt;
      const i = Number(zs.lastPetId.slice(5));
      if (petUntil[i]) {
        petUntil[i].current = t + 1.3;
        duckQuack();
        petChime();
      }
    }

    posPushAccum.current += dt;
    const pushPos = posPushAccum.current > 0.15;
    if (pushPos) posPushAccum.current = 0;

    for (let i = 0; i < ducks.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const d = ducks[i];
      const a = d.phase + t * d.speed * d.dir;
      const x = POND_X + Math.cos(a) * d.r;
      const z = POND_Z + Math.sin(a) * d.r * (POND_RZ / POND_RX);
      g.position.set(x, 0.05 + Math.sin(t * 1.7 + d.phase) * 0.025, z);
      const tx = -Math.sin(a) * d.dir;
      const tz = Math.cos(a) * d.dir * (POND_RZ / POND_RX);
      g.rotation.y = Math.atan2(tx, tz);
      if (pushPos) zs.updatePos(`duck-${i}`, x, z);
      // Happy wiggle while being petted.
      const body = bodyRefs.current[i];
      if (body) {
        const remain = petUntil[i].current - t;
        if (remain > 0) {
          const k = remain / 1.3;
          body.position.y = Math.abs(Math.sin(t * 14)) * 0.12 * k;
          body.rotation.y = Math.sin(t * 18) * 0.35 * k;
        } else if (body.position.y !== 0 || body.rotation.y !== 0) {
          body.position.y = 0;
          body.rotation.y = 0;
        }
      }
    }
    if (t > nextQuack.current) {
      nextQuack.current = t + 7 + Math.random() * 9;
      const game = useGameStore.getState();
      const me = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
      const p = game.positions[me];
      if (p && Math.hypot(p.x - POND_X, p.z - POND_Z) < 26) duckQuack();
    }
  });

  return (
    <>
      {ducks.map((_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          <group ref={(g) => { bodyRefs.current[i] = g; }}>
            <GLBModel url={MODELS.duck.url} fitHeight={MODELS.duck.fitHeight} castShadow={false} />
          </group>
          <HeartBurst until={petUntil[i]} y={0.45} radius={0.3} />
        </group>
      ))}
    </>
  );
}

/** Little wooden DUCK POND sign at the path fork. */
function PondSign() {
  return (
    <group position={[-13, 0, -195.8]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 1.4, 8]} />
        <meshStandardMaterial color="#6a4e34" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[1.7, 0.5, 0.08]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      <Text position={[0, 1.32, 0.06]} fontSize={0.22} color="#fff3dd" anchorX="center" anchorY="middle" letterSpacing={0.1}>
        DUCK POND
      </Text>
    </group>
  );
}

/** The Plaza at Avery Ranch: parking lot + two limestone shop wings. */

/** The kids' boutique storefront: three dressed mannequins on plinths, a rack
 *  of hanging tops and an A-frame sign. Stand at the rack and press E / ✋ to
 *  "shop outfits" — it opens the same dress-up wardrobe as the bedroom dresser
 *  (everything's free; the buying is pretend). */
const MANNEQUINS: { id: 'penny' | 'luke' | 'dad'; outfit: string; dx: number }[] = [
  { id: 'penny', outfit: 'fairy', dx: -1.7 },
  { id: 'luke', outfit: 'super', dx: 0 },
  { id: 'dad', outfit: 'cowpoke', dx: 1.7 },
];
function Boutique() {
  useEffect(() => {
    useZoneStore.getState().register({ id: 'boutique', kind: 'shop', label: 'shop outfits 🛍️', x: BOUTIQUE_X, z: BOUTIQUE_Z, radius: 3.2 });
    return () => useZoneStore.getState().unregister('boutique');
  }, []);
  const looks = useMemo(() => MANNEQUINS.map((m) => {
    const outfit = OUTFITS.find((o) => o.id === m.outfit) ?? OUTFITS[0];
    return { ...m, appearance: { ...defaultAppearance(m.id), ...outfit.look } };
  }), []);
  return (
    <group>
      {looks.map((m) => (
        <group key={m.id} position={[BOUTIQUE_X + m.dx, 0, BOUTIQUE_Z - 1.1]}>
          <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.46, 0.18, 20]} />
            <meshStandardMaterial color="#f3eee4" roughness={0.6} />
          </mesh>
          {/* Face the lot (+Z = south). The model's front is +Z already. */}
          <group position={[0, 0.18, 0]} rotation={[0, 0, 0]}>
            <CharacterModel def={CHARACTERS[m.id]} appearance={m.appearance} />
          </group>
        </group>
      ))}
      {/* Clothes rack: two posts + bar + hanging tops in the palette colors. */}
      <group position={[BOUTIQUE_X + 3.2, 0, BOUTIQUE_Z - 0.9]}>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
            <meshStandardMaterial color="#4a4238" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />
          <meshStandardMaterial color="#4a4238" metalness={0.5} roughness={0.4} />
        </mesh>
        {PALETTE.slice(0, 6).map((c, i) => (
          <mesh key={c} position={[-0.6 + i * 0.24, 1.05, 0]} castShadow>
            <boxGeometry args={[0.2, 0.55, 0.07]} />
            <meshStandardMaterial color={c} roughness={0.85} />
          </mesh>
        ))}
      </group>
      {/* A-frame sandwich board. */}
      <group position={[BOUTIQUE_X - 3.2, 0, BOUTIQUE_Z + 0.3]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.45, -0.12]} rotation={[-0.25, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.04]} />
          <meshStandardMaterial color="#2c2f3a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.45, 0.12]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.04]} />
          <meshStandardMaterial color="#2c2f3a" roughness={0.9} />
        </mesh>
        <Text position={[0, 0.55, 0.17]} rotation={[0.25, 0, 0]} fontSize={0.13} color="#fff8ec" anchorX="center" anchorY="middle" maxWidth={0.6} textAlign="center">
          {'TRY ON\nANYTHING!\n🛍️'}
        </Text>
      </group>
    </group>
  );
}

function Plaza() {
  const lotW = LOT_MAX_X - LOT_MIN_X;
  const lotD = LOT_MAX_Z - LOT_MIN_Z;
  const lotCx = (LOT_MIN_X + LOT_MAX_X) / 2;
  const lotCz = (LOT_MIN_Z + LOT_MAX_Z) / 2;
  const stalls = useMemo(() => {
    const xs: number[] = [];
    for (let x = LOT_MIN_X + 3; x <= LOT_MAX_X - 3; x += 3.2) xs.push(x);
    return xs;
  }, []);
  return (
    <group>
      {/* Lot asphalt + entrance apron from the blvd. */}
      <mesh position={[lotCx, 0.012, lotCz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[lotW, lotD]} />
        <meshStandardMaterial color="#45484d" roughness={0.95} />
      </mesh>
      <mesh position={[lotCx, 0.012, -193.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#45484d" roughness={0.95} />
      </mesh>
      {/* Stall stripes (two rows). */}
      {stalls.map((x) => (
        <group key={x}>
          <mesh position={[x, 0.016, -199]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.14, 4.6]} />
            <meshStandardMaterial color="#cfcabb" roughness={0.9} />
          </mesh>
          <mesh position={[x, 0.016, -209.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.14, 4.6]} />
            <meshStandardMaterial color="#cfcabb" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Wing A — storefronts face SOUTH over the lot. */}
      <ShopWing
        units={WINGA_SHOPS}
        axis="x"
        frontCoord={WINGA_FRONT_Z}
        backCoord={WINGA_BACK_Z}
        min={WINGA_MIN_X}
        max={WINGA_MAX_X}
      />
      <Boutique />
      {/* Wing B — storefronts face WEST over the lot. */}
      <ShopWing
        units={WINGB_SHOPS}
        axis="z"
        frontCoord={WINGB_FRONT_X}
        backCoord={WINGB_BACK_X}
        min={WINGB_MIN_Z}
        max={WINGB_MAX_Z}
      />

      {/* Plaza monument sign at the lot entrance. */}
      <group position={[lotCx - 6.5, 0, -192.6]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[3.4, 1.8, 0.5]} />
          <meshStandardMaterial color="#ddd3bc" roughness={0.95} />
        </mesh>
        <Text position={[0, 1.25, 0.27]} fontSize={0.3} color="#5a5345" anchorX="center" anchorY="middle" letterSpacing={0.06}>
          THE PLAZA
        </Text>
        <Text position={[0, 0.85, 0.27]} fontSize={0.2} color="#75695a" anchorX="center" anchorY="middle" letterSpacing={0.1}>
          AT AVERY RANCH
        </Text>
      </group>
    </group>
  );
}

/**
 * One limestone shop strip. axis 'x': units span X, storefront plane at
 * z=frontCoord facing +Z (south). axis 'z': units span Z, storefront plane at
 * x=frontCoord facing -X (west).
 */
function ShopWing({ units, axis, frontCoord, backCoord, min, max }: {
  units: ShopUnit[];
  axis: 'x' | 'z';
  frontCoord: number;
  backCoord: number;
  min: number;
  max: number;
}) {
  const span = max - min;
  const mid = (min + max) / 2;
  const depth = Math.abs(backCoord - frontCoord);
  const depthMid = (frontCoord + backCoord) / 2;
  const facingSouth = axis === 'x';
  // Build in a local frame where the wing runs along local X with its
  // storefront at local +Z, then yaw the whole group for wing B.
  const groupPos: [number, number, number] = facingSouth ? [mid, 0, depthMid] : [depthMid, 0, mid];
  // −π/2 puts local +Z (the storefront) at world −X = WEST, over the lot. (+π/2
  // had Wing B's signs, glass and columns facing Parmer Ln — nobody could see
  // Woof Gang from the parking lot.)
  const groupYaw = facingSouth ? 0 : -Math.PI / 2;
  const columns = useMemo(() => {
    const xs: number[] = [];
    for (let c = -span / 2 + 0.8; c <= span / 2 - 0.6; c += 5.2) xs.push(c);
    return xs;
  }, [span]);

  return (
    <group position={groupPos} rotation={[0, groupYaw, 0]}>
      {/* Body + parapet */}
      <mesh position={[0, SHOPS_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[span, SHOPS_H, depth]} />
        <meshStandardMaterial color="#e6deca" roughness={0.95} />
      </mesh>
      <mesh position={[0, SHOPS_H + 0.18, 0]} castShadow>
        <boxGeometry args={[span + 0.4, 0.36, depth + 0.4]} />
        <meshStandardMaterial color="#cfc3a8" roughness={0.9} />
      </mesh>
      {/* Canopy + columns + walkway along the local +Z face */}
      <mesh position={[0, 3.15, depth / 2 + 1.35]} castShadow>
        <boxGeometry args={[span, 0.12, 2.7]} />
        <meshStandardMaterial color="#4a4238" roughness={0.6} metalness={0.3} />
      </mesh>
      {columns.map((c) => (
        <mesh key={c} position={[c, 1.55, depth / 2 + 2.45]} castShadow>
          <boxGeometry args={[0.45, 3.1, 0.45]} />
          <meshStandardMaterial color="#d8d0bc" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 0.015, depth / 2 + 1.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[span + 2, 3.2]} />
        <meshStandardMaterial color="#cdc6b8" roughness={1} />
      </mesh>
      {/* Units */}
      {units.map((s) => {
        const sw = s.max - s.min;
        const sc = (s.min + s.max) / 2 - mid; // unit center in local X
        return (
          <group key={s.name}>
            <mesh position={[sc, 3.0, depth / 2 + 0.09]} castShadow>
              <boxGeometry args={[sw - 0.6, 0.9, 0.18]} />
              <meshStandardMaterial color={s.accent} roughness={0.7} />
            </mesh>
            <Text position={[sc, 3.14, depth / 2 + 0.22]} fontSize={Math.min(0.42, (sw - 1.4) / Math.max(6, s.name.length) * 1.5)} color="#fff8ec" anchorX="center" anchorY="middle" letterSpacing={0.06}>
              {s.name}
            </Text>
            <Text position={[sc, 2.72, depth / 2 + 0.22]} fontSize={0.18} color="#fff8ec" anchorX="center" anchorY="middle" letterSpacing={0.16}>
              {s.sub}
            </Text>
            <mesh position={[sc, 1.25, depth / 2 + 0.03]}>
              <planeGeometry args={[sw - 1.6, 2.1]} />
              <meshStandardMaterial color="#27323c" roughness={0.15} metalness={0.4} transparent opacity={0.92} />
            </mesh>
            <mesh position={[sc - sw / 2 + 1.4, 1.1, depth / 2 + 0.05]}>
              <planeGeometry args={[0.95, 2.05]} />
              <meshStandardMaterial color="#4a4238" roughness={0.5} metalness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
