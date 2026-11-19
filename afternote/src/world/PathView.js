// What the player's notes become. One PathView per movement; it turns the runner's
// pieces into geometry and keeps them alive for Echo replays and the World Reveal.
//
// Material language (bible §9.2):
//   stone   solid pale marble, engraved pitch letter, glowing rim       — a played note
//   bridge  continuous planks with rails of light                       — a held note
//   rescue  pale translucent planks, no engraving, no glow              — an absent note
//   ledge   the same pale planks after a hold was let go early
//   breath  a pale flowing current (or an old ruin slab)                — a marked rest

import * as THREE from 'three-afternote';
import { COLORS, STONE } from '../core/Constants.js';
import { noteName } from '../music/Theory.js';
import { pieceXYAt } from '../rules/Trajectory.js';
import {
  makeStylized, makeGlow, slabGeometry, ribbonGeometry, letterTexture, softDotTexture, marbleTexture, disposeObject, G,
} from './Shared.js';

let SLABS = null;
let LETTER_GEO = null;
function shared() {
  if (!SLABS) {
    SLABS = [1, 2, 3, 4, 5].map((s) => {
      const g = slabGeometry(s);
      g.userData.shared = true;
      return g;
    });
    LETTER_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).rotateY(Math.PI);
    LETTER_GEO.userData.shared = true;
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const easeOutBack = (u) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};

