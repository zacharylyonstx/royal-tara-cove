import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useMunchiesStore, type SleepwalkerId } from '../state/munchiesStore';
import { resolveMotion } from './collision';
import {
  MUNCHIES_GRAPH,
  getNode,
  graphDistance,
  nearestNode,
  SLEEPWALKER_BEDS,
  DOG_HOME_NODE,
} from '../world/munchiesGraph';
import {
  SLEEPWALKER_BASE_SPEED,
  SLEEPWALKER_SPEED_PER_LEVEL,
  POWERED_SPEED_MULT,
  TUCK_RESPAWN_S,
} from '../world/munchiesConfig';

const ARRIVE_EPS = 0.25;
const STUCK_RESCUE_DT = 0.6;
const DOG_SHY_DIST = 6.0;

interface FrameState {
  lastX: Record<SleepwalkerId, number>;
  lastZ: Record<SleepwalkerId, number>;
  lastMovedAt: Record<SleepwalkerId, number>;
}
const frameState: FrameState = {
  lastX:       { dad: 0, penny: 0, dog: 0, schmorgesblob: 0 },
  lastZ:       { dad: 0, penny: 0, dog: 0, schmorgesblob: 0 },
  lastMovedAt: { dad: 0, penny: 0, dog: 0, schmorgesblob: 0 },
};

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

    const lukePos = gs.positions.luke;
    const lukeYaw = gs.yaws.luke;
    const lukeNodeId = nearestNode(lukePos.x, lukePos.z).id;

    const baseSpeed = SLEEPWALKER_BASE_SPEED + (ms.level - 1) * SLEEPWALKER_SPEED_PER_LEVEL;
    const powered = phase === 'munchies-powered';

    const colliders = gs.staticColliders;

    for (const id of ['dad', 'penny', 'dog'] as const) {
      const sw = ms.sleepwalkers[id];
      if (!sw) continue;

      if (sw.mode === 'tucked') {
        if (now - sw.tuckedAt >= TUCK_RESPAWN_S) {
          const bed = getNode(SLEEPWALKER_BEDS[id]);
          sw.x = bed.x;
          sw.z = bed.z;
          sw.yaw = 0;
          sw.targetNodeId = bed.neighbors[0] ?? bed.id;
          sw.lastNodeId = bed.id;
          useMunchiesStore.getState().resumeSleepwalker(id);
        }
        continue;
      }

      if (!sw.targetNodeId) {
        const cur = nearestNode(sw.x, sw.z);
        sw.targetNodeId = pickNextNode(id, cur.id, cur.id, lukeNodeId, lukePos, lukeYaw, powered);
        sw.lastNodeId = cur.id;
      }

      const target = getNode(sw.targetNodeId);
      const dx = target.x - sw.x;
      const dz = target.z - sw.z;
      const dist = Math.hypot(dx, dz);

      if (dist < ARRIVE_EPS) {
        const last = sw.lastNodeId;
        sw.lastNodeId = sw.targetNodeId;
        sw.targetNodeId = pickNextNode(id, sw.targetNodeId, last, lukeNodeId, lukePos, lukeYaw, powered);
        continue;
      }

      const speed = baseSpeed * (powered ? POWERED_SPEED_MULT : 1);
      const ux = dx / dist;
      const uz = dz / dist;
      const desiredX = sw.x + ux * speed * dt;
      const desiredZ = sw.z + uz * speed * dt;

      const resolved = resolveMotion(sw.x, sw.z, desiredX, desiredZ, colliders);

      const moved = Math.hypot(resolved.x - sw.x, resolved.z - sw.z);
      if (moved < 0.005) {
        if (now - frameState.lastMovedAt[id] > STUCK_RESCUE_DT) {
          sw.x = target.x;
          sw.z = target.z;
          frameState.lastMovedAt[id] = now;
          continue;
        }
      } else {
        frameState.lastMovedAt[id] = now;
      }
      sw.x = resolved.x;
      sw.z = resolved.z;
      sw.yaw = Math.atan2(-ux, -uz);
    }
  });

  return null;
}

function pickNextNode(
  id: SleepwalkerId,
  currentId: string,
  lastId: string,
  lukeNodeId: string,
  lukePos: { x: number; z: number },
  lukeYaw: number,
  powered: boolean,
): string {
  const cur = getNode(currentId);
  let candidates = cur.neighbors.filter((nb) => nb !== lastId);
  if (candidates.length === 0) candidates = cur.neighbors.slice();

  if (powered) {
    const homeId = SLEEPWALKER_BEDS[id];
    return pickByMinDistanceToTarget(candidates, homeId);
  }

  if (id === 'dad') {
    return pickByMinDistanceToTarget(candidates, lukeNodeId);
  }
  if (id === 'penny') {
    // Aim 3m ahead of Luke along his yaw. Convention used elsewhere: forward = (-sin(yaw), -cos(yaw)).
    const fx = -Math.sin(lukeYaw);
    const fz = -Math.cos(lukeYaw);
    const aheadX = lukePos.x + fx * 3.0;
    const aheadZ = lukePos.z + fz * 3.0;
    const aheadNode = nearestNode(aheadX, aheadZ);
    return pickByMinDistanceToTarget(candidates, aheadNode.id);
  }
  if (id === 'dog') {
    const distToLuke = Math.hypot(lukePos.x - cur.x, lukePos.z - cur.z);
    if (distToLuke > DOG_SHY_DIST) {
      return pickByMinDistanceToTarget(candidates, lukeNodeId);
    } else {
      return pickByMinDistanceToTarget(candidates, DOG_HOME_NODE);
    }
  }
  return candidates[0];
}

function pickByMinDistanceToTarget(candidates: string[], targetId: string): string {
  let best = candidates[0];
  let bestD = Infinity;
  for (const c of candidates) {
    const d = graphDistance(c, targetId);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Silence "unused export" — MUNCHIES_GRAPH is re-exported for ad-hoc dev access.
void MUNCHIES_GRAPH;
