// The Sea of Bridges, made visible: the places beyond the lighthouse, the landings a bridge
// leaves from and arrives at, the routes between them, and every bridge that has been played.
//
// A bridge that is being played or listened to is drawn in full (stones, light, leap ribbons,
// one PathView per part). Every other bridge is a single ribbon of light per part that traces
// the shape of its melody over the water, so the whole sea of them can stay in view at once.
//
// Like the rest of the world, this decides nothing: the Conductor tells it what happened.

import * as THREE from 'three-afternote';
import { COLORS, CROSSING, LANES } from '../core/Constants.js';
import { PLACES, EDGES, EDGE, edgesOf, otherEnd } from '../music/sea.js';
import { kiteStateAt } from '../rules/Trajectory.js';
import { G, makeStylized, makeGlow, ribbonGeometry, softDotTexture, slabGeometry, disposeObject } from './Shared.js';
import { rockGeometry } from './Lighthouse.js';
import { Route } from './Routes.js';
import { PathView } from './PathView.js';
import { KiteModel } from './KiteView.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
/** The light each place wakes to (its beacon, its landmark, its bridges' lanterns). */
export const PLACE_COLOR = {
  lighthouse: 0xffc870, chimes: 0xffe6b0, harp: 0x8fe8d8, garden: 0xc8f09a, stacks: 0xcfd8ff, harbor: 0xffb06a, deep: 0x7df0ff,
};
/** One colour per part of a bridge (first, second, third). */
export const LAYER_COLOR = [0xffd08a, 0xa9d8ff, 0xd9b8ff];

