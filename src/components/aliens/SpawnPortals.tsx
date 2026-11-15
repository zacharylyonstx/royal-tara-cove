import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCombatStore } from '../../state/combatStore';
import { useGameStore } from '../../state/gameStore';
import { SPAWN_SITES, sitesForWave } from '../../world/blobWaves';
import type { SpawnSite, SpawnSiteId } from '../../world/blobWaves';
import { POD_FALL_S, WAVE_SHOT_S } from '../../systems/WaveController';
import { bossSlam } from '../../audio';
import { isTouchDevice } from '../../systems/touchInput';

const TOUCH = isTouchDevice();
const POD_START_Y = 85;
/** A landed pod lingers (smoking) this long after its wave is over. */
const POD_LINGER_S = 5;

/**
 * Where the blobs come from. Every wave lights up one or more landing sites:
 * the crashed saucer just opens its portal; the others get a drop pod that
 * streaks down from the mothership, thumps into the lawn and cracks open.
 *
 * Everything here is derived from the synced wave number/state, so guests see
 * the same pods in the same places without anything extra on the wire — and
 * each client plays the "here they come" camera shot locally.
 */
export function SpawnPortals() {
  const waveIndex = useCombatStore((s) => s.waveIndex);
  const phase = useGameStore((s) => s.phase);
  /** perf-seconds when THIS client first saw each wave start spawning. */
  const startedAt = useRef<Record<number, number>>({});
  const endedAt = useRef<Record<number, number>>({});

  // Wave bookkeeping + the establishing shot.
  useFrame(() => {
    const c = useCombatStore.getState();
    const ph = useGameStore.getState().phase;
    const w = c.waveIndex;
    const now = performance.now() / 1000;
    // A fresh game (intro replay) forgets the old waves.
    if (ph === 'intro') {
      if (Object.keys(startedAt.current).length > 0) { startedAt.current = {}; endedAt.current = {}; }
      return;
    }
    if (w < 1) return;
    const spawning = ph === 'combat' && c.waveState === 'spawning';
    if (spawning && startedAt.current[w] === undefined) {
      startedAt.current[w] = now;
      const sites = sitesForWave(w);
      const main = SPAWN_SITES[sites.find((s) => SPAWN_SITES[s].pod) ?? sites[0] ?? 'backyard'];
      // Look from the cul-de-sac side, high up, so the houses don't hide it.
      const toward = Math.hypot(main.x, main.z - 10) || 1;
      const ox = (-main.x / toward) * 15;
      const oz = (-(main.z - 10) / toward) * 15;
      c.startCinematic([main.x, 1.5, main.z], [main.x + ox + 6, 27, main.z + oz], WAVE_SHOT_S);
    }
    if (!spawning && startedAt.current[w] !== undefined && endedAt.current[w] === undefined
      && (c.waveState === 'cleared' || c.waveState === 'intermission' || ph !== 'combat')) {
      endedAt.current[w] = now;
    }
  });

  if (phase !== 'combat' && phase !== 'victory') return null;

  // Pods from this wave and (while they linger) the previous one.
  const items: { key: string; site: SpawnSite; wave: number }[] = [];
  for (const w of [waveIndex - 1, waveIndex]) {
    if (w < 1) continue;
    for (const id of sitesForWave(w)) items.push({ key: `${w}-${id}`, site: SPAWN_SITES[id as SpawnSiteId], wave: w });
  }

  return (
    <>
      {items.map((it) => (
        <SiteFx
          key={it.key}
          site={it.site}
          wave={it.wave}
          startedAt={startedAt}
          endedAt={endedAt}
        />
      ))}
    </>
  );
}

