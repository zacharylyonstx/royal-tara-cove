import { useEffect, useMemo, useRef } from 'react';
import { Sky } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight, HemisphereLight, AmbientLight } from 'three';
import { Street } from './Street';
import { House } from './House';
import { Yard } from './Yard';
import { HousePropsRenderer } from './HouseProps';
import { Character } from './Character';
import { CameraRig } from '../systems/CameraRig';
import { PlayerController } from '../systems/PlayerController';
import { NPCController } from '../systems/NPCController';
import { HOUSES } from '../world/houses';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { FRONT_YARD_DEPTH } from '../world/streetLayout';
import { buildLots } from '../world/lots';
import { buildColliders, buildPropColliders } from '../world/colliders';
import { buildPropsFor } from '../world/props';
import { mat } from '../world/materials';
import {
  HeroHouse10600,
  buildInteriorColliders,
  buildHeroUpstairsColliders,
  buildPorchColliders,
  buildHeroFloors,
  buildHeroExteriorColliders,
} from './hero/HeroHouse10600';
import { LiveOak } from './vegetation/LiveOak';
import { RiddenBikes } from './props/RiddenBike';
import { Ramp, buildRampFloor, buildRampColliders } from './props/Ramp';
import { CrepeMyrtle } from './vegetation/CrepeMyrtle';
import { Hedge } from './vegetation/Hedge';
import { UFOCrash } from './aliens/UFOCrash';
import { Schmorgesblob, GooSplat as GooSplatMesh } from './aliens/Schmorgesblob';
import { BossBlob } from './aliens/BossBlob';
import { HitParticles } from './aliens/HitParticles';
import { Stars } from './aliens/Stars';
import { RayGun } from './weapons/RayGun';
import { KidBlaster } from './weapons/KidBlaster';
import { PennyBomber } from './weapons/PennyBomber';
import { LukeLegoLauncher } from './weapons/LukeLegoLauncher';
import { Beams } from './weapons/Beams';
import { BlobController } from '../systems/BlobController';
import { CombatController } from '../systems/CombatController';
import { WaveController } from '../systems/WaveController';
import { SidekickController } from '../systems/SidekickController';
import { SkyController } from '../systems/SkyController';
import { PowerUpController } from '../systems/PowerUpController';
import { ProjectileController } from '../systems/ProjectileController';
import { MusicController } from '../systems/MusicController';
import { ProjectorController } from '../systems/ProjectorController';
import { TornadoController } from '../systems/TornadoController';
import { TreehouseCamera } from '../systems/TreehouseCamera';
import { TreehouseController } from '../systems/TreehouseController';
import { Treehouse } from './treehouse/Treehouse';
import { Ladder } from './treehouse/Ladder';
import { SouvenirShelf } from './treehouse/SouvenirShelf';
import { MissionItem } from './treehouse/MissionItem';
import { MissionMarker } from './treehouse/MissionMarker';
import { MunchiesCamera } from '../systems/MunchiesCamera';
import { MunchiesController } from '../systems/MunchiesController';
import { SleepwalkerController } from '../systems/SleepwalkerController';
import { NightAtmosphere } from './munchies/NightAtmosphere';
import { CookiePickupsLive } from './munchies/CookiePickup';
import { MilkPickupsLive } from './munchies/MilkPickup';
import { BonusCookieLive } from './munchies/BonusCookie';
import { BedsLive } from './munchies/Bed';
import { SleepwalkersLive } from './munchies/Sleepwalker';
import { SiblingBond } from './munchies/SiblingBond';
import { RagdollController } from '../systems/RagdollController';
import { NetSyncController } from '../systems/NetSyncController';
import { SpeechBubbles } from '../ui/SpeechBubbles';
import { Tornado } from './Tornado';
import { Rain } from './weather/Rain';
import { Hail } from './weather/Hail';
import { Lightning } from './weather/Lightning';
import { LightningBoltRenderer } from './weather/LightningBolt';
import { StormDome } from './weather/StormDome';
import { WallCloud } from './weather/WallCloud';
import { RagdollComedy } from './weather/RagdollComedy';
import { useTornadoStore } from '../state/tornadoStore';
import { PickupRenderer } from './pickups/Pickup';
import { Projectiles } from './projectiles/Projectiles';
import { Fireworks } from './celebration/Fireworks';
import { Confetti } from './celebration/Confetti';
import { DiscoLights } from './celebration/DiscoLights';
import { DancingBlobs } from './celebration/DancingBlobs';
import { Fireflies } from './celebration/Fireflies';
import { BackyardPortal } from './celebration/BackyardPortal';
import { useCombatStore } from '../state/combatStore';
import { CameraExposer } from '../ui/Dialogue';

