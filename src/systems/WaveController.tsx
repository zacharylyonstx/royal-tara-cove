import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import type { BlobKind } from '../state/combatStore';
import { BLOB_SPAWN } from '../components/aliens/UFOCrash';
import { victoryFanfare, stopCrackleLoop, waveAlarm, bossRoar } from '../audio';

const SPAWN_INTERVAL = 0.4;
const INTERMISSION_LEN = 5.0;

export const WAVES: { kind: BlobKind; count: number }[][] = [
  // Wave 1
  [{ kind: 'hopper', count: 6 }],
  // Wave 2
  [
    { kind: 'hopper', count: 4 },
    { kind: 'sprinter', count: 4 },
    { kind: 'splitter', count: 4 },
  ],
  // Wave 3 (boss + minions)
  [
    { kind: 'boss', count: 1 },
    { kind: 'hopper', count: 6 },
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

  const spawnAccum = useRef(0);
  const enteredCombatRef = useRef(false);

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
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1);
    const now = state.clock.elapsedTime;

    // Spawn blobs from the current wave's queue.
    if (waveState === 'spawning') {
      spawnAccum.current += dt;
      if (spawnAccum.current >= SPAWN_INTERVAL) {
        spawnAccum.current = 0;
        const next = blobsToSpawn.find((b) => b.count > 0);
        if (next) {
          const jx = (Math.random() - 0.5) * 3;
          const jz = (Math.random() - 0.5) * 3;
          spawnBlob(next.kind, BLOB_SPAWN[0] + jx, BLOB_SPAWN[1], BLOB_SPAWN[2] + jz);
          consumeBlobToSpawn(next.kind);
          if (next.kind === 'boss') {
            bossRoar();
            pushDialogue('dad', 'That one\'s HUGE.');
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