/** Light draining from under a newborn stone: falling streaks that fade in a few seconds. */
function curtainMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uBorn: { value: G.uTime.value }, uColor: { value: color.clone() } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBorn; uniform vec3 uColor; varying vec2 vUv;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
      void main(){
        float age = uTime - uBorn;
        float col = floor(vUv.x * 26.0);
        float r = h(col);
        float streak = smoothstep(0.5, 0.0, abs(fract(vUv.x * 26.0) - 0.5)) * step(0.35, r);
        float down = 1.0 - vUv.y;                       // 0 at the stone, 1 at the bottom
        float len = 0.35 + 0.65 * h(col + 3.0);
        float body = smoothstep(len, 0.0, down) * smoothstep(0.0, 0.05, down + 0.02);
        float drip = 0.6 + 0.4 * sin(down * 22.0 - uTime * (3.0 + r * 4.0) + r * 20.0);
        float fade = smoothstep(0.0, 0.15, age) * exp(-age * 0.9);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float a = streak * body * drip * fade * edge;
        gl_FragColor = vec4(uColor * a * 1.3, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

const CURTAIN_GEO = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
CURTAIN_GEO.userData.shared = true;

function letterMaterial(pitch) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: letterTexture(noteName(pitch)) },
      uInk: { value: new THREE.Color(0x4a3a2c) },
      uLight: { value: new THREE.Color(COLORS.PITCH[pitch]).lerp(new THREE.Color(COLORS.GOLD), 0.35) },
      uGlow: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uInk; uniform vec3 uLight; uniform float uGlow; uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        float a = texture2D(uMap, vUv).a;
        vec3 col = mix(uInk, uLight * 2.4, clamp(uGlow, 0.0, 1.0));
        gl_FragColor = vec4(col, a * uOpacity * (0.72 + 0.28 * clamp(uGlow, 0.0, 1.0)));
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

export class PathView {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./Routes.js').Route} route
   * @param {{ index:number }} opts
   */
  constructor(scene, route, { index = 0 } = {}) {
    shared();
    this.scene = scene;
    this.route = route;
    this.index = index;
    this.group = new THREE.Group();
    this.group.name = `path-${index}`;
    scene.add(this.group);
    this.items = []; // { piece, kind, ... }
    this.bySlot = new Map(); // slotB -> stone item (for pulses)
    this.arcBySlot = new Map(); // slotB -> the ribbon of the leap onto it
    this.animating = new Set();
    this.ghost = 1;
  }

  // -------------------------------------------------------------------------------
  // Placement helpers
  // -------------------------------------------------------------------------------

  /** Position + orient `obj` to lie along the route between two beats on a lane offset. Returns the length. */
  _place(obj, beatA, beatB, x, y, xB = x, yB = y) {
    this.route.pointAt(beatA, x, y, _a);
    this.route.pointAt(beatB, xB, yB, _b);
    obj.position.copy(_a).add(_b).multiplyScalar(0.5);
    _z.subVectors(_b, _a);
    const len = _z.length();
    if (len < 1e-5) _z.set(0, 0, -1);
    else _z.multiplyScalar(1 / len);
    _x.crossVectors(UP, _z).normalize();
    _y.crossVectors(_z, _x).normalize();
    _m.makeBasis(_x, _y, _z);
    obj.quaternion.setFromRotationMatrix(_m);
    return len;
  }

  _matrixFor(beatA, beatB, x, y, width, thickness, gap, out) {
    this.route.pointAt(beatA, x, y, _a);
    this.route.pointAt(beatB, x, y, _b);
    const pos = _a.clone().add(_b).multiplyScalar(0.5);
    _z.subVectors(_b, _a);
    const len = Math.max(0.05, _z.length());
    _z.normalize();
    _x.crossVectors(UP, _z).normalize();
    _y.crossVectors(_z, _x).normalize();
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    _s.set(width, thickness, Math.max(0.05, len - gap));
    return out.compose(pos, _q, _s);
  }

  // -------------------------------------------------------------------------------
  // Building
  // -------------------------------------------------------------------------------

  /** Old intact causeway that exists before the player arrives (ruin-style breaths). */
  prebuildRuins(spans) {
    const mat = makeStylized({ color: COLORS.RUIN, shade: COLORS.RUIN_DARK, grain: 0.5, grainScale: 1.4, rim: 0.45, flat: true });
    for (const span of spans) {
      const { x, y } = pieceXYAt({ kind: 'stone', lane: span.lane }, 0);
      const step = 0.82;
      let k = 0;
      for (let b = span.b0; b < span.b1 - 0.05; b += step, k++) {
        const end = Math.min(span.b1, b + step);
        const mesh = new THREE.Mesh(SLABS[(k + 2) % SLABS.length], mat);
        const holder = new THREE.Group();
        const len = this._place(holder, b, end, x, y - 0.03 - (k % 2) * 0.03);
        mesh.scale.set(STONE.WIDTH * (1.25 + (k % 3) * 0.12), 0.7, Math.max(0.3, len - 0.1));
        mesh.rotation.y = ((k * 37) % 7 - 3) * 0.012;
        holder.add(mesh);
        this.group.add(holder);
      }
    }
  }

  /**
   * Add the visual for a runner piece.
   * @param {object} piece
   * @param {{instant?:boolean, beat?:number}} opts instant = no birth animation (rebuild from a record)
   */
  addPiece(piece, { instant = false } = {}) {
    switch (piece.kind) {
      case 'stone': return this._addStone(piece, instant);
      case 'bridge': return this._addBridge(piece, instant);
      case 'rescue':
      case 'ledge': return this._addPale(piece, instant);
      case 'breath': return piece.style === 'ruin' ? null : this._addCurrent(piece, instant);
      default: return null;
    }
  }

  /** Rebuild a whole movement from its record, with nothing animating. */
  buildFromRecord(record) {
    for (const piece of record.pieces) this.addPiece(piece, { instant: true });
    for (const seg of record.segs) if (seg.kind === 'leap') this.addLeap(seg, { instant: true });
  }

  /**
   * A ribbon of light along a leap: the line of the melody drawn in the air.
   * @param {object} seg a 'leap' segment from the runner
   */
  addLeap(seg, { instant = false } = {}) {
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const sm = u * u * (3 - 2 * u);
      const x = seg.x0 + (seg.x1 - seg.x0) * sm;
      const y = seg.y0 + (seg.y1 - seg.y0) * u + seg.arc * 4 * u * (1 - u);
      pts.push(this.route.pointAt(seg.t0 + (seg.t1 - seg.t0) * u, x, y + 0.42, new THREE.Vector3()));
    }
    const mat = makeGlow({ color: COLORS.GOLD, intensity: instant ? 0.34 : 1.6, flow: 3 });
    const mesh = new THREE.Mesh(ribbonGeometry(pts, 0.13), mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const item = { kind: 'arc', group: mesh, mat, n, born: instant ? -100 : G.uTime.value, flash: 0, piece: null };
    this.items.push(item);
    if (seg.slotB !== null && seg.slotB !== undefined) this.arcBySlot.set(seg.slotB, item);
    if (!instant) {
      mesh.geometry.setDrawRange(0, 0);
      this.animating.add(item);
    }
    return item;
  }

  _stoneMaterial(pitch) {
    const edge = new THREE.Color(COLORS.PITCH[pitch]).lerp(new THREE.Color(COLORS.GOLD), 0.45);
    return makeStylized({
      color: COLORS.MARBLE, shade: COLORS.MARBLE_SHADE, map: marbleTexture(), grain: 0.14, grainScale: 2.2,
      rim: 0.7, warm: 1, edgeGlow: 0.6, edgeColor: edge, emissive: edge, glow: 0,
    });
  }

  _addStone(piece, instant) {
    const { x, y } = pieceXYAt(piece, 0);
    const mat = this._stoneMaterial(piece.p);
    const group = new THREE.Group();
    const parts = [];

    // head stone, then smaller followers for the rest of a long note
    const upb = Math.max(0.5, this.route.speedAt((piece.b0 + piece.b1) / 2));
    const headBeats = Math.min(piece.b1 - piece.b0, STONE.HEAD_BEATS * (3.3 / upb) + 0.15);
    const spans = [[piece.b0, piece.b0 + headBeats, 1]];
    let b = piece.b0 + headBeats;
    const trail = STONE.TRAIL_BEATS * (3.3 / upb);
    while (b < piece.b1 - 0.12) {
      const e = piece.b1 - b < trail * 1.5 ? piece.b1 : b + trail;
      spans.push([b, e, 0]);
      b = e;
    }
    const seed = Math.abs(Math.round(piece.slotB * 7 + piece.p * 3));
    spans.forEach(([s0, s1, isHead], i) => {
      const holder = new THREE.Group();
      const len = this._place(holder, s0, s1, x, y);
      const mesh = new THREE.Mesh(SLABS[(seed + i) % SLABS.length], mat);
      const w = isHead ? STONE.WIDTH : STONE.WIDTH * (0.62 + ((seed + i * 5) % 4) * 0.05);
      const t = isHead ? STONE.THICKNESS : STONE.THICKNESS * 0.7;
      mesh.userData.target = new THREE.Vector3(w, t, Math.max(0.2, len - STONE.GAP));
      mesh.scale.copy(mesh.userData.target);
      if (!isHead) holder.rotateY((((seed + i * 3) % 5) - 2) * 0.035);
      holder.add(mesh);
      group.add(holder);
      parts.push({ holder, mesh, delay: i * 0.075, baseY: holder.position.y });
    });

    // engraved letter on the head
    const head = parts[0];
    const letterMat = letterMaterial(piece.p);
    const letter = new THREE.Mesh(LETTER_GEO, letterMat);
    const size = Math.min(STONE.WIDTH * 0.8, head.mesh.userData.target.z * 0.8);
    letter.scale.set(size, 1, size);
    letter.position.y = 0.012;
    letter.renderOrder = 2;
    letter.visible = PathView.showLetters;
    head.holder.add(letter);

    // soft halo that blooms at birth
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDotTexture(), color: mat.uniforms.uEdgeColor.value.clone(), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0,
    }));
    halo.position.copy(head.holder.position);
    halo.scale.setScalar(3);
    group.add(halo);

    // a curtain of light drains from beneath the stone as it forms
    let curtain = null;
    if (!instant) {
      curtain = new THREE.Mesh(CURTAIN_GEO, curtainMaterial(mat.uniforms.uEdgeColor.value));
      curtain.position.copy(head.holder.position);
      curtain.position.y -= STONE.THICKNESS * 0.7;
      curtain.quaternion.copy(head.holder.quaternion);
      curtain.scale.set(STONE.WIDTH * 0.92, 2.6, 1);
      curtain.renderOrder = 1;
      group.add(curtain);
    }

    this.group.add(group);
    const item = {
      piece, kind: 'stone', group, parts, mat, letterMat, halo, curtain,
      born: instant ? -100 : G.uTime.value, flash: 0, idle: piece.q === 'perfect' ? 0.34 : 0.26,
      center: head.holder.position.clone(),
    };
    this.items.push(item);
    this.bySlot.set(piece.slotB, item);
    if (!instant) {
      for (const p of parts) p.mesh.scale.setScalar(0.001);
      this.animating.add(item);
    } else {
      mat.uniforms.uEdgeGlow.value = item.idle;
    }
    return item;
  }

  _addBridge(piece, instant) {
    const { x, y } = pieceXYAt(piece, 0);
    const edge = new THREE.Color(COLORS.PITCH[piece.p]).lerp(new THREE.Color(COLORS.GOLD), 0.45);
    const mat = makeStylized({
      color: COLORS.MARBLE, shade: COLORS.MARBLE_SHADE, map: marbleTexture(), grain: 0.1, grainScale: 2.2,
      rim: 0.8, warm: 1, edgeGlow: 0.5, edgeColor: edge, emissive: edge, glow: 0.03,
    });
    // planks are laid out for the whole possible span; how many show follows the held note
    const full = this._fullEnd(piece);
    const step = 0.25;
    const count = Math.max(1, Math.ceil((full - piece.b0) / step));
    const planks = new THREE.InstancedMesh(SLABS[0], mat, count);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const s0 = piece.b0 + i * step;
      const s1 = Math.min(full, s0 + step);
      this._matrixFor(s0, s1, x, y, STONE.WIDTH * 0.86, 0.2, 0.05, mtx);
      planks.setMatrixAt(i, mtx);
    }
    planks.instanceMatrix.needsUpdate = true;
    planks.frustumCulled = false;
    planks.count = 0;

    // rails of light along both edges
    const pts = { l: [], r: [] };
    const n = Math.max(2, Math.ceil((full - piece.b0) / 0.125));
    for (let i = 0; i <= n; i++) {
      const bb = piece.b0 + ((full - piece.b0) * i) / n;
      pts.l.push(this.route.pointAt(bb, x - STONE.WIDTH * 0.46, y + 0.06, new THREE.Vector3()));
      pts.r.push(this.route.pointAt(bb, x + STONE.WIDTH * 0.46, y + 0.06, new THREE.Vector3()));
    }
    const railMat = makeGlow({ color: edge, intensity: 0.9, flow: 7 });
    const rails = [new THREE.Mesh(ribbonGeometry(pts.l, 0.16), railMat), new THREE.Mesh(ribbonGeometry(pts.r, 0.16), railMat)];
    for (const r of rails) {
      r.frustumCulled = false;
      r.geometry.setDrawRange(0, 0);
    }
    // the forming edge: a bright mote that rides the front of the bridge
    const front = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDotTexture(), color: edge, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    front.scale.setScalar(1.7);

    const group = new THREE.Group();
    group.add(planks, rails[0], rails[1], front);
    this.group.add(group);
    const item = { piece, kind: 'bridge', group, planks, rails, front, mat, railMat, count, step, n, full, x, y, born: G.uTime.value, flash: 0, shown: 0 };
    this.items.push(item);
    this.bySlot.set(piece.slotB, item);
    if (instant) this._revealBridge(item, piece.b1);
    else this.animating.add(item);
    return item;
  }

  /** The furthest a bridge could reach if held to the end (used to lay out planks once). */
  _fullEnd(piece) {
    return piece.fullEnd ?? piece.b1 + 0.6;
  }

  _revealBridge(item, toBeat) {
    const { piece, planks, rails, count, step, n, full } = item;
    const span = Math.max(0, Math.min(toBeat, full) - piece.b0);
    planks.count = Math.min(count, Math.ceil(span / step));
    const frac = Math.min(1, span / (full - piece.b0));
    const segs = Math.floor(frac * n);
    for (const r of rails) r.geometry.setDrawRange(0, segs * 6);
    item.shown = toBeat;
  }

  _addPale(piece, instant) {
    const { x, y } = pieceXYAt(piece, 0);
    const mat = makeStylized({
      color: COLORS.RESCUE, shade: 0x7d8aa0, grain: 0.05, rim: 1.2, warm: 1, transparent: true, opacity: instant ? 0.5 : 0,
    });
    const step = 0.42;
    const count = Math.max(1, Math.ceil((piece.b1 - piece.b0) / step));
    const planks = new THREE.InstancedMesh(SLABS[1], mat, count);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const s0 = piece.b0 + i * step;
      const s1 = Math.min(piece.b1, s0 + step);
      this._matrixFor(s0, s1, x, y - 0.02, STONE.WIDTH * 0.7, 0.12, 0.16, mtx);
      planks.setMatrixAt(i, mtx);
    }
    planks.instanceMatrix.needsUpdate = true;
    planks.frustumCulled = false;
    planks.renderOrder = 1;
    this.group.add(planks);
    const item = { piece, kind: 'pale', group: planks, mat, born: G.uTime.value, b1: piece.b1, step, count };
    this.items.push(item);
    if (!instant) this.animating.add(item);
    return item;
  }

  _addCurrent(piece, instant) {
    const pts = [];
    const widths = [];
    const n = Math.max(3, Math.ceil((piece.b1 - piece.b0) / 0.125));
    for (let i = 0; i <= n; i++) {
      const b = piece.b0 + ((piece.b1 - piece.b0) * i) / n;
      const p = pieceXYAt(piece, b);
      pts.push(this.route.pointAt(b, p.x, p.y - 0.02, new THREE.Vector3()));
      const u = i / n;
      if (piece.rest) widths.push(0.72 * Math.min(1, (b - piece.b0) / 0.3 + 0.15) * Math.min(1, (piece.b1 - b) / 0.3 + 0.15));
      else widths.push(1.25 * Math.min(1, u * 6) * Math.min(1, (1 - u) * 6 + 0.25));
    }
    const mat = makeGlow({ color: COLORS.BREATH, intensity: piece.rest ? 0.42 : 0.55, flow: 5 });
    const mesh = new THREE.Mesh(ribbonGeometry(pts, 1.25, widths), mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const item = { piece, kind: 'current', group: mesh, mat, n, born: G.uTime.value };
    this.items.push(item);
    if (instant) mat.uniforms.uOpacity.value = 0.35;
    else {
      mesh.geometry.setDrawRange(0, 0);
      this.animating.add(item);
    }
    return item;
  }

  // -------------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------------

  /** Light a stone as something (an Echo, the reveal) steps on it. */
  pulse(slotB, strength = 1) {
    const item = this.bySlot.get(slotB);
    if (!item) return null;
    item.flash = Math.max(item.flash, strength);
    this.animating.add(item);
    const arc = this.arcBySlot.get(slotB);
    if (arc) {
      arc.flash = Math.max(arc.flash, strength);
      this.animating.add(arc);
    }
    return item;
  }

  /** World position of the head of the surface built at a slot, or null. */
  centerOf(slotB, target) {
    const item = this.bySlot.get(slotB);
    if (!item) return null;
    if (item.center) return target.copy(item.center);
    return this.route.pointAt(item.piece.b0 + 0.4, item.x, item.y, target);
  }

  /** Show or hide the engraved note letters on every stone of this path. */
  setLettersVisible(v) {
    for (const item of this.items) {
      if (item.kind !== 'stone') continue;
      for (const child of item.parts[0].holder.children) if (child.material === item.letterMat) child.visible = v;
    }
  }

  /** Fade the whole path (used while a movement is being replaced). */
  setGhost(v) {
    this.ghost = v;
    this.group.visible = v > 0.02;
  }

  // -------------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------------

  update(beat, dt) {
    const now = G.uTime.value;
    for (const item of this.animating) {
      let busy = false;
      if (item.kind === 'stone') {
        const age = now - item.born;
        for (const p of item.parts) {
          const u = Math.min(1, Math.max(0, (age - p.delay) / 0.34));
          const e = u <= 0 ? 0.001 : easeOutBack(u);
          const t = p.mesh.userData.target;
          p.mesh.scale.set(t.x * e, t.y * Math.max(0.001, u), t.z * e);
          p.holder.position.y = p.baseY - (1 - u) * 0.7;
          if (u < 1) busy = true;
        }
        const birth = Math.max(0, 1 - age / 1.3);
        item.flash = Math.max(0, item.flash - dt * 1.9);
        const glow = item.idle + birth * birth * 0.95 + item.flash * 0.9;
        item.mat.uniforms.uEdgeGlow.value = glow;
        item.mat.uniforms.uGlow.value = birth * birth * 0.1 + item.flash * 0.08;
        item.letterMat.uniforms.uGlow.value = Math.min(1, birth * 1.2 + item.flash);
        item.halo.material.opacity = Math.max(birth * birth * 0.3, item.flash * 0.2);
        item.halo.scale.setScalar(2.4 + (1 - birth) * 2.4 + item.flash);
        if (item.curtain && age > 6) {
          item.group.remove(item.curtain);
          item.curtain.material.dispose();
          item.curtain = null;
        }
        if (birth > 0 || item.flash > 0 || item.curtain) busy = true;
      } else if (item.kind === 'arc') {
        const age = now - item.born;
        const birth = Math.max(0, 1 - age / 1.6);
        item.flash = Math.max(0, item.flash - dt * 1.8);
        const frac = Math.min(1, age / 0.28);
        item.group.geometry.setDrawRange(0, Math.floor(frac * item.n) * 6);
        item.mat.uniforms.uIntensity.value = 0.34 + birth * 1.3 + item.flash * 1.4;
        if (birth > 0 || item.flash > 0 || frac < 1) busy = true;
      } else if (item.kind === 'bridge') {
        const piece = item.piece;
        const target = piece.growing ? Math.min(beat + 0.55, item.full) : piece.b1;
        if (piece.growing || Math.abs(item.shown - target) > 1e-4) this._revealBridge(item, target);
        item.flash = Math.max(0, item.flash - dt * 1.6);
        item.mat.uniforms.uEdgeGlow.value = 0.3 + (piece.growing ? 0.28 + 0.08 * Math.sin(now * 14) : 0) + item.flash * 0.8;
        item.railMat.uniforms.uIntensity.value = 0.8 + (piece.growing ? 0.9 : 0) + item.flash * 1.2;
        this.route.pointAt(Math.min(target, item.full), item.x, item.y + 0.2, item.front.position);
        item.front.material.opacity = piece.growing ? 0.6 : Math.max(0, item.front.material.opacity - dt * 3);
        item.front.visible = item.front.material.opacity > 0.01;
        if (piece.growing || item.flash > 0 || item.front.visible) busy = true;
      } else if (item.kind === 'pale') {
        const age = now - item.born;
        item.mat.uniforms.uOpacity.value = Math.min(0.5, age * 2.2);
        if (item.piece.b1 !== item.b1) {
          // a hold was joined late: the rescue surface stops where the bridge takes over
          item.b1 = item.piece.b1;
          item.group.count = Math.max(1, Math.min(item.count, Math.ceil((item.b1 - item.piece.b0) / item.step)));
        }
        if (age < 0.4) busy = true;
      } else if (item.kind === 'current') {
        const age = now - item.born;
        const frac = Math.min(1, age / 0.5);
        item.group.geometry.setDrawRange(0, Math.floor(frac * item.n) * 6);
        const passed = beat > item.piece.b1 + 0.5;
        const op = item.mat.uniforms.uOpacity;
        op.value += ((passed ? 0.3 : 1) - op.value) * Math.min(1, dt * 2.5);
        if (frac < 1 || !passed || Math.abs(op.value - 0.3) > 0.01) busy = true;
      }
      if (!busy) this.animating.delete(item);
    }
  }

  dispose() {
    disposeObject(this.group);
    this.items.length = 0;
    this.bySlot.clear();
    this.arcBySlot.clear();
    this.animating.clear();
  }
}

/** Whether newly built stones carry their engraved note letter (the 'Keys only' label mode hides them). */
PathView.showLetters = true;