export function Game() {
  // Hide ONLY the character this peer claimed (so we don't see our own body in FPS view).
  // In single-player this falls back to gameStore.activeCharacterId.
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const activeId = myCharacterId ?? fallbackActive;
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const setStaticColliders = useGameStore((s) => s.setStaticColliders);
  const setFloors = useGameStore((s) => s.setFloors);

  // Compute lots, props, and colliders once.
  const lots = useMemo(() => buildLots(HOUSES), []);
  const lotsByAddress = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildLots>[number]>();
    for (const l of lots) m.set(l.address, l);
    return m;
  }, [lots]);
  const propsByAddress = useMemo(() => buildPropsFor(HOUSES), []);

  useEffect(() => {
    const base = buildColliders(HOUSES, lots);
    // Hero house adds interior + porch colliders
    const hero = HOUSES.find((h) => h.isHero);
    let extra: typeof base = [];
    if (hero) {
      const heroLot = lotsByAddress.get(hero.address)!;
      extra = [
        ...buildInteriorColliders(hero, heroLot),
        ...buildHeroUpstairsColliders(hero, heroLot),
        ...buildPorchColliders(hero, heroLot),
        ...buildHeroExteriorColliders(hero, heroLot),
      ];
      setFloors([...buildHeroFloors(hero, heroLot), buildRampFloor()]);
    }
    const propColliders = buildPropColliders(HOUSES, lotsByAddress, propsByAddress);
    setStaticColliders([...base, ...extra, ...propColliders, ...buildRampColliders()]);
  }, [lots, lotsByAddress, propsByAddress, setStaticColliders, setFloors]);

  return (
    <>
      <DynamicSky />
      <Stars />
      <DynamicLights />

      {/* Ground plane (textured grass) */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <primitive object={mat.grass()} attach="material" />
      </mesh>

      <Street />
      <Ramp />

      {/* Houses: hero special-cased */}
      {HOUSES.map((h) => {
        const lot = lotsByAddress.get(h.address)!;
        return (
          <group key={h.address}>
            <Yard config={h} lot={lot} />
            {h.isHero ? (
              <HeroHouse10600 config={h} lot={lot} />
            ) : (
              <House config={h} lot={lot} />
            )}
            <HousePropsRenderer config={h} lot={lot} data={propsByAddress.get(h.address)!} />
            {/* Per-lot vegetation: 1 live oak in back, 1 crepe myrtle in front */}
            <LotVegetation address={h.address} lot={lot} depth={h.depth} width={h.width} garageOnLeft={h.garageOnLeft} />
          </group>
        );
      })}

      {/* Common-area / greenbelt tree line behind the lots, spanning the
          ~165 m street from the bulb up to the Avery Ranch Blvd entry. */}
      {[
        { x: -42, z: -35 }, { x: 42, z: -35 },
        { x: -44, z: -72 }, { x: 44, z: -72 },
        { x: -44, z: -108 }, { x: 44, z: -108 },
        { x: -42, z: -144 }, { x: 42, z: -144 },
        { x: -40, z: -172 }, { x: 40, z: -172 },
        { x: -12, z: -179 }, { x: 12, z: -179 },
      ].map((p, i) => (
        <LiveOak key={`bgtree-${i}`} position={[p.x, 0, p.z]} scale={1.05} seed={i + 99} />
      ))}

      {/* Characters */}
      {CHARACTER_ORDER.map((id) => (
        <Character
          key={id}
          def={CHARACTERS[id]}
          positionRef={positions[id]}
          yawRef={{
            get current() { return yaws[id]; },
            set current(v: number) { yaws[id] = v; },
          }}
          isActive={id === activeId}
        />
      ))}

      <RiddenBikes />

      <AliensModeSystems />

      {/* Mode-agnostic systems */}
      <PlayerController />
      <NPCController />
      <SkyController />
      <MusicController />
      <ProjectorController />
      <TornadoModeSystems />
      <MunchiesModeSystems />
      <TreehouseModeSystems />
      <CameraRig />
      <CameraExposer />
      <NetSyncController />
      <SpeechBubbles />
    </>
  );
}

function MunchiesModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  if (gameMode !== 'munchies') return null;
  return (
    <>
      <NightAtmosphere />
      <MunchiesCamera />
      <MunchiesController />
      <SleepwalkerController />
      <CookiePickupsLive />
      <MilkPickupsLive />
      <BonusCookieLive />
      <BedsLive />
      <SleepwalkersLive />
      <SiblingBond />
      {phase === 'munchies-victory' && <Confetti />}
    </>
  );
}

function TreehouseModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'treehouse') return null;
  return (
    <>
      <TreehouseCamera />
      <TreehouseController />
      <Treehouse />
      <Ladder />
      <SouvenirShelf />
      <MissionItem />
      <MissionMarker />
    </>
  );
}

function TornadoModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'tornado') return null;
  return (
    <>
      <TornadoController />
      <RagdollController />
      <StormDome />
      <Tornado />
      <WallCloud />
      <Rain />
      <Hail />
      <Lightning />
      <LightningBoltRenderer />
      <RagdollComedy />
      <StormFog />
    </>
  );
}

function AliensModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'aliens') return null;
  return (
    <>
      {/* Aliens + combat */}
      <UFOCrash />
      <BlobRenderer />
      <SplatRenderer />
      <HitParticles />
      <Beams />
      <RayGun />
      <PennyBomber />
      <LukeLegoLauncher />
      <KidBlaster who="penny" color="#e26aa1" />
      <KidBlaster who="luke" color="#5cb85c" />
      <PickupsLive />
      <Projectiles />
      <BackyardPortal />
      <VictoryOnly />
      <Fireflies />
      <BlobController />
      <CombatController />
      <ProjectileController />
      <PowerUpController />
      <SidekickController />
      <WaveController />
    </>
  );
}

function StormFog() {
  const stormIntensity = useTornadoStore((s) => s.stormIntensity);
  if (stormIntensity < 0.1) return null;
  const near = 25 - stormIntensity * 8;
  const far = 130 - stormIntensity * 75;
  return <fog attach="fog" args={['#3a3a40', near, far]} />;
}

function DynamicSky() {
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const storm = useTornadoStore((s) => s.stormIntensity);
  // 0..1 → angle around horizon. We compute a sun position via timeOfDay.
  // tod 0..0.5 = day, 0.5..1 = night (sun below).
  const elev = Math.max(0.05, Math.cos(timeOfDay * Math.PI)); // 1 at noon, -1 at midnight
  const azimuth = (timeOfDay - 0.25) * Math.PI; // sweeps E->W
  // Sun gets pushed below horizon as storm builds, so the sky reads near-black.
  const stormSunDip = storm * 1.4;
  const sunY = 100 * (elev - stormSunDip);
  const sunX = 100 * Math.sin(azimuth);
  const sunZ = 100 * Math.cos(azimuth);
  const turbidity = 4 + timeOfDay * 7 + storm * 12;
  const rayleigh = 1.5 + timeOfDay * 1.8 + storm * 5;
  return (
    <Sky
      sunPosition={[sunX, sunY, sunZ]}
      turbidity={turbidity}
      rayleigh={rayleigh}
      mieCoefficient={0.005}
      mieDirectionalG={0.7}
    />
  );
}

function DynamicLights() {
  const dirRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const ambRef = useRef<AmbientLight>(null);
  useFrame(() => {
    const t = useCombatStore.getState().timeOfDay;
    const storm = useTornadoStore.getState().stormIntensity;
    const stormDarken = 1 - 0.88 * storm;
    const sunIntensity = Math.max(0.05, 1.5 * (1 - t * 1.6)) * stormDarken;
    if (dirRef.current) {
      dirRef.current.intensity = sunIntensity;
      // Color shifts cooler as night approaches; grey-shifts during storm.
      const r = (1.0 - t * 0.4) * (1 - storm * 0.5);
      const g = (0.95 - t * 0.55) * (1 - storm * 0.45);
      const b = (0.82 - t * 0.4) * (1 - storm * 0.4);
      dirRef.current.color.setRGB(Math.max(0.2, r), Math.max(0.2, g), Math.max(0.3, b));
      // Sun position
      const elev = Math.max(0.05, Math.cos(t * Math.PI));
      const azimuth = (t - 0.25) * Math.PI;
      dirRef.current.position.set(60 * Math.sin(azimuth), 80 * elev, 35 * Math.cos(azimuth));
    }
    if (hemiRef.current) {
      // Strong sky/ground bounce at midday so shadowed (north-facing) walls
      // stay bright and brick reads warm, not black. Tapers to a moody level
      // at night (munchies/tornado/aliens-wave-3).
      hemiRef.current.intensity = (0.95 - 0.62 * t) * stormDarken;
    }
    if (ambRef.current) {
      // High DAYTIME ambient floor so shadow sides + dark props keep colour
      // instead of crushing to black; stays near the old level at night.
      ambRef.current.intensity = (0.45 - t * 0.10) * Math.max(0.26, 1 - storm * 0.7);
      const r = (0.62 + t * 0.2) * (1 - storm * 0.4);
      const g = (0.72 + t * 0.15) * (1 - storm * 0.4);
      const b = 0.92 * (1 - storm * 0.3);
      ambRef.current.color.setRGB(r, g, b);
    }
  });
  return (
    <>
      <hemisphereLight ref={hemiRef} color="#fff5d8" groundColor="#6a9a4e" intensity={0.92} />
      <directionalLight
        ref={dirRef}
        position={[60, 80, 35]}
        intensity={1.5}
        color="#fff0d0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0008}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <ambientLight ref={ambRef} intensity={0.45} color="#bfe0ec" />
    </>
  );
}

