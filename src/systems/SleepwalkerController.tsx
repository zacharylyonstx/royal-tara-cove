import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useMunchiesStore, type SleepwalkerId } from '../state/munchiesStore';
import {
  WALKER_HOME, cellAt, cellCenter, distanceField, nextWaypoint, wanderCell,
} from '../world/munchiesMap';
import {
  SLEEPWALKER_BASE_SPEED,
  SLEEPWALKER_SPEED_PER_LEVEL,
  POWERED_SPEED_MULT,
  TUCK_RESPAWN_S,
  DIFFICULTY_MULT,
  WALKER_RHYTHM,
  WALKER_REPATH_S,
} from '../world/munchiesConfig';
import { playerSnapshots, type PlayerSnapshot } from '../world/munchiesRoster';

// Sleepwalker AI (host only). Each walker picks a GOAL cell by personality,
// keeps a BFS distance field to it (world/munchiesMap.ts) and shuffles downhill
// with line-of-sight smoothing — so they path around the real walls, furniture
// and fort blocks instead of following a hand-authored node graph.
//
//   dad     — hunts the closest sneaker
//   penny / luke / blob — try to cut you off (aim ahead of where you're going)
//   dog     — runs up to you, then gets shy and trots back to its bed
// All of them alternate hunting with aimless shuffling, and when someone drinks
// the milk they turn around and sleepwalk back to bed.

const DOG_SHY_DIST = 5.0;
const AMBUSH_LEAD = 3.0;
const TURN_RATE = 9;

interface Brain {
  field: Int16Array;
  goal: number;
  repathAt: number;
  /** Offsets each walker's hunt/shuffle rhythm so they don't all switch at once. */
  phaseOffset: number;
  wanderGoal: number;
  wanderUntil: number;
}
const brains = new Map<SleepwalkerId, Brain>();
function brainFor(id: SleepwalkerId, index: number): Brain {
  let b = brains.get(id);
  if (!b) {
    b = { field: distanceField(-1), goal: -1, repathAt: 0, phaseOffset: index * 3.7, wanderGoal: -1, wanderUntil: 0 };
    brains.set(id, b);
  }
  return b;
}

function homeOf(id: SleepwalkerId): { x: number; z: number } {
  return WALKER_HOME[id === 'luke' ? 'penny' : id];
}

export function SleepwalkerController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'munchies') return null;
  return <SleepwalkerControllerInner />;
}

function SleepwalkerControllerInner() {
  useFrame((_, dtRaw) => {
    if (!useNetStore.getState().isHost) return;
    const gs = useGameStore.getState();
    const phase = gs.phase;
    if (phase !== 'munchies-play' && phase !== 'munchies-powered') return;
    const dt = Math.min(dtRaw, 0.1);
    const now = performance.now() / 1000;
    const ms = useMunchiesStore.getState();

    const players = playerSnapshots();
    if (players.length === 0) return;

    const diff = DIFFICULTY_MULT[ms.difficulty].speed;
    const baseSpeed = (SLEEPWALKER_BASE_SPEED + (ms.level - 1) * SLEEPWALKER_SPEED_PER_LEVEL) * diff;
    const powered = phase === 'munchies-powered';
    const rhythm = WALKER_RHYTHM[ms.difficulty];
    const cycle = rhythm.chase + rhythm.wander;

    ms.activeRoster.forEach((id, index) => {
      const sw = ms.sleepwalkers[id];
      if (!sw) return;
      const brain = brainFor(id, index);

      if (sw.mode === 'tucked') {
        // Only walkers that were actually tucked in (tuckedAt > 0) wake back up.
        if (sw.tuckedAt > 0 && now - sw.tuckedAt >= TUCK_RESPAWN_S) {
          const home = homeOf(id);
          sw.x = home.x;
          sw.z = home.z;
          sw.yaw = -Math.PI / 2;
          brain.repathAt = 0;
          useMunchiesStore.getState().resumeSleepwalker(id);
        }
        return;
      }

      const target = closestPlayer(sw, players);
      const hunting = !powered && ((now + brain.phaseOffset) % cycle) < rhythm.chase;

      // --- choose a goal (re-planned a few times a second) ---
      if (now >= brain.repathAt) {
        brain.repathAt = now + WALKER_REPATH_S;
        let goal: number;
        if (powered) {
          const home = homeOf(id);
          goal = cellAt(home.x, home.z);
        } else if (!hunting) {
          if (now >= brain.wanderUntil || brain.wanderGoal < 0 || brain.wanderGoal === cellAt(sw.x, sw.z)) {
            brain.wanderGoal = wanderCell(sw.x, sw.z, now * 0.37 + index * 1.9, 5 + (index % 2) * 2);
            brain.wanderUntil = now + 4;
          }
          goal = brain.wanderGoal;
        } else if (id === 'dad') {
          goal = cellAt(target.x, target.z);
        } else if (id === 'dog') {
          const d = Math.hypot(target.x - sw.x, target.z - sw.z);
          const home = homeOf(id);
          goal = d > DOG_SHY_DIST ? cellAt(target.x, target.z) : cellAt(home.x, home.z);
        } else {
          // Ambush: aim ahead of the sneaker along the way they're facing —
          // but once close, just go for them.
          const d = Math.hypot(target.x - sw.x, target.z - sw.z);
          const lead = d > AMBUSH_LEAD ? AMBUSH_LEAD : 0;
          const fx = -Math.sin(target.yaw), fz = -Math.cos(target.yaw);
          goal = cellAt(target.x + fx * lead, target.z + fz * lead);
        }
        if (goal !== brain.goal) {
          brain.goal = goal;
          distanceField(goal, brain.field);
        }
      }

      // --- move ---
      const speed = baseSpeed * (powered ? POWERED_SPEED_MULT : hunting ? 1 : 0.6);
      let wp = nextWaypoint(brain.field, sw.x, sw.z);
      if (!wp) {
        // In the goal cell. A hunter closes the last half-metre straight at the
        // kid; everyone else settles on the cell centre.
        if (hunting && cellAt(target.x, target.z) === brain.goal) wp = { x: target.x, z: target.z };
        else if (brain.goal >= 0) wp = cellCenter(brain.goal);
      }
      if (!wp) return;
      const dx = wp.x - sw.x;
      const dz = wp.z - sw.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.03) return;
      const step = Math.min(dist, speed * dt);
      sw.x += (dx / dist) * step;
      sw.z += (dz / dist) * step;
      // Turn smoothly toward the direction of travel.
      const want = Math.atan2(-dx, -dz);
      let dy = want - sw.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      sw.yaw += dy * Math.min(1, TURN_RATE * dt);
    });
  });

  return null;
}

function closestPlayer(sw: { x: number; z: number }, players: PlayerSnapshot[]): PlayerSnapshot {
  let best = players[0];
  let bestD = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - sw.x, p.z - sw.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
