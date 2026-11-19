// The unfinished places Kite travels through, laid out along the three routes:
// a ruined colonnade over the sea, lantern posts, an arch with a silent chime, a tidepool,
// the roots and waterwheel beneath, and the broken stair around the tower.
//
// Things that can wake are woken by accent tags from the score (see onAccent).

import * as THREE from 'three-afternote';
import { COLORS, LANES } from '../core/Constants.js';
import { G, makeStylized, softDotTexture, slabGeometry } from './Shared.js';
import { rockGeometry, seeded } from './Lighthouse.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

function placeAlong(obj, route, b0, b1, x, y) {
  route.pointAt(b0, x, y, _a);
  route.pointAt(b1, x, y, _b);
  obj.position.copy(_a).add(_b).multiplyScalar(0.5);
  _z.subVectors(_b, _a);
  const len = _z.length();
  _z.normalize();
  _x.crossVectors(UP, _z).normalize();
  _y.crossVectors(_z, _x).normalize();
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m);
  return len;
}

function glowSprite(color, scale, opacity = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
  s.scale.setScalar(scale);
  return s;
}

export class Scenery {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./Routes.js').Route[]} routes
   * @param {{ effects:object, sea:object, runners?:object }} deps
   */
  constructor(scene, routes, { effects, sea }) {
    this.scene = scene;
    this.routes = routes;
    this.effects = effects;
    this.sea = sea;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rnd = seeded(2026);
    this.spinners = [];
    this.lanterns = {};
    this.roots = {};
    this.fish = [];
    this.gulls = [];
    this.mist = [];
    this.awake = new Set();
    this.columns = [];
    this.vinesAwake = [false, false, false];

    this.ruin = makeStylized({ color: COLORS.RUIN, shade: COLORS.RUIN_DARK, grain: 0.5, grainScale: 1.1, rim: 0.5, flat: true });
    this.ruinPale = makeStylized({ color: 0x6f6a80, shade: 0x2b2938, grain: 0.45, grainScale: 0.9, rim: 0.6, flat: true });
    this.rock = makeStylized({ color: 0x403e4e, shade: 0x181724, grain: 0.6, grainScale: 0.5, rim: 0.45, flat: true });
    this.wood = makeStylized({ color: 0x4a3530, shade: 0x1c1418, grain: 0.5, grainScale: 2.0, rim: 0.5 });
    this.bronze = makeStylized({ color: 0x8a6c42, shade: 0x2e2218, grain: 0.3, grainScale: 2.0, rim: 0.9, emissive: 0xffb050, glow: 0 });
    this.slab = slabGeometry(11);
    this.rocks = [rockGeometry(31, 2), rockGeometry(37, 1), rockGeometry(41, 2)];

    this._causeway(routes[0]);
    this._undercroft(routes[1], routes[0]);
    this._spiral(routes[2]);
    this._mist();
  }

  // -------------------------------------------------------------------------------
  // Shared builders
  // -------------------------------------------------------------------------------

  /** A broad ruin platform lying along the route between two beats. */
  _platform(route, b0, b1, x, y, width, mat = this.ruin, thickness = 1.1) {
    const step = Math.max(0.6, (b1 - b0) / Math.max(1, Math.round((b1 - b0) / 1.6)));
    let k = 0;
    for (let b = b0; b < b1 - 1e-3; b += step, k++) {
      const holder = new THREE.Group();
      const len = placeAlong(holder, route, b, Math.min(b1, b + step), x, y);
      const m = new THREE.Mesh(this.slab, mat);
      m.scale.set(width * (0.96 + (k % 3) * 0.03), thickness, len * 0.985);
      holder.add(m);
      this.group.add(holder);
    }
  }

  _rock(pos, scale, mat = this.rock) {
    const m = new THREE.Mesh(this.rocks[Math.floor(this.rnd() * this.rocks.length)], mat);
    m.position.copy(pos);
    m.scale.set(scale * (0.8 + this.rnd() * 0.5), scale * (0.6 + this.rnd() * 0.7), scale * (0.8 + this.rnd() * 0.5));
    m.rotation.set(this.rnd() * 3, this.rnd() * 3, this.rnd() * 3);
    this.group.add(m);
    return m;
  }

