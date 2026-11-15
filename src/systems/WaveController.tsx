import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import type { BlobKind } from '../state/combatStore';
import { victoryFanfare, stopCrackleLoop, waveAlarm, bossRoar } from '../audio';
import { SPAWN_SITES, WAVE_COUNT, sitesForWave, spawnQueueFor } from '../world/blobWaves';
import type { SpawnSiteId } from '../world/blobWaves';
import { ensureBlobNav, blobSafeSpot } from '../world/blobNav';

const SPAWN_INTERVAL = 0.55;
const INTERMISSION_LEN = 6.0;
/** Length of the "here they come" camera shot at the start of each wave. */
export const WAVE_SHOT_S = 2.8;
/** Pods take this long to fall — nothing climbs out before they land. */
export const POD_FALL_S = 1.5;

/** How many humans are playing (1 in solo). */
function humanCount(): number {
  let n = 0;
  for (const p of Object.values(useNetStore.getState().peers)) if (p.characterId) n++;
  return Math.max(1, n);
}

/**
 * Owns the wave state machine. When the player enters combat, runs:
 *   spawning(N) → fighting → cleared → intermission → next wave
 * Until all waves are cleared, then victory.
 */
export function WaveController() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const blobs = useCombatStore((s) => s.blobs);
  const waveIndex = useCombatStore((s) => s.waveIndex);
  const waveState = useCombatStore((s) => s.waveState);
  const intermissionEndsAt = useCombatStore((s) => s.intermissionEndsAt);
  const setWave = useCombatStore((s) => s.setWave);
  const setWaveState = useCombatStore((s) => s.setWaveState);
  const setIntermissionEnd = useCombatStore((s) => s.setIntermissionEnd);
  const spawnBlob = useCombatStore((s) => s.spawnBlob);
  const consumeBlobToSpawn = useCombatStore((s) => s.consumeBlobToSpawn);
  const pushDialogue = useCombatStore((s) => s.pushDialogue);
  const startGame = useCombatStore((s) => s.startGame);
  const spawnDebris = useCombatStore((s) => s.spawnDebris);
  const addShake = useCombatStore((s) => s.addShake);

  const spawnAccum = useRef(0);
  const enteredCombatRef = useRef(false);
  /** Host-side spawn order for the current wave (site + kind per blob). */
  const queue = useRef<{ site: SpawnSiteId; kind: BlobKind }[]>([]);
  const queueFor = useRef(-1);
  const waveStartedAt = useRef(0);

  const beginWave = (index: number) => {
    const q = spawnQueueFor(index, humanCount());
    queue.current = q;
    queueFor.current = index;
    waveStartedAt.current = performance.now() / 1000;
    const byKind = new Map<BlobKind, number>();
    for (const e of q) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);
    setWave(index, [...byKind].map(([kind, count]) => ({ kind, count })));
  };

  // When combat begins for the first time, kick off Wave 1.
  useEffect(() => {
    if (!useNetStore.getState().isHost) return;
    if (phase === 'combat' && !enteredCombatRef.current) {
      enteredCombatRef.current = true;
      startGame();
      beginWave(1);
      pushDialogue('dad', 'Time to test the ray gun.');
    }
    if (phase === 'intro') {
      enteredCombatRef.current = false;
    }
    // beginWave only touches refs + stable store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setWave, startGame, pushDialogue]);

  useFrame((_, dtRaw) => {
    if (!useNetStore.getState().isHost) return;
    if (useGameStore.getState().gameMode !== 'aliens') return;
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1);
    const now = performance.now() / 1000;

    // A guest promoted to host mid-wave has no queue of its own: rebuild what's
    // left from the synced counts so the wave can still finish.
    if (waveState === 'spawning' && queueFor.current !== waveIndex) {
      queue.current = spawnQueueFor(waveIndex, humanCount()).slice(blobs.length);
      queueFor.current = waveIndex;
      waveStartedAt.current = now - POD_FALL_S;
    }

    // Hold the spawns for the first beat of the establishing shot (see
    // WaveCinematic), then let them pour out while everyone is still watching.
    const cin = useCombatStore.getState().cinematic;
    if (waveState === 'spawning' && cin.active && now < cin.endsAt - (WAVE_SHOT_S - 0.9)) return;

    // Spawn blobs from the current wave's queue.
    if (waveState === 'spawning') {
      ensureBlobNav(useGameStore.getState().staticColliders);
      spawnAccum.current += dt;
      if (spawnAccum.current >= SPAWN_INTERVAL) {
        spawnAccum.current = 0;
        // Pods have to land before anything can climb out of them.
        const podsDown = now - waveStartedAt.current >= POD_FALL_S;
        const idx = queue.current.findIndex((e) => podsDown || !SPAWN_SITES[e.site].pod);
        if (idx >= 0) {
          const next = queue.current.splice(idx, 1)[0];
          const site = SPAWN_SITES[next.site];
          // Wider scatter so blobs don't stack on top of each other.
          const ang = Math.random() * Math.PI * 2;
          const r = next.kind === 'boss' ? 0 : 2 + Math.random() * 3.5;
          const spot = blobSafeSpot(site.x + Math.cos(ang) * r, site.z + Math.sin(ang) * r);
          // The big one toughens up when the whole family is fighting it.
          const hp = next.kind === 'boss' ? Math.round(60 * (1 + 0.4 * (humanCount() - 1))) : undefined;
          spawnBlob(next.kind, spot.x, 0.6, spot.z, { hp });
          consumeBlobToSpawn(next.kind);
          if (next.kind === 'boss') {
            bossRoar();
            pushDialogue('dad', 'That one\'s HUGE.');
            // Boss "smashes through the back fence" — spawn debris burst + shake
            spawnDebris(site.x, 0.5, site.z + 4, 18);
            addShake(0.6);
          }
        } else if (queue.current.length === 0) {
          // Done spawning
          setWaveState('fighting');
        }
      }
    } else if (waveState === 'fighting') {
      const aliveCount = blobs.filter((b) => b.alive).length;
      if (aliveCount === 0) {
        setWaveState('cleared');
        if (waveIndex >= WAVE_COUNT) {
          // Victory
          setPhase('victory');
          stopCrackleLoop();
          victoryFanfare();
          pushDialogue('dad', 'Earth defended!');
        } else {
          setIntermissionEnd(now + INTERMISSION_LEN);
          setWaveState('intermission');
          if (waveIndex === 1) pushDialogue('penny', 'We got \'em!');
          if (waveIndex === 3) pushDialogue('luke', 'Take THAT, blobs!');
        }
      }
    } else if (waveState === 'intermission') {
      if (now >= intermissionEndsAt) {
        // Next wave
        const nextIdx = waveIndex + 1;
        if (nextIdx > WAVE_COUNT) {
          setPhase('victory');
          stopCrackleLoop();
          victoryFanfare();
        } else {
          waveAlarm();
          beginWave(nextIdx);
          const pod = sitesForWave(nextIdx).find((s) => SPAWN_SITES[s].pod);
          if (nextIdx === WAVE_COUNT) pushDialogue('luke', 'Look at the size of that one!');
          else if (pod) pushDialogue(nextIdx % 2 === 0 ? 'luke' : 'penny', `They're landing ${SPAWN_SITES[pod].label}!`);
        }
      }
    }
  });

  return null;
}
