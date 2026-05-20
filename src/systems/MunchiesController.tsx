import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useMunchiesStore, type SleepwalkerId } from '../state/munchiesStore';
import {
  generatePellets,
  buildMilks,
  BONUS_SPAWN_POS,
} from '../world/munchiesPellets';
import { getNode, SLEEPWALKER_BEDS } from '../world/munchiesGraph';
import {
  CATCH_RADIUS,
  PELLET_PICKUP_RADIUS,
  MILK_PICKUP_RADIUS,
  BONUS_PICKUP_RADIUS,
  BONUS_DESPAWN_S,
  BONUS_FIRST_SPAWN_FRAC,
  BONUS_SECOND_SPAWN_FRAC,
  PLAYER_SPAWN,
  MAX_LEVEL,
  CAUGHT_CINEMATIC_S,
  LEVEL_CLEAR_BANNER_S,
  INTRO_AUTO_DISMISS_S,
} from '../world/munchiesConfig';

const SLEEPWALKER_IDS: SleepwalkerId[] = ['dad', 'penny', 'dog'];

export function MunchiesController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return <MunchiesControllerInner />;
}

function MunchiesControllerInner() {
  const phaseChangeAt = useRef(0);
  const introInputDetected = useRef(false);

  // On mount: set time of day to night and close all doors.
  useEffect(() => {
    useCombatStore.setState({ timeOfDay: 1.0 });
    const gs = useGameStore.getState();
    for (const id of Object.keys(gs.doors)) {
      gs.doors[id].open = false;
    }
    return () => {
      useCombatStore.setState({ timeOfDay: 0.0 });
    };
  }, []);

  // Phase transitions: start level on intro entry; stamp phase-change timestamps.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.phase === 'munchies-intro' && prev.phase !== 'munchies-intro') {
        startLevel(1);
        phaseChangeAt.current = performance.now() / 1000;
        introInputDetected.current = false;
      }
      if (s.phase === 'munchies-level-clear' && prev.phase !== 'munchies-level-clear') {
        phaseChangeAt.current = performance.now() / 1000;
      }
      if (s.phase === 'munchies-caught' && prev.phase !== 'munchies-caught') {
        phaseChangeAt.current = performance.now() / 1000;
      }
      if (s.phase === 'munchies-powered' && prev.phase !== 'munchies-powered') {
        phaseChangeAt.current = performance.now() / 1000;
      }
    });
    // Initial run if we're already in munchies-intro on mount.
    const phaseNow = useGameStore.getState().phase;
    if (phaseNow === 'munchies-intro' && Object.keys(useMunchiesStore.getState().pellets).length === 0) {
      startLevel(1);
      phaseChangeAt.current = performance.now() / 1000;
    }
    return unsub;
  }, []);

  // First WASD press dismisses intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const phase = useGameStore.getState().phase;
      if (phase !== 'munchies-intro') return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        introInputDetected.current = true;
        useGameStore.getState().setPhase('munchies-play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame(() => {
    const gs = useGameStore.getState();
    const phase = gs.phase;
    const now = performance.now() / 1000;
    const ms = useMunchiesStore.getState();
    const luke = gs.positions.luke;

    // Intro auto-dismiss after N seconds.
    if (phase === 'munchies-intro' && now - phaseChangeAt.current > INTRO_AUTO_DISMISS_S) {
      gs.setPhase('munchies-play');
    }

    if (phase === 'munchies-play' || phase === 'munchies-powered') {
      // Pellet pickup
      for (const id in ms.pellets) {
        const p = ms.pellets[id];
        if (Math.hypot(p.x - luke.x, p.z - luke.z) < PELLET_PICKUP_RADIUS) {
          useMunchiesStore.getState().eatPellet(id);
        }
      }
      // Milk pickup
      for (const id in ms.milks) {
        const m = ms.milks[id];
        if (Math.hypot(m.x - luke.x, m.z - luke.z) < MILK_PICKUP_RADIUS) {
          useMunchiesStore.getState().eatMilk(id, now);
          gs.setPhase('munchies-powered');
        }
      }
      // Bonus pickup
      if (ms.bonus && !ms.bonus.eaten) {
        if (Math.hypot(ms.bonus.x - luke.x, ms.bonus.z - luke.z) < BONUS_PICKUP_RADIUS) {
          useMunchiesStore.getState().eatBonus();
          setTimeout(() => useMunchiesStore.getState().clearBonus(), 300);
        } else if (now - ms.bonus.spawnedAt > BONUS_DESPAWN_S) {
          useMunchiesStore.getState().clearBonus();
        }
      }
      // Bonus spawn thresholds
      maybeSpawnBonus(now);

      // Catch / tuck-in detection
      for (const id of SLEEPWALKER_IDS) {
        const sw = ms.sleepwalkers[id];
        if (sw.mode === 'tucked') continue;
        const d = Math.hypot(sw.x - luke.x, sw.z - luke.z);
        if (d < CATCH_RADIUS) {
          if (phase === 'munchies-powered') {
            useMunchiesStore.getState().tuckIn(id, now);
          } else {
            useMunchiesStore.getState().setCaught(id, now);
            gs.setPhase('munchies-caught');
            phaseChangeAt.current = now;
            break;
          }
        }
      }

      // Powered timer expiry
      if (phase === 'munchies-powered' && ms.poweredUntil > 0 && now > ms.poweredUntil) {
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-play');
      }

      // Level clear
      const remaining = Object.keys(ms.pellets).length;
      if (remaining === 0) {
        gs.setPhase('munchies-level-clear');
        phaseChangeAt.current = now;
      }
    }

    if (phase === 'munchies-caught' && now - phaseChangeAt.current > CAUGHT_CINEMATIC_S) {
      useMunchiesStore.getState().loseLife();
      const lives = useMunchiesStore.getState().lives;
      luke.set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
      useMunchiesStore.getState().clearCaught();
      if (lives <= 0) {
        gs.setPhase('munchies-game-over');
      } else {
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-play');
      }
    }

    if (phase === 'munchies-level-clear' && now - phaseChangeAt.current > LEVEL_CLEAR_BANNER_S) {
      const nextLevel = useMunchiesStore.getState().level + 1;
      if (nextLevel > MAX_LEVEL) {
        gs.setPhase('munchies-victory');
      } else {
        startLevel(nextLevel);
        gs.setPhase('munchies-play');
      }
    }
  });

  return null;
}