  /** A stone column rising out of the sea to a given top height. */
  _column(pos, topY, radius, broken = false) {
    const h = topY + 3;
    const geo = new THREE.CylinderGeometry(radius * 0.86, radius * 1.12, h, 7, 3);
    // roughen the shaft a little so each column is its own ruin
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const j = 1 + (this.rnd() - 0.5) * 0.09;
      p.setX(i, p.getX(i) * j);
      p.setZ(i, p.getZ(i) * j);
      if (broken && p.getY(i) > h / 2 - 0.01) p.setY(i, p.getY(i) - this.rnd() * radius * 1.4);
    }
    geo.computeVertexNormals();
    this.columns.push({ pos: pos.clone(), top: topY, radius });
    const col = new THREE.Mesh(geo, this.ruin);
    col.position.set(pos.x, topY - h / 2, pos.z);
    col.rotation.y = this.rnd() * 3;
    this.group.add(col);
    if (!broken) {
      const cap = new THREE.Mesh(this.slab, this.ruinPale);
      cap.scale.set(radius * 2.9, 0.38, radius * 2.9);
      cap.position.set(pos.x, topY + 0.36, pos.z);
      cap.rotation.y = this.rnd() * 3;
      this.group.add(cap);
    }
    return col;
  }

  _lantern(key, pos, yaw = 0, height = 3.2) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = yaw;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, height, 6), this.ruinPale);
    post.position.y = height / 2;
    const base = new THREE.Mesh(this.slab, this.ruin);
    base.scale.set(1.1, 0.45, 1.1);
    base.position.y = 0.3;
    const cageMat = this.ruin;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.55, 6), cageMat);
    top.position.y = height + 1.2;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.2, 6), cageMat);
    floor.position.y = height + 0.05;
    g.add(post, base, top, floor);
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.92, 4), cageMat);
      const a = (i / 6) * Math.PI * 2;
      bar.position.set(Math.cos(a) * 0.46, height + 0.6, Math.sin(a) * 0.46);
      g.add(bar);
    }
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x15161f });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), coreMat);
    core.position.y = height + 0.6;
    const glow = glowSprite(COLORS.GOLD, 5.5, 0);
    glow.position.y = height + 0.6;
    g.add(core, glow);
    this.group.add(g);
    this.lanterns[key] = { group: g, core, coreMat, glow, level: 0, target: 0, top: new THREE.Vector3(pos.x, pos.y + height + 0.6, pos.z) };
  }

  /** A gnarled root following a curve; returns its material so it can be woken. */
  _root(points, radius, wake = false) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, Math.max(12, points.length * 8), radius, 6, false);
    // taper toward the tip
    const p = geo.attributes.position;
    const segs = Math.max(12, points.length * 8);
    const c = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      curve.getPoint(u, c);
      const k = 1 - 0.72 * u * u;
      for (let jv = 0; jv <= 6; jv++) {
        const idx = i * 7 + jv;
        p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * k, c.y + (p.getY(idx) - c.y) * k, c.z + (p.getZ(idx) - c.z) * k);
      }
    }
    geo.computeVertexNormals();
    const mat = wake
      ? makeStylized({ color: 0x4a3530, shade: 0x1c1418, grain: 0.5, grainScale: 2.0, rim: 0.6, emissive: 0xffb860, glow: 0 })
      : this.wood;
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
    return { mesh, mat, curve };
  }

  _wheel(center, yaw, radius, key) {
    const g = new THREE.Group();
    g.position.copy(center);
    g.rotation.y = yaw;
    const spin = new THREE.Group();
    g.add(spin);
    for (const dz of [-0.55, 0.55]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.13, 6, 30), this.bronze);
      rim.position.z = dz;
      spin.add(rim);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, radius * 2, 0.12), this.wood);
      spoke.rotation.z = a;
      if (i < 5) spin.add(spoke);
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 1.25), this.wood);
      paddle.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      paddle.rotation.z = a + Math.PI / 2;
      spin.add(paddle);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 8), this.bronze);
    hub.rotation.x = Math.PI / 2;
    spin.add(hub);
    this.group.add(g);
    const sp = { key, spin, speed: 0, target: 0, pos: center.clone(), radius };
    this.spinners.push(sp);
    return sp;
  }

  // -------------------------------------------------------------------------------
  // I — the causeway
  // -------------------------------------------------------------------------------
  _causeway(r) {
    const cx = LANES.X[0];
    // the landing where everything begins: a ruin platform, two pillars and a broken arch behind
    this._platform(r, -17, -4.56, cx, -0.02, 5.2);
    r.pointAt(-10.5, cx, -2.5, _a);
    this._rock(_a.clone(), 3.6);
    this._rock(r.pointAt(-15, cx - 2, -2.6, new THREE.Vector3()), 3.0);
    // one broken pillar to seaward; the landward side is left open so the title's words and the
    // first view of the lighthouse are never crossed by a column
    this._column(r.pointAt(-9.4, cx + 8.6, 0, new THREE.Vector3()), 4.2, 0.55, true);

    // the colonnade: pairs of columns flanking the route, most of them broken, with nothing between
    this.leftColumns = [];
    for (let b = 1.5; b < 60; b += 3.4) {
      for (const s of [-1, 1]) {
        const wakes = s < 0 && (Math.abs(b - 5.3) < 1.7 || Math.abs(b - 21.6) < 1.7);
        if (!wakes && (this.rnd() < 0.16 || Math.abs(b - 7.4) < 1.8)) continue;
        const off = s * (6.1 + this.rnd() * 1.2);
        const broken = !wakes && this.rnd() < 0.55;
        const at = wakes ? (Math.abs(b - 5.3) < 1.7 ? 5.3 : 21.6) : b + (this.rnd() - 0.5) * 0.8;
        r.pointAt(at, off, 0, _a);
        const top = _a.y + (broken ? -1.4 + this.rnd() * 3.0 : 3.6 + this.rnd() * 2.6);
        this._column(_a.clone(), top, 0.5 + this.rnd() * 0.2, broken);
        if (s < 0) this.leftColumns.push({ beat: at, pos: _a.clone(), top, wakes });
        if (this.rnd() < 0.3) this._rock(new THREE.Vector3(_a.x + s * 1.5, 0.1, _a.z + 1), 0.9 + this.rnd() * 1.2);
      }
    }
    // old piers under the line of the road, well below where notes will be built
    for (let b = 3; b < 60; b += 6.8) {
      r.pointAt(b, (this.rnd() - 0.5) * 3, 0, _a);
      this._column(_a.clone(), _a.y - 1.5 - this.rnd() * 0.8, 0.85, true);
    }

    // lantern posts: two along the way, one where the road reaches the island
    r.pointAt(12.9, 5.0, 0, _a);
    this._lantern('lantern1', _a.clone(), r.yawAt(12.9), LANES.Y[3] + 2.4);
    this._column(_a.clone(), _a.y, 0.6, true);
    r.pointAt(44.9, 5.0, 0, _a);
    this._lantern('lantern2', _a.clone(), r.yawAt(44.9), LANES.Y[3] + 2.4);
    this._column(_a.clone(), _a.y, 0.6, true);

    // a great gate spans the whole road; a chime that has never rung hangs over the high side
    const ab = 7.4;
    const gx0 = -6.0, gx1 = 6.4;
    r.pointAt(ab, gx0, 0, _a);
    r.pointAt(ab, gx1, 0, _b);
    const pillarTop = _a.y + 3.4;
    this._column(_a.clone(), pillarTop, 0.5);
    this._column(_b.clone(), pillarTop, 0.55);
    const half = (gx1 - gx0) / 2;
    const span = new THREE.Mesh(new THREE.TorusGeometry(half, 0.36, 6, 22, Math.PI), this.ruinPale);
    span.position.copy(_a).add(_b).multiplyScalar(0.5);
    span.position.y = pillarTop + 0.4;
    span.rotation.y = r.yawAt(ab);
    this.group.add(span);
    // where the chime hangs: above the two high lanes
    const cxm = (LANES.X[3] + LANES.X[4]) / 2;
    const off = cxm - (gx0 + gx1) / 2;
    const archY = pillarTop + 0.4 + Math.sqrt(Math.max(0.1, half * half - off * off)) - 0.3;
    const cordLen = archY - (_a.y + LANES.Y[4] + 3.3);
    const chime = new THREE.Group();
    r.pointAt(ab, cxm, 0, chime.position);
    chime.position.y = archY;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, cordLen, 4), this.ruin);
    cord.position.y = -cordLen / 2;
    this.chimeMat = makeStylized({ color: 0x8a6c42, shade: 0x2e2218, grain: 0.2, rim: 1.0, emissive: 0xffc870, glow: 0 });
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.4, 0.64, 10, 1, true), this.chimeMat);
    bell.material.side = THREE.DoubleSide;
    bell.position.y = -cordLen - 0.25;
    const clap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), this.chimeMat);
    clap.position.y = -cordLen - 0.62;
    chime.add(cord, bell, clap);
    this.group.add(chime);
    this.chime = { group: chime, swing: 0, vel: 0, glow: glowSprite(COLORS.GOLD, 4, 0), yaw: r.yawAt(ab) };
    this.chime.glow.position.copy(chime.position);
    this.chime.glow.position.y -= cordLen + 0.3;
    this.group.add(this.chime.glow);

    // the tidepool on the low route: a ring of rocks and something asleep under the water
    r.pointAt(8.4, -6.4, 0, _a);
    this.pool = new THREE.Vector3(_a.x, 0, _a.z);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      this._rock(new THREE.Vector3(this.pool.x + Math.cos(a) * 3.3, 0.05, this.pool.z + Math.sin(a) * 2.6), 0.7 + this.rnd() * 0.9);
    }
    for (let i = 0; i < 3; i++) {
      const hint = glowSprite(COLORS.TEAL, 1.1, 0.05);
      hint.position.set(this.pool.x + (i - 1) * 0.9, 0.08, this.pool.z + (i % 2) * 0.7);
      this.group.add(hint);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.TEAL).multiplyScalar(2.2), transparent: true, opacity: 0 }));
      body.scale.set(0.55, 0.7, 2.0);
      this.group.add(body);
      this.fish.push({ hint, body, state: 'sleep', timer: 0, t: 0, delay: i * 0.22, from: new THREE.Vector3(), to: new THREE.Vector3(), loop: 0 });
    }
    this.fishRoute = r;

    // where the road meets the island
    this._platform(r, 62.75, 72, cx, -0.02, 6.4, this.ruinPale);
    r.pointAt(66.6, cx + 2.6, 0, _a);
    this._lantern('lantern3', _a.clone(), r.yawAt(66), 3.8);
    r.pointAt(67, cx, -3.4, _a);
    this._rock(_a.clone(), 3.0);
  }

  // -------------------------------------------------------------------------------
  // II — beneath: roots, a waterwheel, the lighthouse wheel
  // -------------------------------------------------------------------------------
  _undercroft(r, above) {
    // a low landing for the start
    this._platform(r, -14, 3.6, 0, LANES.Y[2] - 0.02, 5.0, this.ruin, 0.9);
    this._rock(r.pointAt(-8, 0, -1.2, new THREE.Vector3()), 3.0);
    this._rock(r.pointAt(-2, 1, -1.4, new THREE.Vector3()), 2.4);

    // sea stacks along the left so this passage feels sheltered
    for (let b = 2; b < 62; b += 4.3) {
      if (this.rnd() < 0.3) continue;
      r.pointAt(b, -8.5 - this.rnd() * 5, 0, _a);
      const s = 1.2 + this.rnd() * 2.6;
      this._rock(new THREE.Vector3(_a.x, s * 0.25, _a.z), s);
    }

    // roots hang from the old columns of the road above and trail down into the water
    const drape = (col, radius, reachSide) => {
      const top = new THREE.Vector3(col.pos.x, col.top - 0.3, col.pos.z);
      const end = r.pointAt(col.beat + 0.4 + this.rnd() * 1.2, reachSide, -1.1, new THREE.Vector3());
      const out = top.clone().lerp(end, 0.22);
      out.y = top.y + 0.5 + this.rnd() * 0.6;
      const sag = top.clone().lerp(end, 0.55);
      sag.y = Math.max(0.9, top.y * 0.45) + this.rnd() * 0.8;
      sag.x += (this.rnd() - 0.5) * 1.6;
      const low = top.clone().lerp(end, 0.86);
      low.y = 0.5 + this.rnd() * 0.5;
      return this._root([top, out, sag, low, end], radius, false);
    };
    for (const col of this.leftColumns) {
      if (col.wakes || col.top < 2.2 || this.rnd() < 0.3) continue;
      drape(col, 0.2 + this.rnd() * 0.16, 5.6 + this.rnd() * 2.2);
      if (this.rnd() < 0.5) drape(col, 0.11 + this.rnd() * 0.07, 7.5 + this.rnd() * 2);
    }
    // the two roots the player wakes: each grows from a tall column and arches right over the passage
    const archRoot = (key, b) => {
      const col = this.leftColumns.find((c) => c.wakes && Math.abs(c.beat - b) < 0.5);
      const top = new THREE.Vector3(col.pos.x, col.top - 0.2, col.pos.z);
      const over = r.pointAt(b, 0.6, 5.4, new THREE.Vector3());
      const lead = top.clone().lerp(over, 0.45);
      lead.y = Math.max(top.y, over.y) + 0.9;
      const down = r.pointAt(b + 0.3, -6.0, 2.8, new THREE.Vector3());
      const end = r.pointAt(b + 0.6, -7.2, -1.0, new THREE.Vector3());
      const root = this._root([top, lead, over, down, end], 0.42, true);
      root.level = 0;
      root.target = 0;
      root.center = over.clone();
      this.roots[key] = root;
    };
    archRoot('root1', 5.3);
    archRoot('root2', 21.6);

    // the waterwheel
    r.pointAt(25.6, 6.0, 0.6, _a);
    this.wheel = this._wheel(_a.clone(), r.yawAt(25.6) + Math.PI / 2, 2.9, 'wheel');
    this._column(new THREE.Vector3(_a.x + 1.6, 0, _a.z), _a.y + 0.2, 0.7, true);
    this._column(new THREE.Vector3(_a.x - 1.6, 0, _a.z), _a.y + 0.2, 0.7, true);

    // the landing at the foot of the tower and the great wheel that waits there
    this._platform(r, 62.75, 72, LANES.X[0], -0.02, 6.0, this.ruinPale);
    this._rock(r.pointAt(67, LANES.X[0], -3.0, new THREE.Vector3()), 2.8);
    r.pointAt(66.5, 5.4, 2.6, _a);
    this.bigWheel = this._wheel(_a.clone(), r.yawAt(66.5) + Math.PI / 2, 3.7, 'lighthouseWheel');
  }

  // -------------------------------------------------------------------------------
  // III — around the tower
  // -------------------------------------------------------------------------------
  _spiral(r) {
    // a landing to begin from, floating where a stair once started
    this._platform(r, -13, 0.5, LANES.X[0], -0.02, 4.6, this.ruinPale, 0.8);
    this._rock(r.pointAt(-6, LANES.X[0], -1.6, new THREE.Vector3()), 2.2);

    // what is left of the old stair: dark steps hanging in the air beside the route
    const step = new THREE.InstancedMesh(this.slab, this.ruin, 54);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    let n = 0;
    for (let b = 1; b < 62 && n < 54; b += 1.18) {
      const stray = n % 5 === 4;
      const side = stray ? 6.2 + this.rnd() * 1.6 : -5.6 - (n % 2) * 0.5;
      r.pointAt(b, side, stray ? -1.8 - this.rnd() * 1.5 : -1.0 - (n % 3) * 0.12, _a);
      q.setFromEuler(new THREE.Euler(stray ? (this.rnd() - 0.5) * 0.4 : 0, r.yawAt(b) + (stray ? (this.rnd() - 0.5) * 0.9 : 0), stray ? (this.rnd() - 0.5) * 0.4 : 0));
      sc.set(stray ? 1.3 + this.rnd() : 2.3, 0.42, stray ? 1.3 + this.rnd() : 1.7 + (n % 2) * 0.3);
      mtx.compose(_a, q, sc);
      step.setMatrixAt(n++, mtx);
    }
    step.count = n;
    step.instanceMatrix.needsUpdate = true;
    this.group.add(step);

    // gulls asleep on the gallery rail
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.12, 0.62, 0, 0, 0, 0, -0.14, 0, 0, 0.12, -0.62, 0, 0, 0, 0, -0.14]), 3));
    wing.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, -1, 0]), 1));
    const gullMat = new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime, uFlap: { value: 0 }, uColor: { value: new THREE.Color(0xe6e2f0) }, uFogColor: G.uFogColor },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uFlap; attribute float aSide; varying float vShade;
        void main() {
          vec3 p = position;
          float ph = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.3;
          p.y += abs(aSide) * sin(uTime * 7.0 + ph) * 0.28 * uFlap - abs(aSide) * 0.1 * (1.0 - uFlap);
          p.x *= mix(0.35, 1.0, uFlap);
          vShade = 0.6 + 0.4 * abs(aSide);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vShade; void main(){ gl_FragColor = vec4(uColor * vShade * 0.75, 1.0); }`,
      side: THREE.DoubleSide,
    });
    this.gullMat = gullMat;
    const mid = r.pointAt(22, 0, 0, new THREE.Vector3());
    this.gullHome = mid;
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(wing, gullMat);
      m.scale.setScalar(1.5 + this.rnd() * 0.5);
      this.group.add(m);
      this.gulls.push({ mesh: m, a: this.rnd() * 6.28, r: 9 + this.rnd() * 9, h: this.rnd() * 5, speed: 0.35 + this.rnd() * 0.25, perch: new THREE.Vector3() });
    }
    this.gullsFlying = 0;
    this.gullsTarget = 0;

    // a constellation waiting above the high route
    this.stars = new THREE.Group();
    const f = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3() };
    r.frameAt(23.5, f);
    this.stars.position.copy(f.pos).addScaledVector(f.tan, 210).addScaledVector(UP, 110).addScaledVector(f.right, 40);
    // a kite, with its tail
    const pts = [[0, 30], [-18, 4], [0, -22], [18, 4], [0, 30], [0, -22], [6, -40], [-4, -56], [7, -72]];
    const linePos = [];
    this.starSprites = [];
    pts.forEach(([x, y], i) => {
      const s = glowSprite(0xfff2d0, 9, 0);
      s.position.set(x, y, 0);
      this.stars.add(s);
      this.starSprites.push(s);
      if (i > 0) linePos.push(pts[i - 1][0], pts[i - 1][1], 0, x, y, 0);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
    this.starLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.add(this.starLines);
    this.starLevel = 0;
    this.starTarget = 0;
    this.scene.add(this.stars);
  }

  _mist() {
    const mat = () => new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(0x7d789c), transparent: true, depthWrite: false, opacity: 0.05 });
    const r = this.routes[0];
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(mat());
      const b = -10 + this.rnd() * 80;
      r.pointAt(b, (this.rnd() - 0.5) * 120, 0, _a);
      s.position.set(_a.x, 1.5 + this.rnd() * 4, _a.z);
      const w = 40 + this.rnd() * 60;
      s.scale.set(w, w * 0.22, 1);
      s.material.opacity = 0.025 + this.rnd() * 0.045;
      this.scene.add(s);
      this.mist.push({ s, base: s.position.clone(), ph: this.rnd() * 6.28, op: s.material.opacity });
    }
  }

  // -------------------------------------------------------------------------------
  // Waking things
  // -------------------------------------------------------------------------------

  /**
   * @param {string} tag
   * @param {{instant?:boolean}} opts instant = restoring a saved world, no fanfare
   * @returns {THREE.Vector3|null} where it happened (for sound/camera), if anywhere
   */
  onAccent(tag, { instant = false } = {}) {
    this.awake.add(tag);
    const fx = this.effects;
    if (this.lanterns[tag]) {
      const l = this.lanterns[tag];
      l.target = 1;
      if (instant) l.level = 1;
      else {
        fx.burst(l.top, COLORS.GOLD, 36, 2.6, { up: 2.2, life: 1.3 });
        fx.rise(l.top, COLORS.GOLD, 14, 1.2, 4);
        this.sea.ripple(l.top.x, l.top.z, 1.2, COLORS.GOLD);
      }
      return l.top;
    }
    if (tag === 'chime') {
      if (!instant) {
        this.chime.vel = 3.4;
        fx.burst(this.chime.glow.position, COLORS.GOLD, 30, 2.0, { up: 0.6, life: 1.4 });
      }
      this.chime.rung = true;
      return this.chime.glow.position;
    }
    if (tag === 'fish') {
      for (const f of this.fish) {
        f.state = 'wait';
        f.timer = instant ? 2 + Math.random() * 8 : f.delay;
      }
      if (!instant) this.sea.ripple(this.pool.x, this.pool.z, 1.6, COLORS.TEAL);
      this.fishAwake = true;
      return this.pool;
    }
    if (this.roots[tag]) {
      const root = this.roots[tag];
      root.target = 1;
      if (instant) root.level = 1;
      else fx.rise(root.center, COLORS.GOLD, 34, 3.5, 6);
      if (!instant) {
        for (let i = 0; i < 12; i++) fx.sprout(root.curve.getPoint(0.2 + i * 0.06), 4, 0.5, { drop: -0.2 });
      } else {
        for (let i = 0; i < 12; i++) fx.sprout(root.curve.getPoint(0.2 + i * 0.06), 4, 0.5, { instant: true, drop: -0.2 });
      }
      return root.center;
    }
    if (tag === 'wheel') {
      this.wheel.target = 0.55;
      if (!instant) {
        this.wheel.speed = 1.8;
        fx.burst(this.wheel.pos, COLORS.TEAL, 40, 3.0, { up: 2.5 });
        this.sea.ripple(this.wheel.pos.x, this.wheel.pos.z, 1.5);
      }
      return this.wheel.pos;
    }
    if (tag === 'lighthouseWheel') {
      this.bigWheel.target = 0.4;
      if (!instant) {
        this.bigWheel.speed = 1.5;
        fx.burst(this.bigWheel.pos, COLORS.GOLD, 60, 3.6, { up: 3 });
        fx.rise(this.bigWheel.pos, COLORS.GOLD, 40, 4, 8);
        this.sea.ripple(this.bigWheel.pos.x, this.bigWheel.pos.z, 2.0, COLORS.GOLD);
      }
      return this.bigWheel.pos;
    }
    if (tag === 'gulls') {
      this.gullsTarget = 1;
      if (instant) this.gullsFlying = 1;
      return this.gullHome;
    }
    if (tag === 'stars') {
      this.starTarget = 1;
      if (instant) this.starLevel = 1;
      return this.stars.position;
    }
    return null;
  }

  /**
   * Gold leaves climb the old columns as each movement is finished: a third of them at a
   * time, so the place grows greener with every part of the song.
   */
  wakeVines(stage, instant = false) {
    if (this.vinesAwake[stage]) return;
    this.vinesAwake[stage] = true;
    this.columns.forEach((c, i) => {
      if (i % 3 !== stage || c.top < 1.5) return;
      const turns = 5 + (i % 4);
      for (let k = 0; k < turns; k++) {
        const a = k * 1.9 + i;
        const y = c.top - 0.2 - k * 0.42;
        if (y < 0.6) break;
        this.effects.sprout(new THREE.Vector3(c.pos.x + Math.cos(a) * c.radius, y, c.pos.z + Math.sin(a) * c.radius), 3, 0.28, { instant, drop: 0 });
      }
    });
  }

  reset() {
    this.awake.clear();
    this.vinesAwake = [false, false, false];
    for (const l of Object.values(this.lanterns)) l.level = l.target = 0;
    for (const root of Object.values(this.roots)) root.level = root.target = 0;
    for (const sp of this.spinners) sp.speed = sp.target = 0;
    this.gullsTarget = this.gullsFlying = 0;
    this.starTarget = this.starLevel = 0;
    this.fishAwake = false;
    for (const f of this.fish) {
      f.state = 'sleep';
      f.body.material.opacity = 0;
    }
    this.chime.rung = false;
  }

  update(dt, lighthouse) {
    const t = G.uTime.value;
    for (const l of Object.values(this.lanterns)) {
      l.level += (l.target - l.level) * Math.min(1, dt * 3);
      const k = l.level * (1 + 0.06 * Math.sin(t * 5 + l.top.x));
      l.coreMat.color.setRGB(0.08 + 3.2 * k, 0.085 + 2.2 * k, 0.12 + 0.9 * k);
      l.core.rotation.y = t * 0.8;
      l.glow.material.opacity = 0.75 * k;
    }
    // chime: a damped pendulum
    const c = this.chime;
    c.vel += (-c.swing * 26 - c.vel * 1.1) * dt;
    c.swing += c.vel * dt;
    c.group.rotation.set(Math.sin(c.yaw) * 0, 0, 0);
    c.group.rotation.z = c.swing * 0.5;
    const ring = Math.min(1, Math.abs(c.swing) * 2 + Math.abs(c.vel) * 0.25);
    this.chimeMat.uniforms.uGlow.value = (c.rung ? 0.25 : 0) + ring * 1.4;
    c.glow.material.opacity = (c.rung ? 0.18 : 0) + ring * 0.6;

    for (const root of Object.values(this.roots)) {
      root.level += (root.target - root.level) * Math.min(1, dt * 1.6);
      root.mat.uniforms.uGlow.value = root.level * (0.55 + 0.15 * Math.sin(t * 2.2));
      root.mat.uniforms.uWarm.value = root.level;
    }
    let turning = 0;
    for (const sp of this.spinners) {
      sp.speed += (sp.target - sp.speed) * Math.min(1, dt * 0.8);
      sp.spin.rotation.z -= sp.speed * dt;
      turning = Math.max(turning, sp.speed);
    }
    this.bronze.uniforms.uGlow.value = Math.min(0.35, turning * 0.3);
    this.bronze.uniforms.uWarm.value = Math.min(1, turning * 2);

    // fish: asleep as faint glows; once woken they leap across the low lanes, now and then
    for (const f of this.fish) {
      if (f.state === 'wait') {
        f.timer -= dt;
        if (f.timer <= 0) {
          const r = this.fishRoute;
          r.pointAt(8.9 + f.loop * 0.25 + f.delay * 2, -5.6, 0, f.from);
          r.pointAt(9.5 + f.loop * 0.25 + f.delay * 2, -0.6, 0, f.to);
          f.from.y = 0;
          f.to.y = 0;
          this.sea.ripple(f.from.x, f.from.z, 0.7);
          f.state = 'leap';
          f.t = 0;
        }
      } else if (f.state === 'leap') {
        f.t += dt;
        const u = f.t / 1.15;
        if (u >= 1) {
          this.sea.ripple(f.to.x, f.to.z, 0.9);
          f.body.material.opacity = 0;
          f.state = 'wait';
          f.timer = 6 + Math.random() * 7;
          f.loop = (f.loop + 1) % 3;
        } else {
          f.body.position.lerpVectors(f.from, f.to, u);
          f.body.position.y = Math.sin(Math.PI * u) * 3.3;
          f.body.material.opacity = Math.min(1, Math.sin(Math.PI * u) * 3);
          _a.subVectors(f.to, f.from).normalize();
          f.body.lookAt(f.body.position.x + _a.x, f.body.position.y + Math.cos(Math.PI * u) * 1.2, f.body.position.z + _a.z);
        }
      }
      f.hint.material.opacity = 0.05 + 0.03 * Math.sin(t * 1.3 + f.delay * 9) + (this.fishAwake ? 0.08 : 0);
    }

    // gulls
    this.gullsFlying += (this.gullsTarget - this.gullsFlying) * Math.min(1, dt * 0.9);
    this.gullMat.uniforms.uFlap.value = this.gullsFlying;
    if (lighthouse) {
      const L = lighthouse;
      this.gulls.forEach((g, i) => {
        const pa = (i / this.gulls.length) * Math.PI * 2;
        g.perch.set(L.center.x + Math.sin(pa) * 6.5, L.galleryY + 1.15, L.center.z + Math.cos(pa) * 6.5);
        g.a += g.speed * dt * this.gullsFlying;
        const fx = L.center.x + Math.sin(g.a) * g.r;
        const fz = L.center.z + Math.cos(g.a) * g.r;
        const fy = L.galleryY - 4 + g.h + Math.sin(t * 0.7 + i) * 1.5;
        const k = this.gullsFlying;
        g.mesh.position.set(g.perch.x + (fx - g.perch.x) * k, g.perch.y + (fy - g.perch.y) * k, g.perch.z + (fz - g.perch.z) * k);
        g.mesh.rotation.y = g.a + Math.PI / 2;
        g.mesh.rotation.z = -0.3 * k;
      });
    }

    // stars
    this.starLevel += (this.starTarget - this.starLevel) * Math.min(1, dt * 0.7);
    this.starSprites.forEach((s, i) => {
      s.material.opacity = Math.max(0, Math.min(1, this.starLevel * 1.6 - i * 0.07)) * (0.8 + 0.2 * Math.sin(t * 2 + i));
    });
    this.starLines.material.opacity = Math.max(0, this.starLevel - 0.45) * 0.9;

    for (const m of this.mist) {
      m.s.position.x = m.base.x + Math.sin(t * 0.03 + m.ph) * 14;
      m.s.material.opacity = m.op * (0.8 + 0.2 * Math.sin(t * 0.11 + m.ph * 3));
    }
  }
}
