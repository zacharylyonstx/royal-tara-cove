// Where each movement's centerline runs through the world, and how beats map onto it.
//
// Rules work in (beat, lateral x, height y). A Route turns that into world space:
//   world = centerline(beat) + right * x + up * y
// Kite's forward travel is a function of the beat only (the landscape approaching is time),
// with a slow walk-in and a slow arrival authored as a speed profile.

import * as THREE from 'three-afternote';
import { WORLD } from '../core/Constants.js';

const UP = new THREE.Vector3(0, 1, 0);
const _tan = new THREE.Vector3();

export class Route {
  /**
   * @param {THREE.Vector3[]} points   control points of the centerline
   * @param {number} startBeat
   * @param {number} endBeat
   * @param {Array<[number, number]>} speedKeys  [beat, relative speed 0..1] keyframes
   */
  constructor({ points, startBeat, endBeat, speedKeys, cam = null }) {
    this.cam = cam ?? { side: 0, lookSide: 0 };
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = Math.max(600, points.length * 220);
    this.length = this.curve.getLength();
    this.startBeat = startBeat;
    this.endBeat = endBeat;

    // Integrate the speed profile into a distance table.
    this.tableStart = startBeat - 10;
    this.tableEnd = endBeat + 20;
    this.res = 16; // samples per beat
    const n = Math.round((this.tableEnd - this.tableStart) * this.res) + 1;
    const rel = new Float32Array(n);
    let acc = 0;
    let prev = this._speed(speedKeys, this.tableStart);
    rel[0] = 0;
    for (let i = 1; i < n; i++) {
      const b = this.tableStart + i / this.res;
      const sp = this._speed(speedKeys, b);
      acc += ((prev + sp) / 2) * (1 / this.res);
      rel[i] = acc;
      prev = sp;
    }
    // Scale so the journey from startBeat to endBeat uses the curve, with a little run-in.
    const relAt = (b) => this._sample(rel, b);
    const runIn = 2.0;
    const usable = this.length - runIn - 1.0;
    this.unitsPerBeat = usable / (relAt(endBeat) - relAt(startBeat));
    this.table = rel;
    this.offset = runIn - relAt(startBeat) * this.unitsPerBeat;
  }

  _speed(keys, b) {
    if (b <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (b <= keys[i][0]) {
        const [b0, s0] = keys[i - 1];
        const [b1, s1] = keys[i];
        const u = (b - b0) / (b1 - b0);
        const e = u * u * (3 - 2 * u);
        return s0 + (s1 - s0) * e;
      }
    }
    return keys[keys.length - 1][1];
  }

  _sample(table, b) {
    const f = (b - this.tableStart) * this.res;
    if (f <= 0) return table[0];
    const max = table.length - 1;
    if (f >= max) return table[max];
    const i = Math.floor(f);
    return table[i] + (table[i + 1] - table[i]) * (f - i);
  }

  /** Distance along the centerline (world units) at a beat. */
  distanceAt(beat) {
    return this._sample(this.table, beat) * this.unitsPerBeat + this.offset;
  }

  /** Forward speed in world units per beat at a beat. */
  speedAt(beat) {
    return (this.distanceAt(beat + 0.05) - this.distanceAt(beat - 0.05)) / 0.1;
  }

  /** Centerline frame at a beat. Writes into `out` = { pos, tan, right }. */
  frameAt(beat, out) {
    return this.frameAtDistance(this.distanceAt(beat), out);
  }

  frameAtDistance(s, out) {
    const u = s / this.length;
    if (u <= 0) {
      this.curve.getTangentAt(0, out.tan);
      this.curve.getPointAt(0, out.pos).addScaledVector(out.tan, s);
    } else if (u >= 1) {
      this.curve.getTangentAt(1, out.tan);
      this.curve.getPointAt(1, out.pos).addScaledVector(out.tan, s - this.length);
    } else {
      this.curve.getPointAt(u, out.pos);
      this.curve.getTangentAt(u, out.tan);
    }
    out.right.crossVectors(out.tan, UP).normalize();
    return out;
  }

  /** World position for a lane offset at a beat. */
  pointAt(beat, x, y, target) {
    const f = this.frameAt(beat, _frame);
    return target.copy(f.pos).addScaledVector(f.right, x).addScaledVector(UP, y);
  }

  /** Heading (yaw, radians) of the route at a beat; 0 faces -Z. */
  yawAt(beat) {
    this.frameAt(beat, _frame);
    _tan.copy(_frame.tan);
    return Math.atan2(-_tan.x, -_tan.z);
  }
}