function PickupsLive() {
  const drops = useCombatStore((s) => s.powerUpDrops);
  return <PickupRenderer drops={drops} />;
}

function VictoryOnly() {
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'victory' && phase !== 'free-play') return null;
  return (
    <>
      <Fireworks />
      <Confetti />
      <DiscoLights />
      <DancingBlobs />
    </>
  );
}

function BlobRenderer() {
  const blobs = useCombatStore((s) => s.blobs);
  return (
    <>
      {blobs.map((b) => {
        if (b.kind === 'boss') return <BossBlob key={b.id} blob={b} />;
        return <Schmorgesblob key={b.id} blob={b} />;
      })}
    </>
  );
}

function SplatRenderer() {
  const splats = useCombatStore((s) => s.splats);
  return (
    <>
      {splats.map((s) => <GooSplatMesh key={s.id} x={s.x} z={s.z} variant={s.variant} spawnedAt={s.spawnedAt} scale={s.scale} />)}
    </>
  );
}

function LotVegetation({ address, lot, depth, width, garageOnLeft }: { address: string; lot: ReturnType<typeof buildLots>[number]; depth: number; width: number; garageOnLeft: boolean }) {
  // The hero house (10600) plants its own memory oak + backyard trees, so skip
  // the generic lot vegetation there (it would double up / fight the layout).
  if (address === '10600') return null;
  // Place 1-2 live oaks in the backyard region (centroid + offset toward back)
  // and a crepe myrtle near the front sidewalk.
  const seed = address.charCodeAt(0) * 131 + address.charCodeAt(2) * 7;
  const cx = lot.housePivot[0];
  const cz = lot.housePivot[1];
  const yawCos = Math.cos(lot.houseYaw);
  const yawSin = Math.sin(lot.houseYaw);

  const halfD = depth / 2;
  const halfW = width / 2;
  // backyard offset: well behind the back wall + any back deck/pool
  const backLocalX = (((seed % 7) - 3) * 0.7);
  const backLocalZ = halfD + 4 + (seed % 3);
  const backWX = cx + backLocalX * yawCos + backLocalZ * yawSin;
  const backWZ = cz - backLocalX * yawSin + backLocalZ * yawCos;

  // Crepe myrtle at the FRONT-GARAGE-SIDE corner of the yard — clear of the front
  // door/walkway (which sits on the opposite, non-garage side) and outboard of the
  // driveway, so it never blocks the entry or grows through a parked car.
  const sideLocalX = (garageOnLeft ? -1 : 1) * (halfW + 1.0);
  const sideLocalZ = -halfD - FRONT_YARD_DEPTH * 0.72;
  const sideWX = cx + sideLocalX * yawCos + sideLocalZ * yawSin;
  const sideWZ = cz - sideLocalX * yawSin + sideLocalZ * yawCos;

  // Hedge against the front foundation (outside, hugging the front wall)
  const showHedge = (seed % 3) === 0;
  const hedgeLocalZ = -halfD - 0.7;
  const hedgeWX = cx + 0 * yawCos + hedgeLocalZ * yawSin;
  const hedgeWZ = cz - 0 * yawSin + hedgeLocalZ * yawCos;

  return (
    <>
      <LiveOak position={[backWX, 0, backWZ]} scale={1.15 + (seed % 5) * 0.05} seed={seed} />
      <CrepeMyrtle
        position={[sideWX, 0, sideWZ]}
        scale={0.9 + (seed % 3) * 0.07}
        bloomColor={(seed % 2) === 0 ? '#d985b3' : '#c66ea4'}
        seed={seed}
      />
      {showHedge && (
        <Hedge position={[hedgeWX, 0, hedgeWZ]} rotation={lot.houseYaw} length={3.5} />
      )}
    </>
  );
}
