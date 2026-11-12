import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, type GamePhase } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import {
  useMunchiesStore, SLEEPWALKER_IDS,
  type PelletPosition, type SleepwalkerId, type SleepwalkerState,
} from '../state/munchiesStore';
import {
  munchiesCrunch, munchiesGlug, munchiesShh,
  munchiesPowerUp, munchiesTuckIn, munchiesLevelClear, munchiesVictoryFanfare,
  startMunchiesLullaby, stopMunchiesLullaby,
} from '../audio';
import {
  MUNCHIES_PELLETS, MUNCHIES_MILKS, MUNCHIES_BONUS_POS,
  MUNCHIES_SPAWN, MUNCHIES_SPAWN_YAW, WALKER_HOME,
} from '../world/munchiesMap';
import { worldToHero } from '../world/heroPlace';
import {
  CATCH_RADIUS,
  PELLET_PICKUP_RADIUS,
  MILK_PICKUP_RADIUS,
  BONUS_PICKUP_RADIUS,
  BONUS_DESPAWN_S,
  BONUS_FIRST_SPAWN_FRAC,
  BONUS_SECOND_SPAWN_FRAC,
  MAX_LEVEL,
  CAUGHT_CINEMATIC_S,
  LEVEL_CLEAR_BANNER_S,
  INTRO_AUTO_DISMISS_S,
  CHARACTER_STATS,
  DIFFICULTY_MULT,
  SIBLING_BOND_DIST,
  SIBLING_BOND_MULT,
  COOKIE_POINTS,
  RESPAWN_GRACE_S,
  type PlayableCharacter,
} from '../world/munchiesConfig';
import { ghostRosterFor, activePlayers } from '../world/munchiesRoster';
import { saveBestScore } from '../world/munchiesScoreStorage';
import { requestMunchies } from '../net/room';
import type { CharacterId } from '../types';

export function MunchiesController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return <MunchiesControllerInner />;
}