const _frame = makeFrame();

export function makeFrame() {
  return { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3() };
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// The lighthouse stands on its island at the far end of everything.
export const ISLAND = new THREE.Vector3(WORLD.LIGHTHOUSE.x, 0, WORLD.LIGHTHOUSE.z);

function spiralPoints() {
  const pts = [];
  const { baseY, towerHeight } = WORLD.LIGHTHOUSE;
  const top = baseY - 2 + towerHeight - 1.6; // just under the gallery floor; lane height lifts Kite onto it
  const deg = Math.PI / 180;
  const phi0 = 236 * deg;
  const sweep = 648 * deg;
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    // climb evenly; pull inward to the gallery over the last stretch (the final long note)
    const inward = Math.max(0, (u - 0.87) / 0.13);
    const e = inward * inward * (3 - 2 * inward);
    const r = 21 - 3.0 * u - 11.6 * e;
    const phi = phi0 + sweep * u;
    const y = 7.5 + (top - 7.5) * Math.pow(u, 0.92);
    pts.push(v(ISLAND.x + Math.sin(phi) * r, y, ISLAND.z + Math.cos(phi) * r));
  }
  return pts;
}

/** Builds the three movement routes of the Lighthouse. */
export function buildLighthouseRoutes(movements) {
  const ix = ISLAND.x;
  const iz = ISLAND.z;

  const causeway = new Route({
    points: [
      v(-10, 2.4, 46), v(-10, 2.4, 36), v(-8.5, 2.4, 20), v(-5, 2.5, -4), v(2, 2.7, -34),
      v(8, 3.0, -66), v(9, 3.3, -100), v(4, 3.6, -132), v(-2, 3.9, -160),
      v(ix - 10, 4.3, iz + 52), v(ix - 7, 4.7, iz + 39), v(ix - 5.5, 4.9, iz + 32),
    ],
    startBeat: movements[0].startBeat,
    endBeat: movements[0].endBeat,
    speedKeys: [[-9, 0.34], [-5.2, 0.34], [-5, 0.8], [-3.1, 0.8], [-1, 1], [62.6, 1], [66, 0.3], [67, 0.02]],
  });

  const roots = new Route({
    points: [
      v(-22, 0.85, 42), v(-21.5, 0.85, 32), v(-20, 0.8, 16), v(-16.5, 0.75, -8), v(-9.5, 0.75, -38),
      v(-3, 0.8, -68), v(-1.5, 0.85, -100), v(-6.5, 0.9, -132), v(-12.5, 1.0, -160),
      v(ix - 23, 1.2, iz + 50), v(ix - 23, 1.6, iz + 36), v(ix - 22, 1.9, iz + 28),
    ],
    startBeat: movements[1].startBeat,
    endBeat: movements[1].endBeat,
    speedKeys: [[-6, 0.12], [-4.5, 0.4], [-1.5, 1], [62.6, 1], [66, 0.3], [67, 0.02]],
    // stand off to the sea side and look across, so the Echo on the road above stays in the picture
    cam: { side: -4.6, lookSide: 5.2 },
  });

  const lens = new Route({
    points: spiralPoints(),
    startBeat: movements[2].startBeat,
    endBeat: movements[2].endBeat,
    speedKeys: [[-6, 0.12], [-4.5, 0.4], [-1.5, 1], [61.5, 1], [63.5, 0.3], [67, 0.02]],
    // stand a little outside the curve and look in, so the tower stays in the picture
    cam: { side: 3.2, lookSide: -3.4 },
  });

  return [causeway, roots, lens];
}

/** A short ride on a current of light from the end of one route to the start of the next. */
export function buildTransit(from, to, lift = 6) {
  const a = from.clone();
  const b = to.clone();
  const mid1 = a.clone().lerp(b, 0.25);
  const mid2 = a.clone().lerp(b, 0.75);
  mid1.y = Math.max(a.y, b.y) + lift * 0.6;
  mid2.y = Math.max(a.y, b.y) + lift;
  // swing wide so the ride looks along what was built rather than through it
  const side = new THREE.Vector3().subVectors(b, a).cross(UP).normalize().multiplyScalar(-12);
  mid1.add(side);
  mid2.add(side.multiplyScalar(0.6));
  return new THREE.CatmullRomCurve3([a, mid1, mid2, b], false, 'centripetal', 0.5);
}