const LAND_Y = CROSSING.LAND_Y;
const ROUTE_Y = LAND_Y - LANES.Y[2]; // Kite sets out in the middle lane, level with the landing
const PLAZA_R = 6.4;
const DOCK_END = 15.5; // how far a landing reaches from the middle of its place
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function glowSprite(color, scale, opacity = 0, fog = false) {
  const m = new THREE.SpriteMaterial({ map: softDotTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity, fog });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

export class SeaWorld {
  /**
   * @param {THREE.Scene} scene
   * @param {{effects:object, sea:object}} deps
   */
  constructor(scene, { effects, sea }) {
    this.scene = scene;
    this.effects = effects;
    this.sea = sea;
    this.group = new THREE.Group();
    this.group.name = 'sea-of-bridges';
    scene.add(this.group);

    this.ruin = makeStylized({ color: COLORS.RUIN, shade: COLORS.RUIN_DARK, grain: 0.5, grainScale: 1.1, rim: 0.5, flat: true });
    this.pale = makeStylized({ color: 0x6f6a80, shade: 0x2b2938, grain: 0.45, grainScale: 0.9, rim: 0.6, flat: true });
    this.rock = makeStylized({ color: 0x45435a, shade: 0x191826, grain: 0.6, grainScale: 0.45, rim: 0.5, flat: true });
    this.slab = slabGeometry(17);
    this.rocks = [rockGeometry(51, 2), rockGeometry(57, 2), rockGeometry(63, 1)];
    for (const g of [this.slab, ...this.rocks]) g.userData.shared = true;

    this.routes = new Map(); // `${edge}|${from}|${layer}` -> Route
    this.places = {};
    for (const def of PLACES) this.places[def.id] = this._buildPlace(def);
    for (const edge of EDGES) this._buildDocks(edge);

    this.bridges = new Map(); // edge id -> { from, proxies: Mesh[] }
    this.active = null; // { edge, from, views: PathView[] }
    this.ghosts = [];
    this._p = new THREE.Vector3();
  }

  // -------------------------------------------------------------------------------
  // Geometry of the sea
  // -------------------------------------------------------------------------------

  /** Where Kite stands at a place: the middle of its landing. */
  landing(id, target = new THREE.Vector3()) {
    return target.copy(this.places[id].pos);
  }

  /** The unit direction from one place toward another, flat on the water. */
  _dir(fromId, toId, target = new THREE.Vector3()) {
    return target.subVectors(this.places[toId].pos, this.places[fromId].pos).setY(0).normalize();
  }

  /**
   * The centerline one part of a bridge is played along. Every part leaves the same landing
   * and reaches the same landing; in between they run side by side, each a little higher.
   */
  routeFor(edgeId, from, layer = 0) {
    const key = `${edgeId}|${from}|${layer}`;
    if (this.routes.has(key)) return this.routes.get(key);
    const edge = EDGE[edgeId];
    const to = otherEnd(edge, from);
    const A = this.places[from].pos;
    const B = this.places[to].pos;
    const dir = this._dir(from, to);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const S = A.clone().addScaledVector(dir, 2.5);
    const E = B.clone().addScaledVector(dir, -2.5);
    const dist = S.distanceTo(E);
    const [ox, oy] = CROSSING.LAYER_OFFSET[layer] ?? [0, 0];
    // a slow bend, the same shape whichever end the bridge was begun from
    const sign = from === edge.a ? 1 : -1;
    const bow = (((edge.id.length * 7 + edge.bars) % 5) - 2) * 2.4 * sign;
    const clear = DOCK_END - 1.5; // straight and together until past the landing
    const spread = Math.max(8, CROSSING.BRAID * dist);
    const points = [];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const d = (dist * i) / n;
      const env = smooth((d - clear) / spread) * smooth((dist - d - clear) / spread);
      const open = Math.sin(Math.PI * Math.max(0, Math.min(1, (d - clear) / Math.max(1, dist - 2 * clear))));
      const p = S.clone().addScaledVector(dir, d).addScaledVector(right, ox * env + bow * open);
      p.y = ROUTE_Y + oy * env + 0.5 * open;
      points.push(p);
    }
    const beats = edge.bars * 4;
    const route = new Route({
      points,
      startBeat: CROSSING.START_BEAT,
      endBeat: beats + CROSSING.TAIL_BEATS,
      // walk out along the landing so the first note waits at its very edge; after the last
      // note, walk in along the far landing (see DOCK_END)
      speedKeys: [[CROSSING.START_BEAT, 0.3], [-2.2, 0.55], [-0.5, 1], [beats, 1], [beats + 2, 0.85], [beats + 4.5, 0.4], [beats + CROSSING.TAIL_BEATS, 0.04]],
    });
    this.routes.set(key, route);
    return route;
  }

  // -------------------------------------------------------------------------------
  // Places
  // -------------------------------------------------------------------------------
  _mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  _buildPlace(def) {
    const rnd = seeded(def.id.length * 977 + Math.abs(Math.round(def.x * 13 + def.z * 7)));
    const pos = new THREE.Vector3(def.x, LAND_Y, def.z);
    const g = new THREE.Group();
    g.position.set(def.x, 0, def.z);
    this.group.add(g);
    const color = PLACE_COLOR[def.id] ?? COLORS.GOLD;

    // the mound and the round landing on top of it
    const mound = this._mesh(this.rocks[0], this.rock, g, 0, -1.4, 0);
    mound.scale.set(10.5, 4.2, 10.5);
    mound.rotation.y = rnd() * TAU;
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU;
      const r = 8 + rnd() * 6;
      const m = this._mesh(this.rocks[i % 3], this.rock, g, Math.cos(a) * r, -0.6 + rnd() * 0.8, Math.sin(a) * r);
      const s = 1.2 + rnd() * 2.6;
      m.scale.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.8), s * (0.8 + rnd() * 0.6));
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    }
    const plaza = this._mesh(new THREE.CylinderGeometry(PLAZA_R, PLAZA_R + 0.9, 1.5, 11), this.ruin, g, 0, LAND_Y - 0.75, 0);
    plaza.rotation.y = rnd() * TAU;
    const ringMat = makeStylized({ color: 0x8a8498, shade: 0x34313f, grain: 0.3, rim: 0.7, emissive: color, glow: 0 });
    const ring = this._mesh(new THREE.TorusGeometry(PLAZA_R - 1.3, 0.14, 5, 28), ringMat, g, 0, LAND_Y + 0.03, 0);
    ring.rotation.x = Math.PI / 2;

    // the landmark stands in the widest gap between the bridges that leave this place
    const angles = edgesOf(def.id).map((e) => {
      const o = PLACES.find((p) => p.id === otherEnd(e, def.id));
      return Math.atan2(o.z - def.z, o.x - def.x);
    }).sort((a, b) => a - b);
    let best = 0, gap = -1;
    angles.forEach((a, i) => {
      const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + TAU;
      if (next - a > gap) { gap = next - a; best = a + (next - a) / 2; }
    });
    const lm = new THREE.Group();
    lm.position.set(Math.cos(best) * 10.5, 0, Math.sin(best) * 10.5);
    lm.rotation.y = -best + Math.PI / 2; // local +Z faces the landing
    g.add(lm);
    const base = this._mesh(this.rocks[1], this.rock, lm, 0, -0.6, 0);
    base.scale.set(5.2, 3.4, 5.2);

    const place = {
      def, pos, group: g, landmark: lm, color: new THREE.Color(color), level: 0, target: 0,
      glowMats: [ringMat], sprites: [], spin: [], sway: [], strings: [], motes: null, docks: {},
      landmarkPos: new THREE.Vector3(def.x + lm.position.x, LAND_Y + 5, def.z + lm.position.z),
    };
    this._buildLandmark(place, rnd);

    // a beacon that shows where the place is, and a tall thread of light once it is awake
    place.beacon = glowSprite(color, 9, 0.05);
    place.beacon.position.set(lm.position.x, place.top ?? 9, lm.position.z);
    g.add(place.beacon);
    // (two crossed sheets with soft edges, so it reads as a beam from every side and from far away)
    place.pillarMat = makeGlow({ color, intensity: 0, flow: 1.4 });
    place.pillar = new THREE.Group();
    const sheet = new THREE.PlaneGeometry(110, 2.2).rotateZ(Math.PI / 2);
    for (const ry of [0, Math.PI / 2]) {
      const m = new THREE.Mesh(sheet, place.pillarMat);
      m.rotation.y = ry;
      m.frustumCulled = false;
      place.pillar.add(m);
    }
    place.pillar.position.set(lm.position.x, 55 + (place.top ?? 9), lm.position.z);
    g.add(place.pillar);
    return place;
  }

  /** Each place has its own silhouette, made of the same dusk stone as the lighthouse. */
  _buildLandmark(place, rnd) {
    const lm = place.landmark;
    const accent = () => {
      const m = makeStylized({ color: 0x8a6c42, shade: 0x2e2218, grain: 0.3, grainScale: 2.0, rim: 0.9, emissive: place.color.getHex(), glow: 0 });
      place.glowMats.push(m);
      return m;
    };
    const spark = (x, y, z, scale = 3) => {
      const s = glowSprite(place.color.getHex(), scale, 0);
      s.position.set(x, y, z);
      lm.add(s);
      place.sprites.push({ sprite: s, max: 0.85, phase: rnd() * TAU });
      return s;
    };
    const column = (x, z, h, r, tilt = 0, tiltDir = 0) => {
      const geo = new THREE.CylinderGeometry(r * 0.8, r * 1.15, h, 7, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const j = 1 + (rnd() - 0.5) * 0.12;
        p.setX(i, p.getX(i) * j);
        p.setZ(i, p.getZ(i) * j);
      }
      geo.computeVertexNormals();
      const holder = new THREE.Group();
      holder.position.set(x, 1.6, z);
      holder.rotation.set(Math.cos(tiltDir) * tilt, 0, -Math.sin(tiltDir) * tilt);
      const m = this._mesh(geo, this.pale, holder, 0, h / 2, 0);
      m.rotation.y = rnd() * 3;
      lm.add(holder);
      return holder;
    };

    switch (place.def.kind) {
      case 'home': {
        // the sea gate: two pillars and a lintel, with a lantern hanging in it
        column(-2.6, 0, 7.5, 0.62);
        column(2.6, 0, 7.5, 0.62);
        const lintel = this._mesh(this.slab, this.ruin, lm, 0, 9.6, 0);
        lintel.scale.set(7.4, 1.0, 1.7);
        const lamp = this._mesh(new THREE.OctahedronGeometry(0.5, 0), accent(), lm, 0, 7.4, 0);
        place.sway.push({ obj: lamp, amp: 0.05, speed: 0.9, phase: 0 });
        spark(0, 7.4, 0, 5);
        place.top = 10.5;
        break;
      }
      case 'chimes': {
        // three leaning stones holding a bronze ring of hanging chimes
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + 0.4;
          column(Math.cos(a) * 3.3, Math.sin(a) * 3.3, 8.6, 0.5, 0.2, a + Math.PI);
        }
        const bronze = accent();
        const ring = this._mesh(new THREE.TorusGeometry(2.3, 0.16, 6, 22), bronze, lm, 0, 9.3, 0);
        ring.rotation.x = Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const len = 1.3 + ((i * 5) % 4) * 0.45;
          const holder = new THREE.Group();
          holder.position.set(Math.cos(a) * 2.3, 9.2, Math.sin(a) * 2.3);
          const tube = this._mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 6), bronze, holder, 0, -len / 2 - 0.25, 0);
          void tube;
          lm.add(holder);
          place.sway.push({ obj: holder, amp: 0.14, speed: 1.1 + (i % 3) * 0.23, phase: i * 0.9 });
        }
        spark(0, 8.2, 0, 7);
        place.top = 10.6;
        break;
      }
      case 'harp': {
        // two leaning stones and a beam: a harp taller than a house, strung with light
        const tall = column(-3.4, 0, 12, 0.7, 0.16, 0);
        void tall;
        column(3.2, 0, 5.4, 0.6, 0.1, Math.PI);
        const beam = this._mesh(this.slab, this.ruin, lm, -0.2, 11.2, 0);
        beam.scale.set(8.4, 0.7, 1.2);
        beam.rotation.z = 0.74;
        const foot = this._mesh(this.slab, this.ruin, lm, 0, 2.3, 0);
        foot.scale.set(7.6, 0.7, 1.4);
        for (let i = 0; i < 9; i++) {
          const u = i / 8;
          const x = -2.7 + u * 5.2;
          const top = 13.2 - u * 6.4;
          const mat = makeGlow({ color: place.color.getHex(), intensity: 0, flow: 0 });
          const s = new THREE.Mesh(ribbonGeometry([new THREE.Vector3(x, 2.3, 0), new THREE.Vector3(x, (2.3 + top) / 2, 0.02), new THREE.Vector3(x, top, 0)], 0.12), mat);
          s.frustumCulled = false;
          lm.add(s);
          place.strings.push({ mat, phase: i * 0.7 });
        }
        spark(0, 7, 0.4, 8);
        place.top = 14.5;
        break;
      }
      case 'garden': {
        // a stone tree: bare until the place wakes, then it comes into leaf
        const trunk = column(0, 0, 6.2, 1.0);
        void trunk;
        place.tips = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + 0.3;
          const len = 3.2 + (i % 3) * 0.9;
          const lift = 0.5 + (i % 2) * 0.28;
          const geo = new THREE.CylinderGeometry(0.14, 0.32, len, 5);
          geo.translate(0, len / 2, 0);
          const b = this._mesh(geo, this.pale, lm, 0, 6.6 + (i % 3) * 0.5, 0);
          b.rotation.set(0, -a, 0);
          b.rotateZ(-(Math.PI / 2 - lift));
          const tip = new THREE.Vector3(Math.cos(a) * Math.cos(lift) * len, 6.6 + (i % 3) * 0.5 + Math.sin(lift) * len, Math.sin(a) * Math.cos(lift) * len);
          place.tips.push(tip);
          spark(tip.x, tip.y, tip.z, 3.2);
        }
        place.top = 12;
        break;
      }
      case 'stacks': {
        // tall sea stacks with hollows the wind sings through
        const spots = [[-3.4, 0.6, 13.5, 1.5], [0.2, -1.6, 17, 1.8], [3.6, 0.8, 11, 1.4], [1.0, 2.8, 8, 1.1]];
        spots.forEach(([x, z, h, r], i) => {
          column(x, z, h, r, 0.05 * (i % 2 ? 1 : -1), i);
          for (let k = 0; k < 2; k++) {
            const y = 1.6 + h * (0.45 + k * 0.28);
            const hole = this._mesh(new THREE.SphereGeometry(r * 0.42, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0a0b14 }), lm, x, y, z + r * 0.72);
            hole.scale.set(1, 1.35, 0.5);
            spark(x, y, z + r * 0.9, 2.6);
          }
        });
        place.top = 19;
        break;
      }
      case 'harbor': {
        // a little waterwheel on an old frame, and a crane with a lantern
        const frame = accent();
        for (const sx of [-1.5, 1.5]) {
          const post = this._mesh(new THREE.CylinderGeometry(0.2, 0.28, 6.4, 6), this.pale, lm, sx, 4.8, 0);
          void post;
        }
        const wheel = new THREE.Group();
        wheel.position.set(0, 6.6, 0);
        const rim = this._mesh(new THREE.TorusGeometry(3.1, 0.18, 6, 24), frame, wheel);
        rim.rotation.y = Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const spoke = this._mesh(new THREE.BoxGeometry(0.14, 6.1, 0.14), frame, wheel);
          spoke.rotation.x = a;
          const paddle = this._mesh(new THREE.BoxGeometry(1.5, 0.12, 0.7), this.pale, wheel, 0, Math.cos(a) * 3.1, Math.sin(a) * 3.1);
          paddle.rotation.x = a;
        }
        lm.add(wheel);
        place.spin.push({ obj: wheel, axis: 'x', speed: 0.55 });
        const arm = this._mesh(new THREE.BoxGeometry(0.22, 0.22, 4.6), this.pale, lm, 3.4, 8.2, 1.2);
        arm.rotation.x = -0.35;
        this._mesh(new THREE.CylinderGeometry(0.22, 0.3, 7.4, 6), this.pale, lm, 3.4, 5.2, -0.4);
        const lamp = this._mesh(new THREE.OctahedronGeometry(0.42, 0), accent(), lm, 3.4, 6.6, 3.1);
        place.sway.push({ obj: lamp, amp: 0.06, speed: 1.2, phase: 1 });
        spark(3.4, 6.6, 3.1, 4.5);
        spark(0, 6.6, 0, 6);
        place.top = 11;
        break;
      }
      case 'deep':
      default: {
        // a low reef ringed with jar lanterns; fireflies gather once they are lit
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          const r = 3.2 + (i % 2) * 0.9;
          const h = 2.2 + (i % 3) * 0.7;
          this._mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 5), this.pale, lm, Math.cos(a) * r, 1.6 + h / 2, Math.sin(a) * r);
          this._mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.7, 7), accent(), lm, Math.cos(a) * r, 1.6 + h + 0.4, Math.sin(a) * r);
          spark(Math.cos(a) * r, 1.6 + h + 0.4, Math.sin(a) * r, 2.8);
        }
        const n = 46;
        const geo = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3);
        const seedArr = [];
        for (let i = 0; i < n; i++) seedArr.push([rnd() * TAU, 2 + rnd() * 7, 2.5 + rnd() * 7, 0.2 + rnd() * 0.5, rnd() * TAU]);
        geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
        const mat = new THREE.PointsMaterial({ map: softDotTexture(), color: place.color.getHex(), size: 0.7, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        lm.add(pts);
        place.motes = { pts, seedArr, mat };
        place.top = 7;
        break;
      }
    }
  }

  /** A stone landing from each end of a possible bridge, with a pair of lantern posts at its lip. */
  _buildDocks(edge) {
    for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]]) {
      const place = this.places[from];
      const dir = this._dir(from, to);
      const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      const a = PLAZA_R - 0.6;
      const pieces = 4;
      const len = (DOCK_END - a) / pieces;
      for (let i = 0; i < pieces; i++) {
        const mid = a + len * (i + 0.5);
        const m = new THREE.Mesh(this.slab, i % 2 ? this.pale : this.ruin);
        m.position.set(dir.x * mid, LAND_Y, dir.z * mid);
        m.rotation.y = yaw;
        m.scale.set(4.8 - i * 0.2, 0.95, len * 0.96);
        place.group.add(m);
      }
      const lamps = [];
      for (const side of [-1, 1]) {
        // (outside the five lanes, so no stone ever grows through a post)
        const x = dir.x * (DOCK_END - 3.2) + right.x * side * 3.1;
        const z = dir.z * (DOCK_END - 3.2) + right.z * side * 3.1;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 2.2, 5), this.pale);
        post.position.set(x, LAND_Y + 0.5, z);
        place.group.add(post);
        const glow = glowSprite(LAYER_COLOR[0], 2.4, 0);
        glow.position.set(x, LAND_Y + 1.8, z);
        place.group.add(glow);
        lamps.push(glow);
      }
      place.docks[edge.id] = { lamps, lit: 0, target: 0 };
    }
  }

  /** Wake a place (or put it back to sleep). Instant when restoring a saved sea. */
  setAwake(id, awake, instant = false) {
    const place = this.places[id];
    if (!place) return;
    const was = place.target;
    place.target = awake ? 1 : 0;
    if (instant) place.level = place.target;
    if (awake && place.tips && (instant || was === 0)) {
      // the stone tree comes into leaf
      for (const tip of place.tips) {
        this._p.copy(tip).applyQuaternion(place.landmark.quaternion).add(place.landmark.position).add(place.group.position);
        this.effects.sprout(this._p, 16, 1.5, { instant, drop: -0.2 });
      }
    }
    if (awake && !instant && was === 0) {
      this.effects.burst(place.landmarkPos, place.color.getHex(), 90, 6, { up: 2.4, life: 2.2, size: 0.9, gravity: 0.3 });
      this.effects.rise(place.landmarkPos, place.color.getHex(), 50, 5, 9);
      this.sea.ripple(place.pos.x, place.pos.z, 2.4, place.color.getHex());
    }
  }

  // -------------------------------------------------------------------------------
  // Bridges
  // -------------------------------------------------------------------------------

  /**
   * (Re)draw one bridge as ribbons of light: one per part, following its melody.
   * @param {string} edgeId
   * @param {{from:string}|null} bridge  null removes it
   * @param {object[]} records  one performed record per part
   */
  setBridge(edgeId, bridge, records = []) {
    const old = this.bridges.get(edgeId);
    if (old) {
      for (const m of old.proxies) {
        this.group.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
      this.bridges.delete(edgeId);
    }
    const edge = EDGE[edgeId];
    for (const end of [edge.a, edge.b]) this.places[end].docks[edgeId].target = bridge && records.length ? 1 : 0;
    if (!bridge || !records.length) return;
    const proxies = records.map((rec, layer) => {
      const route = this.routeFor(edgeId, bridge.from, layer);
      const beats = edge.bars * 4;
      // where Kite stood on each half-beat, joined by one smooth line: the melody's own shape
      const knots = [];
      for (let b = -1.25; b <= beats + 1.75 + 1e-6; b += 0.5) {
        const st = kiteStateAt(rec.pieces, rec.segs, rec.startLane, b);
        knots.push(route.pointAt(b, st.x, st.y + 0.3, new THREE.Vector3()));
      }
      const pts = new THREE.CatmullRomCurve3(knots, false, 'centripetal', 0.5).getPoints(knots.length * 4);
      const mat = makeGlow({ color: LAYER_COLOR[layer] ?? COLORS.GOLD, intensity: 0.6, flow: 2.4 });
      const mesh = new THREE.Mesh(ribbonGeometry(pts, 0.8), mat);
      mesh.frustumCulled = false;
      mesh.visible = !(this.active && this.active.edge === edgeId);
      this.group.add(mesh);
      return mesh;
    });
    this.bridges.set(edgeId, { from: bridge.from, proxies });
  }

  /**
   * Draw one bridge in full so it can be played on or listened to.
   * @returns {PathView[]} one view per existing part
   */
  activate(edgeId, from, records) {
    this.deactivate();
    const views = records.map((rec, layer) => {
      const view = new PathView(this.scene, this.routeFor(edgeId, from, layer), { index: 10 + layer });
      view.buildFromRecord(rec);
      return view;
    });
    this.active = { edge: edgeId, from, views };
    const b = this.bridges.get(edgeId);
    if (b) for (const m of b.proxies) m.visible = false;
    return views;
  }

  /** A new, empty part on the active bridge, ready to be played. */
  beginLayer(layer) {
    const a = this.active;
    if (a.views[layer]) a.views[layer].dispose();
    a.views[layer] = new PathView(this.scene, this.routeFor(a.edge, a.from, layer), { index: 10 + layer });
    return a.views[layer];
  }

  /** Throw away a part that was not finished. */
  dropLayer(layer) {
    const a = this.active;
    if (!a || !a.views[layer]) return;
    a.views[layer].dispose();
    a.views.length = layer;
  }

  /** Back to ribbons of light. */
  deactivate() {
    if (!this.active) return;
    for (const v of this.active.views) if (v) v.dispose();
    const b = this.bridges.get(this.active.edge);
    if (b) for (const m of b.proxies) m.visible = true;
    this.active = null;
    for (const g of this.ghosts) if (g) g.setVisible(false);
  }

  /** The translucent Kite that walks a part again. */
  ghost(layer) {
    if (!this.ghosts[layer]) {
      this.ghosts[layer] = new KiteModel(this.scene, { ghost: true, echoColor: COLORS.ECHO[layer] ?? COLORS.ECHO[0] });
      this.ghosts[layer].setVisible(false);
    }
    return this.ghosts[layer];
  }

  setLettersVisible(v) {
    if (this.active) for (const view of this.active.views) if (view) view.setLettersVisible(v);
  }

  // -------------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------------
  update(dt, beat) {
    const t = G.uTime.value;
    if (this.active) for (const v of this.active.views) if (v) v.update(beat, dt);
    for (const b of this.bridges.values()) {
      for (const m of b.proxies) if (m.visible) m.material.uniforms.uIntensity.value = 0.55 + 0.12 * Math.sin(t * 1.3 + m.id);
    }
    for (const place of Object.values(this.places)) {
      place.level += (place.target - place.level) * Math.min(1, dt * 0.9);
      const L = place.level;
      const flick = 0.92 + 0.08 * Math.sin(t * 2.1 + place.pos.x);
      place.beacon.material.opacity = (0.05 + 0.6 * L) * flick;
      place.beacon.scale.setScalar(9 + 4 * L);
      place.pillarMat.uniforms.uIntensity.value = 0.5 * L * flick;
      for (const m of place.glowMats) m.uniforms.uGlow.value = L * (0.75 + 0.25 * Math.sin(t * 1.7));
      for (const s of place.sprites) s.sprite.material.opacity = L * s.max * (0.8 + 0.2 * Math.sin(t * 2.3 + s.phase));
      for (const s of place.sway) s.obj.rotation.z = Math.sin(t * s.speed + s.phase) * s.amp * (0.25 + 0.75 * L);
      for (const s of place.spin) s.obj.rotation[s.axis] += dt * s.speed * L;
      for (const s of place.strings) s.mat.uniforms.uIntensity.value = L * (0.9 + 0.9 * Math.max(0, Math.sin(t * 1.6 - s.phase)));
      if (place.motes) {
        const { pts, seedArr, mat } = place.motes;
        mat.opacity = L * 0.95;
        const p = pts.geometry.attributes.position;
        for (let i = 0; i < seedArr.length; i++) {
          const [a0, y0, r, sp, ph] = seedArr[i];
          const a = a0 + t * sp * 0.6;
          p.setXYZ(i, Math.cos(a) * r, y0 + Math.sin(t * sp * 2 + ph) * 0.8, Math.sin(a) * r);
        }
        p.needsUpdate = true;
      }
      for (const dock of Object.values(place.docks)) {
        dock.lit += (dock.target - dock.lit) * Math.min(1, dt * 1.5);
        for (const lamp of dock.lamps) lamp.material.opacity = dock.lit * 0.9 * flick;
      }
    }
  }

  dispose() {
    this.deactivate();
    disposeObject(this.group);
  }
}