function SiteFx({ site, wave, startedAt, endedAt }: {
  site: SpawnSite;
  wave: number;
  startedAt: React.RefObject<Record<number, number>>;
  endedAt: React.RefObject<Record<number, number>>;
}) {
  const root = useRef<THREE.Group>(null);
  const portal = useRef<THREE.Group>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const pod = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const landed = useRef(false);
  // Each pod comes in on its own slanted line (seeded by site so every client agrees).
  const slant = useMemo(() => {
    const a = (site.x * 0.37 + site.z * 0.19 + wave) % (Math.PI * 2);
    return { x: Math.cos(a) * 16, z: Math.sin(a) * 16, tilt: 0.25 + ((wave * 7 + Math.abs(site.x)) % 5) * 0.05 };
  }, [site, wave]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const now = performance.now() / 1000;
    const t0 = startedAt.current[wave];
    if (t0 === undefined) { g.visible = false; return; }
    const tEnd = endedAt.current[wave];
    const age = now - t0;
    const c = useCombatStore.getState();
    const live = c.waveIndex === wave && c.waveState === 'spawning';
    const since = tEnd === undefined ? 0 : now - tEnd;
    if (tEnd !== undefined && since > POD_LINGER_S) { g.visible = false; return; }
    g.visible = true;

    // --- the pod ---
    if (pod.current) {
      if (!site.pod) {
        pod.current.visible = false;
      } else {
        pod.current.visible = true;
        const k = Math.min(1, age / POD_FALL_S);
        const fall = 1 - k * k; // accelerating
        pod.current.position.set(slant.x * fall, 0.55 + POD_START_Y * fall, slant.z * fall);
        const sink = tEnd === undefined ? 0 : Math.min(1, since / POD_LINGER_S);
        pod.current.position.y -= sink * 1.6;
        pod.current.rotation.set(slant.tilt, age * (k < 1 ? 5 : 0), -slant.tilt * 0.6);
        if (trail.current) {
          trail.current.visible = k < 1;
          (trail.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k * 0.4);
        }
        if (k >= 1 && !landed.current) {
          landed.current = true;
          // Only thump for pods that land while we're watching (not ones we
          // first see already on the ground after a late join).
          if (age < POD_FALL_S + 0.5) {
            bossSlam();
            c.addShake(0.45);
            c.spawnDebris(site.x, 0.4, site.z, 12);
          }
        }
        if (glow.current) {
          const m = glow.current.material as THREE.MeshStandardMaterial;
          m.emissiveIntensity = live ? 1.6 + Math.sin(now * 9) * 0.7 : Math.max(0.15, 1.2 - since * 0.4);
        }
      }
    }

    // --- the portal (only while things are still climbing out) ---
    if (portal.current) {
      const open = live && (!site.pod || age > POD_FALL_S);
      const target = open ? 1 : 0;
      const s = portal.current.scale.x + (target - portal.current.scale.x) * 0.12;
      portal.current.scale.setScalar(Math.max(0.001, s));
      portal.current.visible = s > 0.02;
      if (portal.current.visible) {
        if (ring1.current) ring1.current.rotation.z = now * 1.2;
        if (ring2.current) ring2.current.rotation.z = -now * 1.7;
        if (ring3.current) ring3.current.rotation.z = now * 0.6;
        if (light.current) light.current.intensity = (6 + Math.sin(now * 4) * 2) * s;
        if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = (0.35 + Math.sin(now * 3) * 0.15) * s;
      }
    }
  });

  return (
    <group ref={root} position={[site.x, 0, site.z]} visible={false}>
      <group ref={portal} position={[0, 0.05, 0]} scale={0.001}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 4.0, 36]} />
          <meshBasicMaterial color="#3afff0" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={ring1} position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.6, 0.18, 8, 32]} />
          <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={1.6} transparent opacity={0.85} />
        </mesh>
        <mesh ref={ring2} position={[0, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.0, 0.14, 8, 28]} />
          <meshStandardMaterial color="#a832c8" emissive="#a832c8" emissiveIntensity={1.4} transparent opacity={0.85} />
        </mesh>
        <mesh ref={ring3} position={[0, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.1, 6, 24]} />
          <meshStandardMaterial color="#fff15a" emissive="#fff15a" emissiveIntensity={1.6} transparent opacity={0.85} />
        </mesh>
        {/* Tall light beam — a beacon you can spot from the other end of the street. */}
        <mesh ref={beam} position={[0, 14, 0]}>
          <cylinderGeometry args={[1.5, 0.6, 28, 18, 1, true]} />
          <meshBasicMaterial color="#3afff0" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {!TOUCH && <pointLight ref={light} position={[0, 2, 0]} color="#3afff0" intensity={6} distance={26} />}
      </group>

      {site.pod && (
        <group ref={pod} position={[0, POD_START_Y, 0]}>
          {/* Hull: a dented alien seed-pod, half buried once it lands. */}
          <mesh castShadow scale={[1, 1.35, 1]}>
            <sphereGeometry args={[1.25, 18, 14]} />
            <meshStandardMaterial color="#3b4350" metalness={0.75} roughness={0.38} />
          </mesh>
          <mesh ref={glow} scale={[1.02, 1.37, 1.02]}>
            <sphereGeometry args={[1.25, 18, 6, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.12]} />
            <meshStandardMaterial color="#3afff0" emissive="#3afff0" emissiveIntensity={1.6} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, (i / 3) * Math.PI * 2, 0.5]} position={[0, -0.9, 0]} castShadow>
              <boxGeometry args={[0.16, 1.5, 0.5]} />
              <meshStandardMaterial color="#2a303a" metalness={0.7} roughness={0.45} />
            </mesh>
          ))}
          {/* Re-entry fire trail (only while falling). */}
          <mesh ref={trail} position={[0, 5.2, 0]}>
            <coneGeometry args={[1.15, 9, 12, 1, true]} />
            <meshBasicMaterial color="#ffb14a" transparent opacity={0.75} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}
    </group>
  );
}
