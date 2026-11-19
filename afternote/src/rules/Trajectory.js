// Kite's motion relative to the route centerline, as a pure function of beat.
//
// The route itself (where the centerline is in the world) is a view concern. Here Kite
// only has a lateral offset x and a height y, both driven by a list of segments that
// the MovementRunner appends as notes are played. An Echo replays the same list.

import { LANES } from '../core/Constants.js';

export function laneXY(lane) {
  return { x: LANES.X[lane], y: LANES.Y[lane] };
}

const smooth = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);

function segXY(seg, beat) {
  const u = clamp01((beat - seg.t0) / (seg.t1 - seg.t0));
  const s = smooth(u);
  const x = seg.x0 + (seg.x1 - seg.x0) * s;
  if (seg.kind === 'glide') {
    return { x, y: seg.y0 + (seg.y1 - seg.y0) * s, u };
  }
  const y = seg.y0 + (seg.y1 - seg.y0) * u + seg.arc * 4 * u * (1 - u);
  return { x, y, u };
}

/**
 * Where Kite is at `beat`.
 * @returns {{x:number,y:number,air:boolean,u:number,kind:string|null,seg:object|null}}
 */
export function evalSegs(segs, startLane, beat) {
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    if (seg.t0 <= beat) {
      if (beat >= seg.t1) return { x: seg.x1, y: seg.y1, air: false, u: 1, kind: null, seg };
      const p = segXY(seg, beat);
      return { x: p.x, y: p.y, air: seg.kind !== 'glide', u: p.u, kind: seg.kind, seg };
    }
  }
  const base = laneXY(startLane);
  return { x: base.x, y: base.y, air: false, u: 1, kind: null, seg: null };
}

/** The surface position of a piece at a beat (breath currents drift between lanes). */
export function pieceXYAt(piece, beat) {
  if (piece.kind === 'breath') {
    const u = piece.g1 > piece.g0 ? clamp01((beat - piece.g0) / (piece.g1 - piece.g0)) : 1;
    const s = smooth(u);
    return { x: piece.x0 + (piece.x1 - piece.x0) * s, y: piece.y0 + (piece.y1 - piece.y0) * s };
  }
  return laneXY(piece.lane);
}

const EPS = 0.06;

/** The piece under Kite at `beat`, or null. Airborne Kite has no support by definition. */
export function supportAt(pieces, segs, startLane, beat) {
  const k = evalSegs(segs, startLane, beat);
  if (k.air) return null;
  for (let i = pieces.length - 1; i >= 0; i--) {
    const pc = pieces[i];
    if (beat < pc.b0 - 1e-6 || beat > pc.b1 + 1e-6) continue;
    const p = pieceXYAt(pc, beat);
    if (Math.abs(p.x - k.x) < EPS && Math.abs(p.y - k.y) < EPS) return pc;
  }
  return null;
}

/**
 * Kite's state for animation: position plus a pose name.
 * Poses: leap, glide, run, stumble (onto a rescue step), wobble (a hold let go early).
 */
export function kiteStateAt(pieces, segs, startLane, beat) {
  const k = evalSegs(segs, startLane, beat);
  let pose = 'run';
  let piece = null;
  if (k.air) {
    pose = 'leap';
  } else {
    piece = supportAt(pieces, segs, startLane, beat);
    if (piece) {
      if (piece.kind === 'bridge' || piece.kind === 'breath') pose = 'glide';
      else if (piece.kind === 'rescue' && beat - piece.b0 < 0.9) pose = 'stumble';
      else if (piece.kind === 'ledge' && beat - piece.b0 < 1.2) pose = 'wobble';
    }
  }
  return { x: k.x, y: k.y, air: k.air, u: k.u, pose, piece, seg: k.seg };
}
