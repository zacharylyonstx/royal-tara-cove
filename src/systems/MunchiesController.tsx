import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import { useMunchiesStore, type SleepwalkerId, type SleepwalkerState } from '../state/munchiesStore';
import {
  generatePellets,
  buildMilks,
  BONUS_SPAWN_POS,
} from '../world/munchiesPellets';
import {
  munchiesCrunch, munchiesGlug, munchiesShh,
  munchiesPowerUp, munchiesTuckIn, munchiesLevelClear, munchiesVictoryFanfare,
  startMunchiesLullaby, stopMunchiesLullaby,
} from '../audio';
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
  CHARACTER_STATS,
  DIFFICULTY_MULT,
  SIBLING_BOND_DIST,
  SIBLING_BOND_MULT,
  type PlayableCharacter,
} from '../world/munchiesConfig';
import { ghostRosterFor, activePlayers } from '../world/munchiesRoster';
import { saveBestScore } from '../world/munchiesScoreStorage';


export function MunchiesController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return <MunchiesControllerInner />;
}

function MunchiesControllerInner() {
  // Initialize to Infinity so timer checks (now - phaseChangeAt > threshold) never
  // fire spuriously on the first frame before a real timestamp is stamped.
  const phaseChangeAt = useRef(Infinity);
  const introInputDetected = useRef(false);

  // On mount: set time of day to night and close all doors.
  useEffect(() => {
    useCombatStore.setState({ timeOfDay: 1.0 });
    startMunchiesLullaby();
    const gs = useGameStore.getState();
    for (const id of Object.keys(gs.doors)) {
      gs.doors[id].open = false;
    }
    return () => {
      useCombatStore.setState({ timeOfDay: 0.0 });
      stopMunchiesLullaby();
    };
  }, []);

  // Phase transitions: start level on intro entry; stamp phase-change timestamps.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s, prev) => {
      const isHost = useNetStore.getState().isHost;
      if (s.phase === 'munchies-intro' && prev.phase !== 'munchies-intro') {
        if (isHost) startLevel(1);
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
    const isHost = useNetStore.getState().isHost;
    if (isHost && phaseNow === 'munchies-intro' && Object.keys(useMunchiesStore.getState().pellets).length === 0) {
      startLevel(1);
      phaseChangeAt.current = performance.now() / 1000;
    }
    return unsub;
  }, []);

  // First WASD press dismisses intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useNetStore.getState().isHost) return;
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
    if (!useNetStore.getState().isHost) return;
    const gs = useGameStore.getState();
    const phase = gs.phase;
    const now = performance.now() / 1000;
    const ms = useMunchiesStore.getState();

    // Intro auto-dismiss after N seconds.
    if (phase === 'munchies-intro' && now - phaseChangeAt.current > INTRO_AUTO_DISMISS_S) {
      gs.setPhase('munchies-play');
    }

    if (phase === 'munchies-play' || phase === 'munchies-powered') {
      const players = activePlayers();
      if (players.length === 0) return;

      for (const pid of players) {
        const pl = gs.positions[pid];
        const stats = CHARACTER_STATS[pid as PlayableCharacter];

        // Sibling bond: only in co-op when both players are within bond distance.
        let siblingBonusActive = false;
        if (players.length === 2) {
          const otherId = players.find((p) => p !== pid)!;
          const other = gs.positions[otherId];
          if (Math.hypot(pl.x - other.x, pl.z - other.z) < SIBLING_BOND_DIST) {
            siblingBonusActive = true;
          }
        }

        // Pellet pickup
        for (const id in ms.pellets) {
          const p = ms.pellets[id];
          if (Math.hypot(p.x - pl.x, p.z - pl.z) < PELLET_PICKUP_RADIUS) {
            useMunchiesStore.getState().eatPellet(id);
            if (siblingBonusActive) {
              useMunchiesStore.getState().addScore(Math.round(10 * (SIBLING_BOND_MULT - 1)));
            }
            munchiesCrunch();
          }
        }

        // Milk pickup — per-character + difficulty-multiplied powered window.
        for (const id in ms.milks) {
          const m = ms.milks[id];
          if (Math.hypot(m.x - pl.x, m.z - pl.z) < MILK_PICKUP_RADIUS) {
            useMunchiesStore.getState().eatMilk(id, now);
            const charDur = stats?.poweredDurationS ?? 8.0;
            const diffMult = DIFFICULTY_MULT[ms.difficulty].poweredMult;
            useMunchiesStore.setState({ poweredUntil: now + charDur * diffMult });
            gs.setPhase('munchies-powered');
            munchiesGlug();
            munchiesPowerUp();
          }
        }

        // Bonus pickup
        if (ms.bonus && !ms.bonus.eaten) {
          if (Math.hypot(ms.bonus.x - pl.x, ms.bonus.z - pl.z) < BONUS_PICKUP_RADIUS) {
            useMunchiesStore.getState().eatBonus();
            setTimeout(() => useMunchiesStore.getState().clearBonus(), 300);
          } else if (now - ms.bonus.spawnedAt > BONUS_DESPAWN_S) {
            useMunchiesStore.getState().clearBonus();
          }
        }

        // Catch / tuck-in detection — per-character catch radius, iterate roster.
        const catchR = stats?.catchRadius ?? CATCH_RADIUS;
        const invincibleUntil = ms.invincibleUntil;
        // Read powered state LIVE (not from the frame-start `phase`/`ms` snapshot):
        // if this player grabbed milk earlier this same frame, poweredUntil was
        // just bumped into the future — so contacting a sleepwalker now must tuck
        // them in, not get the player caught (which would cost a life unfairly).
        const powered = useMunchiesStore.getState().poweredUntil > now;
        for (const id of ms.activeRoster) {
          const sw = ms.sleepwalkers[id];
          if (!sw || sw.mode === 'tucked') continue;
          const d = Math.hypot(sw.x - pl.x, sw.z - pl.z);
          if (d < catchR) {
            if (powered) {
              useMunchiesStore.getState().tuckIn(id, now);
              munchiesTuckIn();
            } else if (now > invincibleUntil) {
              useMunchiesStore.getState().setCaught(id, now);
              gs.setPhase('munchies-caught');
              phaseChangeAt.current = now;
              munchiesShh();
              break;
            }
          }
        }
      }

      maybeSpawnBonus(now);

      // Powered timer expiry — read poweredUntil live so a same-frame re-grab
      // that extends the window isn't expired against a stale snapshot.
      const livePoweredUntil = useMunchiesStore.getState().poweredUntil;
      if (phase === 'munchies-powered' && livePoweredUntil > 0 && now > livePoweredUntil) {
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-play');
      }

      // Level clear — read pellets live so clearing the final pellet this frame
      // is detected immediately rather than one frame late.
      if (Object.keys(useMunchiesStore.getState().pellets).length === 0) {
        gs.setPhase('munchies-level-clear');
        munchiesLevelClear();
        phaseChangeAt.current = now;
      }
    }

    if (phase === 'munchies-caught' && now - phaseChangeAt.current > CAUGHT_CINEMATIC_S) {
      useMunchiesStore.getState().loseLife();
      const lives = useMunchiesStore.getState().lives;
      const players = activePlayers();
      for (const pid of players) {
        gs.positions[pid].set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
      }
      useMunchiesStore.getState().clearCaught();
      if (lives <= 0) {
        saveAllBestScores();
        gs.setPhase('munchies-game-over');
      } else {
        useMunchiesStore.getState().endPowered();
        useMunchiesStore.getState().setInvincibleUntil(now + 2.0);
        gs.setPhase('munchies-play');
      }
    }

    if (phase === 'munchies-level-clear' && now - phaseChangeAt.current > LEVEL_CLEAR_BANNER_S) {
      const nextLevel = useMunchiesStore.getState().level + 1;
      if (nextLevel > MAX_LEVEL) {
        saveAllBestScores();
        gs.setPhase('munchies-victory');
        munchiesVictoryFanfare();
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
  // Compute roster from currently-claimed players.
  const players = activePlayers();
  const roster = ghostRosterFor(players);
  useMunchiesStore.getState().setActiveRoster(roster);

  // Build spawn objects for ALL possible sleepwalkers, mark inactive ones as 'tucked'
  // so the renderer hides them (visibility check in Sleepwalker.tsx).
  const sleepwalkers: Record<SleepwalkerId, SleepwalkerState> = {
    dad:           makeSpawn('dad'),
    penny:         makeSpawn('penny'),
    dog:           makeSpawn('dog'),
    schmorgesblob: makeSpawn('schmorgesblob'),
  };
  for (const id of (['dad', 'penny', 'dog', 'schmorgesblob'] as const)) {
    if (!roster.includes(id)) sleepwalkers[id].mode = 'tucked';
  }
  useMunchiesStore.getState().setLevelData(level, pellets, milks, sleepwalkers);
  LEVEL_INITIAL_PELLET_COUNT = Object.keys(pellets).length;

  // Teleport every active player to the munchies spawn.
  const gs = useGameStore.getState();
  for (const id of players) {
    gs.positions[id].set(PLAYER_SPAWN[0], 0, PLAYER_SPAWN[1]);
    gs.yaws[id] = Math.PI;
  }
}

function saveAllBestScores() {
  const ms = useMunchiesStore.getState();
  for (const id of activePlayers()) {
    if (id === 'luke' || id === 'penny') saveBestScore(id, ms.score);
  }
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
