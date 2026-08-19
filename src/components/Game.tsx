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
import { usePlayStore } from '../state/playStore';
import { buildLots } from '../world/lots';
import { buildColliders, buildPropColliders } from '../world/colliders';
import { GREENBELT_TREES, lotTrees, buildTreeColliders } from '../world/vegetation';
import { buildPropsFor } from '../world/props';
import { mat } from '../world/materials';
import {
  HeroHouse10600,
  buildInteriorColliders,
  buildHeroUpstairsColliders,
  buildPorchColliders,
  buildHeroFloors,
  buildHeroExteriorColliders,
  buildPlayhouseColliders,
  buildTrampolineZone,
} from './hero/HeroHouse10600';
import { LiveOak } from './vegetation/LiveOak';
import { RiddenBikes } from './props/RiddenBike';
import { VehicleFX } from './VehicleFX';
import { DistantScenery } from './DistantScenery';
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
import { liveOakPosition } from '../world/treehouseMissions';
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
import { SirenHeadController } from '../systems/SirenHeadController';
import { SirenHead } from './horror/SirenHead';
import { Lanterns } from './horror/Lanterns';
import { Flashlight } from './horror/Flashlight';
import { useNightStore } from '../state/nightStore';
import { HIDE_ZONES, SAFE_ZONES } from '../world/nightLayout';
import { NetSyncController } from '../systems/NetSyncController';
import { SpeechBubbles } from '../ui/SpeechBubbles';
import { NameTags } from '../ui/NameTags';
import { AcrossTheBoulevard } from './zone/AcrossTheBoulevard';
import { FamilyDog } from './zone/FamilyDog';
import { Pups } from './zone/Pups';
import { buildAcrossBlvdColliders, buildAcrossBlvdFloors } from '../world/acrossBlvd';
import { Tornado } from './Tornado';
import { Rain } from './weather/Rain';
import { Hail } from './weather/Hail';
import { Lightning } from './weather/Lightning';
import { LightningBoltRenderer } from './weather/LightningBolt';
import { StormDome } from './weather/StormDome';
import { WallCloud } from './weather/WallCloud';
import { RagdollComedy } from './weather/RagdollComedy';
import { GroundScar } from './weather/tornado/GroundScar';
import { WindDebris } from './weather/tornado/WindDebris';
import { FlyingCow } from './weather/tornado/FlyingCow';
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
import { Atmosphere } from './Atmosphere';
import { NeighborhoodWildflowers } from './vegetation/Wildflowers';
import { isTouchDevice } from '../systems/touchInput';

// Crisper shadows on desktop; lighter on touch to protect iPad framerate.
const SHADOW_RES = isTouchDevice() ? 1024 : 2048;

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
        ...buildPlayhouseColliders(hero, heroLot),
      ];
      // ONE setFloors call for the whole world (it replaces wholesale).
      setFloors([...buildHeroFloors(hero, heroLot), buildRampFloor(), ...buildAcrossBlvdFloors()]);
      usePlayStore.getState().registerTrampoline(buildTrampolineZone(hero, heroLot));
    }
    const propColliders = buildPropColliders(HOUSES, lotsByAddress, propsByAddress);
    setStaticColliders([...base, ...extra, ...propColliders, ...buildTreeColliders(HOUSES, lotsByAddress), ...buildRampColliders(), ...buildAcrossBlvdColliders()]);
    // Siren Head Night hide/safe zones (static layout — register once).
    useNightStore.getState().setZones(HIDE_ZONES, SAFE_ZONES);
  }, [lots, lotsByAddress, propsByAddress, setStaticColliders, setFloors]);

  return (
    <>
      <DynamicSky />
      <Atmosphere />
      <SceneFog />
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

      {/* Common-area / greenbelt tree line behind the lots (world coords shared
          with the collider builder so you can't drive through them). */}
      {GREENBELT_TREES.map((p, i) => (
        <LiveOak key={`bgtree-${i}`} position={[p.x, 0, p.z]} scale={1.05} seed={i + 99} />
      ))}

      {/* Texas wildflowers along the greenbelt — a little Austin authenticity. */}
      <NeighborhoodWildflowers />

      {/* Hazy distant treeline framing the neighborhood (depth backdrop). */}
      <DistantScenery />

      {/* The duck pond, park + shops across Avery Ranch Blvd (real geography). */}
      <AcrossTheBoulevard />
      {/* Sparky lives at 10600 in Free Play. */}
      <FamilyDog />
      {/* Woof Gang's adoptable pups (Free Play only). */}
      <Pups />

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
      <VehicleFX />

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
      <NightModeSystems />
      <CameraRig />
      <CameraExposer />
      <NetSyncController />
      <SpeechBubbles />
      <NameTags />
      {/* Self-gated on timeOfDay (visible only when dusk falls) — mounted
          globally so any mode that gets dark earns backyard fireflies. */}
      <Fireflies />
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

function TreehouseOak() {
  const oak = liveOakPosition();
  return <LiveOak position={[oak.x, 0, oak.z]} scale={1.45} seed={3} />;
}

function TreehouseModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'treehouse') return null;
  return (
    <>
      <TreehouseCamera />
      <TreehouseController />
      {/* The oak the treehouse lives in (removed from the freeplay backyard to
          make room for the playset, so treehouse mode plants its own). */}
      <TreehouseOak />
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
      <GroundScar />
      <WindDebris />
      <FlyingCow />
      <WallCloud />
      <Rain />
      <Hail />
      <Lightning />
      <LightningBoltRenderer />
      <RagdollComedy />
    </>
  );
}