function MunchiesControllerInner() {
  // When the CURRENT phase began (perf seconds). Tracked from the frame loop —
  // not a store subscription — so it is also correct for a guest who becomes
  // host mid-phase (a subscription-stamped ref stayed at Infinity there and the
  // "caught" cinematic never ended).
  const phaseChangeAt = useRef(0);
  const lastPhase = useRef<GamePhase | null>(null);
  // Per-CLIENT bookkeeping for "put my own character back at the start".
  const myLastPhase = useRef<GamePhase | null>(null);
  const myLastLevel = useRef(0);

  // On mount: night-time, all doors shut (they're part of the maze walls).
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

  // Any movement key starts the game from the intro card (the on-screen Start
  // button covers mouse + touch; guests' presses are relayed to the host).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGameStore.getState().phase !== 'munchies-intro') return;
      if (useGameStore.getState().welcomeOpen) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' '].includes(k)) {
        requestMunchies('start');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Guests don't run the simulation, so they'd play in silence — derive the
  // sound effects from the synced state instead.
  useEffect(() => {
    const unsubMunchies = useMunchiesStore.subscribe((s, prev) => {
      if (useNetStore.getState().isHost) return;
      const np = Object.keys(s.pellets).length, pp = Object.keys(prev.pellets).length;
      if (np < pp && pp - np < 20) munchiesCrunch();
      if (Object.keys(s.milks).length < Object.keys(prev.milks).length) { munchiesGlug(); munchiesPowerUp(); }
      if (s.sleepwalkers !== prev.sleepwalkers) {
        for (const id of s.activeRoster) {
          if (s.sleepwalkers[id]?.mode === 'tucked' && prev.sleepwalkers[id]?.mode === 'normal' && prev.activeRoster.includes(id)) {
            munchiesTuckIn();
            break;
          }
        }
      }
    });
    const unsubGame = useGameStore.subscribe((s, prev) => {
      if (useNetStore.getState().isHost || s.phase === prev.phase) return;
      if (s.phase === 'munchies-caught') munchiesShh();
      else if (s.phase === 'munchies-level-clear') munchiesLevelClear();
      else if (s.phase === 'munchies-victory') munchiesVictoryFanfare();
    });
    return () => { unsubMunchies(); unsubGame(); };
  }, []);

  useFrame(() => {
    const gs = useGameStore.getState();
    const now = performance.now() / 1000;

    // --- Every client: teleport MY OWN character on resets ---
    // Positions are client-authoritative (each player simulates themselves), so
    // the host can't move a guest: when the host "sent everyone back to the
    // door" after a catch, a guest's own client instantly overwrote it and the
    // kid stayed standing next to the sleepwalker that just caught them.
    {
      const me = useNetStore.getState().myCharacterId ?? gs.activeCharacterId;
      const players = activePlayers();
      const slot = players.indexOf(me);
      const level = useMunchiesStore.getState().level;
      const ph = gs.phase;
      if (slot >= 0 && !gs.welcomeOpen) {
        const pos = gs.positions[me];
        const l = worldToHero(pos.x, pos.z);
        const outside = Math.abs(l.x) > 12 || Math.abs(l.z) > 9;
        const reset =
          (ph === 'munchies-intro' && myLastPhase.current !== 'munchies-intro') ||
          (myLastPhase.current === 'munchies-caught' && ph !== 'munchies-caught') ||
          (level !== myLastLevel.current) ||
          (outside && ph.startsWith('munchies-'));
        if (reset) {
          // Side by side just inside the front door (never stacked on one spot).
          pos.set(MUNCHIES_SPAWN.x - slot * 0.9, 0, MUNCHIES_SPAWN.z);
          gs.yaws[me] = MUNCHIES_SPAWN_YAW;
        }
      }
      myLastPhase.current = ph;
      myLastLevel.current = level;
    }

    if (!useNetStore.getState().isHost) { lastPhase.current = null; return; }

    // --- "Start" / "Play again" requests (from any player) ---
    const req = useMunchiesStore.getState().pendingRequest;
    if (req) {
      useMunchiesStore.getState().setPendingRequest(null);
      if (req === 'start' && gs.phase === 'munchies-intro') {
        gs.setPhase('munchies-play');
      } else if (req === 'again' && (gs.phase === 'munchies-game-over' || gs.phase === 'munchies-victory')) {
        useMunchiesStore.getState().reset();
        gs.setPhase('munchies-intro');
      }
    }

    const phase = useGameStore.getState().phase;
    if (phase !== lastPhase.current) {
      lastPhase.current = phase;
      phaseChangeAt.current = now;
      // (Re)deal the maze whenever the intro card comes up.
      if (phase === 'munchies-intro') startLevel(1);
    }
    const ms = useMunchiesStore.getState();

    // Intro auto-dismiss after N seconds.
    if (phase === 'munchies-intro' && now - phaseChangeAt.current > INTRO_AUTO_DISMISS_S) {
      gs.setPhase('munchies-play');
    }

    if (phase === 'munchies-play' || phase === 'munchies-powered') {
      const players = activePlayers();
      if (players.length === 0) return;
      syncRoster(players);

      let caught = false;
      for (const pid of players) {
        const pl = gs.positions[pid];
        const stats = CHARACTER_STATS[pid as PlayableCharacter];

        // Sibling bond: in co-op, cookies are worth more while you stick together.
        let bondActive = false;
        for (const other of players) {
          if (other === pid) continue;
          const o = gs.positions[other];
          if (Math.hypot(pl.x - o.x, pl.z - o.z) < SIBLING_BOND_DIST) { bondActive = true; break; }
        }

        // Pellet pickup
        for (const id in ms.pellets) {
          const p = ms.pellets[id];
          if (Math.hypot(p.x - pl.x, p.z - pl.z) < PELLET_PICKUP_RADIUS) {
            useMunchiesStore.getState().eatPellet(id);
            if (bondActive) {
              useMunchiesStore.getState().addScore(Math.round(COOKIE_POINTS * (SIBLING_BOND_MULT - 1)));
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
        const bonus = useMunchiesStore.getState().bonus;
        if (bonus && !bonus.eaten) {
          if (Math.hypot(bonus.x - pl.x, bonus.z - pl.z) < BONUS_PICKUP_RADIUS) {
            useMunchiesStore.getState().eatBonus();
            munchiesPowerUp();
            setTimeout(() => useMunchiesStore.getState().clearBonus(), 300);
          } else if (now - bonus.spawnedAt > BONUS_DESPAWN_S) {
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
        for (const id of useMunchiesStore.getState().activeRoster) {
          const sw = useMunchiesStore.getState().sleepwalkers[id];
          if (!sw || sw.mode === 'tucked') continue;
          const d = Math.hypot(sw.x - pl.x, sw.z - pl.z);
          if (d < catchR) {
            if (powered) {
              useMunchiesStore.getState().tuckIn(id, now);
              munchiesTuckIn();
            } else if (now > invincibleUntil) {
              useMunchiesStore.getState().setCaught(id, now);
              gs.setPhase('munchies-caught');
              munchiesShh();
              caught = true;
              break;
            }
          }
        }
        if (caught) break;
      }
      if (caught) return;

      maybeSpawnBonus(now);

      // Powered timer expiry — read poweredUntil live so a same-frame re-grab
      // that extends the window isn't expired against a stale snapshot.
      const livePoweredUntil = useMunchiesStore.getState().poweredUntil;
      if (useGameStore.getState().phase === 'munchies-powered' && livePoweredUntil > 0 && now > livePoweredUntil) {
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-play');
      }

      // Level clear — read pellets live so clearing the final pellet this frame
      // is detected immediately rather than one frame late.
      if (Object.keys(useMunchiesStore.getState().pellets).length === 0) {
        useMunchiesStore.getState().endPowered();
        gs.setPhase('munchies-level-clear');
        munchiesLevelClear();
      }
    }

    if (phase === 'munchies-caught' && now - phaseChangeAt.current > CAUGHT_CINEMATIC_S) {
      useMunchiesStore.getState().loseLife();
      const lives = useMunchiesStore.getState().lives;
      // Classic reset: everyone back to their corners, so nobody respawns
      // straight into the arms of the sleepwalker who just caught them. (Each
      // client moves its own player — see the top of this loop.)
      sendWalkersHome();
      useMunchiesStore.getState().clearCaught();
      if (lives <= 0) {
        saveAllBestScores();
        gs.setPhase('munchies-game-over');
      } else {
        useMunchiesStore.getState().endPowered();
        useMunchiesStore.getState().setInvincibleUntil(now + RESPAWN_GRACE_S);
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
        useMunchiesStore.getState().setInvincibleUntil(now + RESPAWN_GRACE_S);
        gs.setPhase('munchies-play');
      }
    }
  });

  return null;
}

function spawnWalker(id: SleepwalkerId, active: boolean): SleepwalkerState {
  const home = WALKER_HOME[id === 'luke' ? 'penny' : id];
  // Luke shares the kids' side of the den; nudge him so he and Penny (when both
  // sleepwalk) don't start stacked on the same spot.
  const dz = id === 'luke' ? 1.0 : 0;
  return { id, x: home.x, z: home.z + dz, yaw: -Math.PI / 2, mode: active ? 'normal' : 'tucked', tuckedAt: 0 };
}

function startLevel(level: number) {
  const pellets: Record<string, PelletPosition> = {};
  for (const p of MUNCHIES_PELLETS) pellets[p.id] = p;
  const milks: Record<string, PelletPosition> = {};
  for (const m of MUNCHIES_MILKS) milks[m.id] = m;

  const players = activePlayers();
  const roster = ghostRosterFor(players);
  useMunchiesStore.getState().setActiveRoster(roster);

  // Spawn objects for ALL possible sleepwalkers; the ones not in tonight's
  // roster stay 'tucked' (hidden — see Sleepwalker.tsx) with tuckedAt 0 so the
  // controller never wakes them.
  const sleepwalkers = {} as Record<SleepwalkerId, SleepwalkerState>;
  for (const id of SLEEPWALKER_IDS) sleepwalkers[id] = spawnWalker(id, roster.includes(id));
  useMunchiesStore.getState().setLevelData(level, pellets, milks, sleepwalkers);
}

/** A kid joined (or left) mid-level: whoever is now PLAYING stops sleepwalking,
 *  and the roster is topped back up. */
function syncRoster(players: CharacterId[]) {
  const ms = useMunchiesStore.getState();
  const want = ghostRosterFor(players);
  const have = ms.activeRoster;
  if (want.length === have.length && want.every((id, i) => id === have[i])) return;
  const sleepwalkers = { ...ms.sleepwalkers };
  for (const id of SLEEPWALKER_IDS) {
    const wasActive = have.includes(id);
    const isActive = want.includes(id);
    if (isActive && !wasActive) sleepwalkers[id] = spawnWalker(id, true);
    else if (!isActive && wasActive) sleepwalkers[id] = { ...sleepwalkers[id], mode: 'tucked', tuckedAt: 0 };
  }
  useMunchiesStore.setState({ activeRoster: want, sleepwalkers });
}

function sendWalkersHome() {
  const ms = useMunchiesStore.getState();
  const sleepwalkers = { ...ms.sleepwalkers };
  for (const id of ms.activeRoster) sleepwalkers[id] = spawnWalker(id, true);
  useMunchiesStore.setState({ sleepwalkers });
}

function saveAllBestScores() {
  const ms = useMunchiesStore.getState();
  for (const id of activePlayers()) saveBestScore(id, ms.score);
}

function maybeSpawnBonus(now: number) {
  const ms = useMunchiesStore.getState();
  if (ms.bonus || ms.bonusSpawnsRemaining <= 0) return;
  const total = MUNCHIES_PELLETS.length;
  if (total === 0) return;
  const frac = Object.keys(ms.pellets).length / total;
  if (ms.bonusSpawnsRemaining === 2 && frac <= BONUS_FIRST_SPAWN_FRAC) {
    ms.spawnBonus(MUNCHIES_BONUS_POS.x, MUNCHIES_BONUS_POS.z, now);
  } else if (ms.bonusSpawnsRemaining === 1 && frac <= BONUS_SECOND_SPAWN_FRAC) {
    ms.spawnBonus(MUNCHIES_BONUS_POS.x, MUNCHIES_BONUS_POS.z, now);
  }
}