function startLevel(level: number) {
  const pellets = generatePellets();
  const milks = buildMilks();
  const sleepwalkers = {
    dad:   makeSpawn('dad'),
    penny: makeSpawn('penny'),
    dog:   makeSpawn('dog'),
  };
  useMunchiesStore.getState().setLevelData(level, pellets, milks, sleepwalkers);
  LEVEL_INITIAL_PELLET_COUNT = Object.keys(pellets).length;

  // Teleport Luke to munchies spawn.
  const luke = useGameStore.getState().positions.luke;
  luke.set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
  useGameStore.getState().yaws.luke = Math.PI;
}

function makeSpawn(id: SleepwalkerId) {
  const bed = getNode(SLEEPWALKER_BEDS[id]);
  return {
    id,
    x: bed.x,
    z: bed.z,
    yaw: 0,
    targetNodeId: bed.neighbors[0] ?? bed.id,
    lastNodeId: bed.id,
    mode: 'normal' as const,
    tuckedAt: 0,
  };
}

let LEVEL_INITIAL_PELLET_COUNT = 0;

function maybeSpawnBonus(now: number) {
  const ms = useMunchiesStore.getState();
  if (ms.bonus || ms.bonusSpawnsRemaining <= 0) return;
  if (LEVEL_INITIAL_PELLET_COUNT === 0) return;
  const remaining = Object.keys(ms.pellets).length;
  const frac = remaining / LEVEL_INITIAL_PELLET_COUNT;
  if (ms.bonusSpawnsRemaining === 2 && frac <= BONUS_FIRST_SPAWN_FRAC) {
    ms.spawnBonus(BONUS_SPAWN_POS[0], BONUS_SPAWN_POS[1], now);
  } else if (ms.bonusSpawnsRemaining === 1 && frac <= BONUS_SECOND_SPAWN_FRAC) {
    ms.spawnBonus(BONUS_SPAWN_POS[0], BONUS_SPAWN_POS[1], now);
  }
}