function NightModeSystems() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'night') return null;
  return (
    <>
      <SirenHeadController />
      <SirenHead />
      <Lanterns />
      <Flashlight />
      <RagdollController />
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
      <BlobController />
      <CombatController />
      <ProjectileController />
      <PowerUpController />
      <SidekickController />
      <WaveController />
    </>
  );
}

// Unified scene fog (one <fog> for the whole scene). Storm murk overrides
// everything; daytime gets a warm pale haze that only touches the distant tree
// line for depth while keeping the play area crisp; munchies night stays clear.
function SceneFog() {
  const stormIntensity = useTornadoStore((s) => s.stormIntensity);
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const gameMode = useGameStore((s) => s.gameMode);
  if (stormIntensity >= 0.1) {
    const near = 25 - stormIntensity * 8;
    const far = 130 - stormIntensity * 75;
    return <fog attach="fog" args={['#3a3a40', near, far]} />;
  }
  // Siren Head Night: thick, cool fog that closes in just behind the player so
  // Siren Head looms out of the dark — claustrophobic but readable with a light.
  if (gameMode === 'night') return <fog attach="fog" args={['#10161f', 7, 52]} />;
  if (gameMode === 'munchies') return null;
  const dusk = Math.min(1, Math.max(0, timeOfDay) * 1.5);
  const r = Math.round((0.81 - dusk * 0.33) * 255);
  const g = Math.round((0.86 - dusk * 0.34) * 255);
  const b = Math.round((0.9 - dusk * 0.3) * 255);
  const near = 70;
  const far = 330 - dusk * 140;
  return <fog attach="fog" args={[`rgb(${r},${g},${b})`, near, far]} />;
}

function DynamicSky() {
  const gameMode = useGameStore((s) => s.gameMode);
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const storm = useTornadoStore((s) => s.stormIntensity);
  // Siren Head Night: the drei <Sky> scattering shader never goes truly dark
  // (it stays a sunset glow at low sun), which kills the horror mood — so swap
  // it for a solid deep-night backdrop. Stars render against it; the cool fog
  // blends the horizon.
  if (gameMode === 'night') return <color attach="background" args={['#070a14']} />;
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
    // Siren Head Night: override to cool moonlight. Dark + moody on desktop
    // (the flashlight + lantern/siren glow carry it); a lifted cool floor on
    // touch so iPad stays playable without a flashlight cone.
    if (useGameStore.getState().gameMode === 'night') {
      const touch = isTouchDevice();
      if (dirRef.current) {
        dirRef.current.intensity = 0.16;
        dirRef.current.color.setRGB(0.55, 0.62, 0.95);
        dirRef.current.position.set(-30, 70, -20); // moon overhead
      }
      if (hemiRef.current) {
        hemiRef.current.intensity = touch ? 0.26 : 0.12;
        hemiRef.current.color.setRGB(0.3, 0.4, 0.62);
      }
      if (ambRef.current) {
        ambRef.current.intensity = touch ? 0.34 : 0.16;
        ambRef.current.color.setRGB(0.32, 0.42, 0.7);
      }
      return;
    }
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
        shadow-mapSize-width={SHADOW_RES}
        shadow-mapSize-height={SHADOW_RES}
        shadow-radius={4}
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
  // Positions come from the shared world/vegetation module (single source of
  // truth with the collider builder). The hero house plants its own trees → null.
  const t = lotTrees(address, lot, depth, width, garageOnLeft);
  if (!t) return null;
  return (
    <>
      <LiveOak position={[t.oak[0], 0, t.oak[1]]} scale={t.oakScale} seed={t.seed} />
      <CrepeMyrtle position={[t.myrtle[0], 0, t.myrtle[1]]} scale={t.myrtleScale} bloomColor={t.myrtleBloom} seed={t.seed} />
      {t.hedge && (
        <Hedge position={[t.hedge.x, 0, t.hedge.z]} rotation={t.hedge.rotation} length={3.5} />
      )}
    </>
  );
}
