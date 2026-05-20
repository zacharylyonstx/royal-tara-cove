// Corridor graph for sleepwalker pathing in Midnight Munchies. Nodes are
// chosen from `floorPlan.ts` doorway centers and room centers so the graph
// stays implicitly in sync with the renderer's wall layout.
//
// Coordinate convention is world-space (hero house is at origin, yaw 0).

import type { SleepwalkerId } from '../state/munchiesStore';

export interface GraphNode {
  id: string;
  x: number;
  z: number;
  neighbors: string[];
}

// Reference: floorPlan.ts rooms
//   great:    x ∈ [-9.0, -1.5], z ∈ [-8.0,  0.0]
//   kitchen:  x ∈ [-1.5,  2.0], z ∈ [-8.0,  0.0]
//   hall:     x ∈ [-9.0,  2.0], z ∈ [ 0.0,  1.5]
//   master:   x ∈ [-9.0, -5.5], z ∈ [ 1.5,  8.0]
//   penny:    x ∈ [-5.5, -2.5], z ∈ [ 1.5,  8.0]
//   bath:     x ∈ [-2.5, -1.0], z ∈ [ 1.5,  8.0]
//   luke:     x ∈ [-1.0,  2.0], z ∈ [ 1.5,  8.0]
//
// floorPlan wall convention: "'x' = wall runs along the X axis (constant Z); 'z' = wall runs along the Z axis (constant X)."
// Doorway openings derived from floorPlan.ts INTERIOR_WALLS:
//   'great-kitchen'    axis='z' at=-1.5, opening z=-3..-2 → doorway at (-1.5, -2.5)
//   'great-hall'       axis='x' at= 0,   opening x=-5..-4 → doorway at (-4.5, 0)
//   'kitchen-hall'     axis='x' at= 0,   opening x=0.5..1.5 → doorway at (1.0, 0)
//   'hall-back-master' axis='x' at= 1.5, opening x=-7.5..-6.5 → doorway at (-7.0, 1.5)
//   'hall-back-penny'  axis='x' at= 1.5, opening x=-4.5..-3.5 → doorway at (-4.0, 1.5)
//   'hall-back-bath'   axis='x' at= 1.5, opening x=-2.0..-1.0 → doorway at (-1.5, 1.5)
//   'hall-back-luke'   axis='x' at= 1.5, opening x=-0.5..0.5  → doorway at ( 0.0, 1.5)

export const MUNCHIES_GRAPH: GraphNode[] = [
  // Great room — multiple nodes so AI can patrol the largest room.
  { id: 'great-center', x: -5.0, z: -4.0, neighbors: ['great-corner-nw', 'great-corner-sw', 'great-kitchen-door', 'great-hall-door'] },
  { id: 'great-corner-nw', x: -8.0, z: -7.0, neighbors: ['great-center'] },
  { id: 'great-corner-sw', x: -8.0, z: -1.0, neighbors: ['great-center'] },

  // Door between great room and kitchen (wall at x=-1.5, z=-2.5)
  { id: 'great-kitchen-door', x: -1.5, z: -2.5, neighbors: ['great-center', 'kitchen-center'] },

  // Kitchen
  { id: 'kitchen-center', x: 0.3, z: -4.0, neighbors: ['great-kitchen-door', 'kitchen-hall-door', 'kitchen-corner-se'] },
  { id: 'kitchen-corner-se', x: 1.5, z: -7.0, neighbors: ['kitchen-center'] },

  // Door from great room to hall (wall at z=0, x=-4.5)
  { id: 'great-hall-door', x: -4.5, z: 0.0, neighbors: ['great-center', 'hall-w'] },

  // Door from kitchen to hall (wall at z=0, x=1.0)
  { id: 'kitchen-hall-door', x: 1.0, z: 0.0, neighbors: ['kitchen-center', 'hall-e'] },

  // Hallway: two nodes that span the spine
  { id: 'hall-w', x: -7.0, z: 0.75, neighbors: ['great-hall-door', 'hall-master-door', 'hall-mid'] },
  { id: 'hall-mid', x: -3.0, z: 0.75, neighbors: ['hall-w', 'hall-e', 'hall-penny-door'] },
  { id: 'hall-e', x: 0.5, z: 0.75, neighbors: ['hall-mid', 'kitchen-hall-door', 'hall-bath-door', 'hall-luke-door'] },

  // Bedroom doors (at z = 1.5)
  { id: 'hall-master-door', x: -7.0, z: 1.5, neighbors: ['hall-w', 'master-bed'] },
  { id: 'hall-penny-door',  x: -4.0, z: 1.5, neighbors: ['hall-mid', 'penny-bed'] },
  { id: 'hall-bath-door',   x: -1.5, z: 1.5, neighbors: ['hall-e', 'bath-center'] },
  { id: 'hall-luke-door',   x:  0.0, z: 1.5, neighbors: ['hall-e', 'luke-bed'] },

  // Bedrooms (room-center positions; double as ghost bed nodes)
  { id: 'master-bed',  x: -7.25, z: 5.0,  neighbors: ['hall-master-door'] },
  { id: 'penny-bed',   x: -4.0,  z: 5.0,  neighbors: ['hall-penny-door'] },
  { id: 'bath-center', x: -1.75, z: 5.0,  neighbors: ['hall-bath-door'] },
  { id: 'luke-bed',    x:  0.5,  z: 5.0,  neighbors: ['hall-luke-door'] },
];

const NODE_BY_ID: Record<string, GraphNode> = {};
for (const n of MUNCHIES_GRAPH) NODE_BY_ID[n.id] = n;

export function getNode(id: string): GraphNode {
  const n = NODE_BY_ID[id];
  if (!n) throw new Error(`munchiesGraph: unknown node "${id}"`);
  return n;
}

/** Bed node id each sleepwalker sleeps in / respawns from. */
export const SLEEPWALKER_BEDS: Record<SleepwalkerId, string> = {
  dad: 'master-bed',
  penny: 'penny-bed',
  dog: 'kitchen-center',   // dog bed is in the kitchen near the pantry
  schmorgesblob: 'master-bed', // crashed in Dad's room; shares his bed area
};

/** Shy-mode home node for the dog (Clyde-like behavior). */
export const DOG_HOME_NODE = 'kitchen-center';

/** Find nearest graph node to a given world position. */
export function nearestNode(x: number, z: number): GraphNode {
  let best = MUNCHIES_GRAPH[0];
  let bestD = Infinity;
  for (const n of MUNCHIES_GRAPH) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

/** BFS distance (in graph edges) from a node to a target node. Used by sleepwalker AI. */
export function graphDistance(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const visited = new Set<string>([fromId]);
  const queue: { id: string; d: number }[] = [{ id: fromId, d: 0 }];
  while (queue.length) {
    const { id, d } = queue.shift()!;
    for (const nid of getNode(id).neighbors) {
      if (nid === toId) return d + 1;
      if (visited.has(nid)) continue;
      visited.add(nid);
      queue.push({ id: nid, d: d + 1 });
    }
  }
  return Infinity;
}

// Self-check on module load: every neighbor reference must resolve.
function validate() {
  for (const n of MUNCHIES_GRAPH) {
    for (const nb of n.neighbors) {
      if (!NODE_BY_ID[nb]) throw new Error(`munchiesGraph: node "${n.id}" → unknown neighbor "${nb}"`);
    }
  }
}
validate();
