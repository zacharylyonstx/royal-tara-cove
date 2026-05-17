import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import type { BlobKind } from '../state/combatStore';
import { BLOB_SPAWN } from '../components/aliens/UFOCrash';
import { victoryFanfare, stopCrackleLoop, waveAlarm, bossRoar } from '../audio';

const SPAWN_INTERVAL = 0.55;
const INTERMISSION_LEN = 5.0;
const CINEMATIC_DURATION = 2.0;

export const WAVES: { kind: BlobKind; count: number }[][] = [
  // Wave 1 — easier intro
  [{ kind: 'hopper', count: 4 }],
  // Wave 2 — variety, slightly harder
  [
    { kind: 'hopper', count: 2 },
    { kind: 'sprinter', count: 2 },
    { kind: 'splitter', count: 2 },
  ],
  // Wave 3 — boss + minions
  [
    { kind: 'boss', count: 1 },
    { kind: 'hopper', count: 4 },
  ],
];

/**
 * Owns the wave state machine. When the player enters combat, runs:
 *   spawning(N) → fighting → cleared → intermission(5s) → next wave
 * Until all waves are cleared, then victory.
 */
export function WaveController() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const blobs = useCombatStore((s) => s.blobs);
  const blobsToSpawn = useCombatStore((s) => s.blobsToSpawn);
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
  const startCinematic = useCombatStore((s) => s.startCinematic);
  const endCinematic = useCombatStore((s) => s.endCinematic);
  const cinematic = useCombatStore((s) => s.cinematic);
  const spawnDebris = useCombatStore((s) => s.spawnDebris);
  const addShake = useCombatStore((s) => s.addShake);

  const spawnAccum = useRef(0);
  const enteredCombatRef = useRef(false);
  const cinematicTriggeredFor = useRef<number>(-1);

  // When combat begins for the first time, kick off Wave 1.
  useEffect(() => {
    if (phase === 'combat' && !enteredCombatRef.current) {
      enteredCombatRef.current = true;
      startGame();
      setWave(1, WAVES[0]);
      pushDialogue('dad', 'Time to test the ray gun.');
    }
    if (phase === 'intro') {
      enteredCombatRef.current = false;
    }
  }, [phase, setWave, startGame, pushDialogue]);

  useFrame((state, dtRaw) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1);
    const now = state.clock.elapsedTime;

    // Trigger spawn cinematic the first time we enter spawning for this wave.
    // Camera high above & slightly south of the portal looking down at the
    // backyard — sees the portal beam, the back of the hero house, and the
    // path the blobs will take toward the cul-de-sac.
    if (waveState === 'spawning' && cinematicTriggeredFor.current !== waveIndex) {
      cinematicTriggeredFor.current = waveIndex;
      startCinematic(
        [BLOB_SPAWN[0], BLOB_SPAWN[1] + 2, BLOB_SPAWN[2]],
        [BLOB_SPAWN[0] + 8, 32, BLOB_SPAWN[2] - 12], // up high, slightly south & east
        CINEMATIC_DURATION,
      );
    }
    // While cinematic is active, pause spawning. End cinematic after duration.
    if (cinematic.active) {
      if (now > cinematic.endsAt) endCinematic();
      return;
    }

    // Spawn blobs from the current wave's queue.
    if (waveState === 'spawning') {
      spawnAccum.current += dt;
      if (spawnAccum.current >= SPAWN_INTERVAL) {
        spawnAccum.current = 0;
        const next = blobsToSpawn.find((b) => b.count > 0);
        if (next) {
          // Wider scatter so blobs don't stack on top of each other.
          const ang = Math.random() * Math.PI * 2;
          const r = 2 + Math.random() * 4;
          const jx = Math.cos(ang) * r;
          const jz = Math.sin(ang) * r;
          spawnBlob(next.kind, BLOB_SPAWN[0] + jx, BLOB_SPAWN[1], BLOB_SPAWN[2] + jz);
          consumeBlobToSpawn(next.kind);
          if (next.kind === 'boss') {
            bossRoar();
            pushDialogue('dad', 'That one\'s HUGE.');
            // Boss "smashes through the back fence" — spawn debris burst + shake
            spawnDebris(BLOB_SPAWN[0], 0.5, BLOB_SPAWN[2] + 4, 18);
            addShake(0.6);
          }
        } else {
          // Done spawning
          setWaveState('fighting');
        }
      }
    } else if (waveState === 'fighting') {
      const aliveCount = blobs.filter((b) => b.alive).length;
      if (aliveCount === 0 && blobsToSpawn.length === 0) {
        setWaveState('cleared');
        if (waveIndex >= WAVES.length) {
          // Victory
          setPhase('victory');
          stopCrackleLoop();
          victoryFanfare();
          pushDialogue('dad', 'Earth defended!');
        } else {
          setIntermissionEnd(now + INTERMISSION_LEN);
          setWaveState('intermission');
          if (waveIndex === 1) pushDialogue('penny', 'We got \'em!');
        }
      }
    } else if (waveState === 'intermission') {
      if (now >= intermissionEndsAt) {
        // Next wave
        const nextIdx = waveIndex + 1;
        if (nextIdx > WAVES.length) {
          setPhase('victory');
          stopCrackleLoop();
          victoryFanfare();
        } else {
          waveAlarm();
          setWave(nextIdx, WAVES[nextIdx - 1]);
          if (nextIdx === 2) pushDialogue('luke', 'More are coming!');
          if (nextIdx === 3) pushDialogue('luke', 'Look at the size of that one!');
        }
      }
    }
  });

  return null;
}
