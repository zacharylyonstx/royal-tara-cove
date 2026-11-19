// Everything visible. The World owns the scene and turns rule events into sights:
// a stone growing, the sea answering, a lantern waking. It decides nothing about play.

import * as THREE from 'three-afternote';
import { CAMERA, COLORS, LANES } from '../core/Constants.js';
import { LIGHTHOUSE } from '../music/charts/lighthouse.js';
import { kiteStateAt, pieceXYAt } from '../rules/Trajectory.js';
import { G, makeGlow, ribbonGeometry, refreshLetterTextures } from './Shared.js';
import { buildLighthouseRoutes } from './Routes.js';
import { Sky } from './Sky.js';
import { Sea } from './Sea.js';
import { Lighthouse } from './Lighthouse.js';
import { Scenery } from './Scenery.js';
import { Effects } from './Effects.js';
import { PathView } from './PathView.js';
import { SeedView } from './SeedView.js';
import { KiteModel } from './KiteView.js';
import { CameraRig } from './CameraRig.js';
import { PostFX } from './PostFX.js';
import { SeaWorld } from './SeaWorld.js';

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const PANEL_FOR = { panel1: [0, 1], panel2: [2, 3], panel3: [4, 5], panel4: [6, 7] };

export class World {
  constructor(renderer, { fx = true } = {}) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.FOV, 1, CAMERA.NEAR, CAMERA.FAR);
    this.rig = new CameraRig(this.camera);

    this.routes = buildLighthouseRoutes(LIGHTHOUSE.movements);
    this.sky = new Sky(this.scene);
    this.sea = new Sea(this.scene, this.sky.uniforms);
    this.lighthouse = new Lighthouse(this.scene);
    this.sea.uniforms.uIsland.value.copy(this.lighthouse.center);
    this.effects = new Effects(this.scene);
    this.scenery = new Scenery(this.scene, this.routes, { effects: this.effects, sea: this.sea });
    this.seaWorld = new SeaWorld(this.scene, { effects: this.effects, sea: this.sea });
    this.seeds = new SeedView(this.scene);
    this.kite = new KiteModel(this.scene);
    this.paths = [null, null, null];
    this.oldPaths = [null, null, null]; // the path being replaced, kept as a ghost until the new one is finished
    this.ghosts = [null, null, null];
    this.arcs = [[], [], []]; // resonance arcs, grouped by the movement that made them
    this.post = new PostFX(renderer, this.scene, this.camera, { enabled: fx });

    this.awakeTarget = 0;
    this.kiteState = { pose: 'idle', air: false, u: 1, airHeight: 0 };
    this.kitePos = new THREE.Vector3();
    this.kiteYaw = 0;
    this.override = null; // { pos, yaw, pose } set by the Conductor during cinematics
    this.reducedMotion = false;
    this.lastBeat = null;
    // the dusk as it is by default, and what a crossing's mood is turning it toward
    this.skyBase = {
      top: this.sky.uniforms.uSkyTop.value.clone(), mid: this.sky.uniforms.uSkyMid.value.clone(),
      horizon: this.sky.uniforms.uSkyHorizon.value.clone(), fog: G.uFogColor.value.clone(),
    };
    this.skyGoal = null;
    this._skyTmp = new THREE.Color();

    if (document.fonts?.ready) document.fonts.ready.then(() => refreshLetterTextures());
  }

  resize(w, h, pixelRatio) {
    this.camera.aspect = w / h;
    // keep the horizontal view on tall phones so the lanes never fall off the sides
    this.rig.fovTarget = this.camera.aspect < 1.2 ? CAMERA.FOV + (1.2 - this.camera.aspect) * 34 : CAMERA.FOV;
    this.camera.fov = this.rig.fov = this.rig.fovTarget;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, pixelRatio);
    this.effects.setViewport(h, pixelRatio);
  }

  /**
   * How things are labelled.
   * @param {'both'|'keys'|'notes'} mode
   * @param {string[]} keyLabels  what is printed on each of the five keys
   * @param {boolean} keyboard    false on touch-only devices: no keycaps in the world
   */
  setLabels(mode, keyLabels, keyboard) {
    const notes = mode !== 'keys' || !keyboard;
    this.seeds.showNames = notes;
    this.seeds.showCaps = mode !== 'notes' && keyboard;
    this.seeds.keyLabels = keyLabels;
    PathView.showLetters = notes;
    for (const p of [...this.paths, ...this.oldPaths]) if (p) p.setLettersVisible(notes);
    this.seaWorld.setLettersVisible(notes);
  }

  /** Turn the light toward a mood's colours ({top, mid, horizon, fog} as hex), or back to dusk with null. */
  setSky(sky) {
    this.skyGoal = sky ? {
      top: new THREE.Color(sky.top), mid: new THREE.Color(sky.mid), horizon: new THREE.Color(sky.horizon), fog: new THREE.Color(sky.fog),
    } : null;
  }

  _updateSky(dt) {
    const goal = this.skyGoal ?? this.skyBase;
    const k = Math.min(1, dt * 0.55);
    const u = this.sky.uniforms;
    u.uSkyTop.value.lerp(goal.top, k);
    u.uSkyMid.value.lerp(goal.mid, k);
    u.uSkyHorizon.value.lerp(goal.horizon, k);
    G.uFogColor.value.lerp(goal.fog, k);
  }

  // -------------------------------------------------------------------------------
  // Movements and records
  // -------------------------------------------------------------------------------

  /** Prepare to perform movement i. If it already has a path, that becomes a faint ghost. */
  beginMovement(i, runner) {
    if (this.paths[i]) {
      if (this.oldPaths[i]) this.oldPaths[i].dispose();
      this.oldPaths[i] = this.paths[i];
      this.oldPaths[i].group.visible = false;
    }
    const view = new PathView(this.scene, this.routes[i], { index: i });
    const ruins = runner.breaths
      .map((br, k) => ({ br, k }))
      .filter(({ br }) => br.style === 'ruin')
      .map(({ br, k }) => ({ b0: br.b - 0.06, b1: runner._breathCoverEnd(k), lane: br.lane }));
    view.prebuildRuins(ruins);
    this.paths[i] = view;
    this.seeds.clear();
  }

  /** The replay was abandoned: put the old path back. */
  cancelReplace(i) {
    if (!this.oldPaths[i]) return;
    this.paths[i]?.dispose();
    this.paths[i] = this.oldPaths[i];
    this.paths[i].group.visible = true;
    this.oldPaths[i] = null;
  }

  /** The replay finished: the old path and its crossings are gone for good. */
  commitReplace(i) {
    if (this.oldPaths[i]) {
      this.oldPaths[i].dispose();
      this.oldPaths[i] = null;
    }
  }

  clearArcs(i) {
    for (const a of this.arcs[i]) {
      this.scene.remove(a);
      a.geometry.dispose();
      a.material.dispose();
    }
    this.arcs[i] = [];
  }

  /** Rebuild the whole restored island from saved records, with no fanfare. */
  restore(records, charts) {
    this.scenery.reset();
    this.lighthouse.reset();
    records.forEach((rec, i) => {
      if (!rec) return;
      if (this.paths[i]) this.paths[i].dispose();
      const view = new PathView(this.scene, this.routes[i], { index: i });
      const ruins = charts[i].events.filter((e) => e.k === 'breath' && e.style === 'ruin');
      const spans = rec.pieces.filter((p) => p.kind === 'breath' && p.style === 'ruin').map((p) => ({ b0: p.b0, b1: p.b1, lane: p.lane }));
      if (ruins.length) view.prebuildRuins(spans);
      view.buildFromRecord(rec);
      this.paths[i] = view;
      for (const piece of rec.pieces) if (piece.kind === 'stone' || piece.kind === 'bridge') this._sproutAt(i, piece, true);
      for (const e of rec.entries) {
        if (e.outcome === 'hit' && e.accent) this.applyAccent(e.accent, { instant: true });
        if (e.res) this._arcFor(i, e, records, true);
      }
      this.completeLandmark(i, true);
    });
  }

  /** What always happens when a movement ends, however it was played. */
  completeLandmark(i, instant = false) {
    this.scenery.wakeVines(i, instant);
    if (i === 0) this.scenery.onAccent('lantern3', { instant: instant || this.scenery.awake.has('lantern3') });
    if (i === 1) {
      this.scenery.onAccent('lighthouseWheel', { instant: instant || this.scenery.awake.has('lighthouseWheel') });
      this.lighthouse.lightWindows(instant);
    }
    if (i === 2 && instant) this.lighthouse.ignite(true);
  }

  // -------------------------------------------------------------------------------
  // Rule events -> sights
  // -------------------------------------------------------------------------------

  /**
   * @param {object} ev  an event from the runner
   * @param {number} mvt  the lighthouse movement being played
   * @param {{path:object, route:object}|null} target  set when a sea crossing is being played instead
   * @returns {THREE.Vector3|null} where a world sound should come from, if any
   */
  onRunnerEvent(ev, mvt, target = null) {
    const path = target ? target.path : this.paths[mvt];
    const route = target ? target.route : this.routes[mvt];
    const fx = this.effects;
    switch (ev.type) {
      case 'hit': {
        const piece = ev.piece;
        path.addPiece(piece);
        if (ev.seg) path.addLeap(ev.seg);
        const xy = pieceXYAt(piece, 0);
        route.pointAt(piece.b0 + 0.35, xy.x, xy.y, _p);
        const col = COLORS.PITCH[piece.p];
        if (piece.kind === 'stone') {
          fx.burst(_p, col, ev.entry.q === 'perfect' ? 30 : 16, ev.entry.q === 'perfect' ? 2.8 : 2.0, { up: 1.6 });
          fx.drips(_p, col, 10, 1.3);
          if (!target) this._sproutAt(mvt, piece, false);
        } else {
          fx.burst(_p, col, 18, 2.2, { up: 1.4 });
        }
        this.sea.ripple(_p.x, _p.z, 0.75 + (ev.entry.q === 'perfect' ? 0.35 : 0), mvt === 1 ? COLORS.GOLD : COLORS.TEAL);
        this.kite.flash(col, 1);
        break;
      }
      case 'hold:end': {
        if (ev.full) {
          const piece = ev.piece;
          const xy = pieceXYAt(piece, 0);
          route.pointAt(piece.b1 - 0.2, xy.x, xy.y, _p);
          fx.burst(_p, COLORS.PITCH[piece.p], 26, 2.4, { up: 1.8 });
          if (!target) this._sproutAt(mvt, piece, false);
          this.sea.ripple(_p.x, _p.z, 1.0);
        }
        break;
      }
      case 'hold:broken':
        path.addPiece(ev.ledge);
        break;
      case 'miss':
      case 'rescue':
        if (ev.piece && !path.items.some((it) => it.piece === ev.piece)) path.addPiece(ev.piece);
        break;
      case 'breath':
      case 'rest':
        path.addPiece(ev.piece);
        break;
      case 'resonance':
        return this._arcFor(mvt, ev.entry, null, false, ev);
      case 'accent':
        return this.applyAccent(ev.tag, {});
      default:
        break;
    }
    return null;
  }

  applyAccent(tag, opts = {}) {
    const L = this.lighthouse;
    if (PANEL_FOR[tag]) {
      L.lightPanel(PANEL_FOR[tag], opts.instant);
      if (!opts.instant) this.effects.burst(L.lensPos, COLORS.GOLD, 26, 4, { up: 1, life: 1.4, size: 0.7 });
      return L.lensPos;
    }
    if (tag === 'lensHalf1') { L.setLens(0.45, opts.instant); return L.lensPos; }
    if (tag === 'lensHalf2') { L.setLens(0.75, opts.instant); return L.lensPos; }
    if (tag === 'lens') { L.setLens(0.92, opts.instant); return L.lensPos; }
    if (tag === 'firstStone') {
      if (!opts.instant) {
        this.routes[0].pointAt(-4.2, LANES.X[0], 0, _p);
        this.sea.ripple(_p.x, _p.z, 2.2, COLORS.TEAL);
      }
      return null;
    }
    return this.scenery.onAccent(tag, opts);
  }

  _sproutAt(mvt, piece, instant) {
    const route = this.routes[mvt];
    const xy = pieceXYAt(piece, 0);
    const span = piece.b1 - piece.b0;
    const n = piece.kind === 'bridge' ? Math.ceil(span * 2) : 2;
    for (let i = 0; i < n; i++) {
      const b = piece.b0 + (span * (i + 0.5)) / n;
      for (const side of [-1, 1]) {
        if (piece.kind === 'stone' && i === 0 && side === -1 && (piece.slotB * 3) % 2 === 0) continue;
        route.pointAt(b, xy.x + side * 0.72, xy.y, _q);
        this.effects.sprout(_q, 3, 0.22, { instant, drop: 0.12 });
      }
    }
  }

  /** A bridge of light between an Echo's stone and the note that answered it. */
  _arcFor(mvt, entry, records, instant, ev = null) {
    const slotB = entry.b;
    const chart = LIGHTHOUSE.movements[mvt];
    const slotDef = chart.events.find((e) => e.k === 'resonance' && e.b === slotB);
    if (!slotDef) return null;
    const from = this.paths[slotDef.echo.mvt]?.centerOf(slotDef.echo.b, new THREE.Vector3());
    const to = this.paths[mvt]?.centerOf(slotB, new THREE.Vector3());
    if (!from || !to) return null;
    const pts = [];
    const lift = 4.5 + from.distanceTo(to) * 0.3;
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      const p = from.clone().lerp(to, u);
      p.y += Math.sin(Math.PI * u) * lift;
      pts.push(p);
    }
    const mat = makeGlow({ color: COLORS.ECHO[slotDef.echo.mvt], intensity: 1.5, flow: 5 });
    const arc = new THREE.Mesh(ribbonGeometry(pts, 0.5), mat);
    arc.frustumCulled = false;
    arc.userData.born = instant ? -100 : G.uTime.value;
    arc.userData.n = 28;
    if (!instant) arc.geometry.setDrawRange(0, 0);
    this.scene.add(arc);
    this.arcs[mvt].push(arc);
    if (!instant) {
      this.effects.burst(to, COLORS.GOLD, 40, 3, { up: 2.4, life: 1.5 });
      this.effects.burst(from, COLORS.ECHO[slotDef.echo.mvt], 40, 3, { up: 2.4, life: 1.5 });
      const mid = pts[14];
      this.effects.rise(mid, COLORS.GOLD, 30, 2, 5);
      for (let i = 9; i < 20; i += 2) this.effects.sprout(pts[i], 3, 0.3, { drop: 0 });
      this.paths[slotDef.echo.mvt].pulse(slotDef.echo.b, 1.6);
      this.sea.ripple(to.x, to.z, 1.6, COLORS.GOLD);
    } else {
      for (let i = 9; i < 20; i += 2) this.effects.sprout(pts[i], 3, 0.3, { instant: true, drop: 0 });
    }
    void records;
    void ev;
    return pts[14];
  }

  // -------------------------------------------------------------------------------
  // Echo ghosts
  // -------------------------------------------------------------------------------
  ghost(i) {
    if (!this.ghosts[i]) {
      this.ghosts[i] = new KiteModel(this.scene, { ghost: true, echoColor: COLORS.ECHO[i] });
      this.ghosts[i].setVisible(false);
    }
    return this.ghosts[i];
  }

  // -------------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {object} ctx { beat, mvt, runner, gate, playing, echoes:[{mvt, record, opacity}], follow:boolean }
   */
  update(dt, ctx) {
    G.uTime.value += dt;
    G.uAwake.value += (this.awakeTarget - G.uAwake.value) * Math.min(1, dt * 0.5);

    this._updateSky(dt);
    const route = ctx.route ?? this.routes[ctx.mvt] ?? this.routes[0];
    let kx = 0, ky = 0;

    // Kite
    if (this.override) {
      this.kitePos.copy(this.override.pos);
      this.kiteYaw = this.override.yaw;
      this.kiteState.pose = this.override.pose ?? 'idle';
      this.kiteState.air = this.override.pose === 'leap';
      this.kiteState.u = this.override.u ?? 0.5;
      this.kiteState.airHeight = this.override.airHeight ?? 0;
    } else if (ctx.runner) {
      const st = ctx.runner.kiteAt(ctx.beat);
      kx = st.x;
      ky = st.y;
      route.pointAt(ctx.beat, st.x, st.y, this.kitePos);
      this.kiteYaw = route.yawAt(ctx.beat);
      const moving = route.speedAt(ctx.beat) > 0.25 && ctx.playing;
      this.kiteState.pose = st.air ? 'leap' : moving ? st.pose : 'idle';
      this.kiteState.air = st.air;
      this.kiteState.u = st.u;
      this.kiteState.airHeight = st.air && st.seg ? Math.max(0, st.y - (st.seg.y0 + (st.seg.y1 - st.seg.y0) * st.u)) : 0;
    }
    if (ctx.playing && !ctx.gate) {
      const whole = Math.floor(ctx.beat);
      if (whole !== this.lastBeat) {
        this.lastBeat = whole;
        const strong = ((whole % 4) + 4) % 4 === 0;
        this.kite.emberFlash = Math.max(this.kite.emberFlash, strong ? 0.5 : 0.26);
      }
    }
    this.kite.update(this.kitePos, this.kiteYaw, this.kiteState, dt, this.camera.position);
    this.kite.emberWorld(G.uEmberPos.value);
    G.uEmberPower.value = 1.0 + this.kite.emberFlash * 1.4;

    // Echo ghosts
    const active = new Set();
    for (const e of ctx.echoes ?? []) {
      // an Echo of a sea crossing brings its own chart, route and ghost
      const chart = e.route ? e.chart : LIGHTHOUSE.movements[e.mvt];
      const ghost = e.route ? this.seaWorld.ghost(e.mvt) : this.ghost(e.mvt);
      const eb = e.beat ?? ctx.beat; // an Echo can be shown waiting at its own beginning
      const inRange = eb >= chart.startBeat - 0.5 && eb <= chart.endBeat + 2;
      if (!inRange || e.opacity <= 0.01) continue;
      active.add(ghost);
      const st = kiteStateAt(e.record.pieces, e.record.segs, e.record.startLane, eb);
      const r = e.route ?? this.routes[e.mvt];
      r.pointAt(eb, st.x, st.y, _p);
      if (!ghost.visible) {
        ghost.setVisible(true);
        ghost.resetMotion(_p);
      }
      ghost.setOpacity(e.opacity);
      const moving = r.speedAt(eb) > 0.25 && e.beat === undefined;
      ghost.update(_p, r.yawAt(eb), { pose: st.air ? 'leap' : moving ? st.pose : 'idle', air: st.air, u: st.u }, dt, this.camera.position);
    }
    for (const g of [...this.ghosts, ...this.seaWorld.ghosts]) {
      if (g && g.visible && !active.has(g)) g.setVisible(false);
    }

    // paths, seeds, scenery
    this.paths.forEach((p, i) => p && p.update(i === ctx.mvt ? ctx.beat : ctx.beat, dt));
    this.seaWorld.update(dt, ctx.beat);
    this.seeds.update(ctx.playing || ctx.gate ? ctx.runner : null, route, ctx.beat, dt, { gate: ctx.gate });
    this.scenery.update(dt, this.lighthouse);
    this.lighthouse.update(dt);
    for (const list of this.arcs) {
      for (const a of list) {
        const age = G.uTime.value - a.userData.born;
        if (age < 1.6) a.geometry.setDrawRange(0, Math.floor(Math.min(1, age / 1.2) * a.userData.n) * 6);
        else if (!a.userData.done) {
          a.geometry.setDrawRange(0, a.userData.n * 6);
          a.userData.done = true;
        }
        a.material.uniforms.uIntensity.value = 0.9 + Math.max(0, 1.4 - age) * 1.2;
      }
    }

    // camera
    if (ctx.follow !== false) {
      const inBreath = ctx.runner ? this.kiteState.pose === 'glide' && !ctx.runner.activeHold : false;
      this.rig.update(route, ctx.beat, { x: kx, y: ky }, dt, { breath: inBreath });
    } else {
      this.rig.update(null, ctx.beat, { x: 0, y: 0 }, dt, {});
    }
    this.effects.update(dt, this.camera.position);
  }

  render() {
    this.post.render();
  }
}
