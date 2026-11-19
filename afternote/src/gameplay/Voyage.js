// The Sea of Bridges, as a journey: the chart, a crossing being played, the arrival at the
// far landing, and listening to a bridge again.
//
// The Conductor still owns the transport, the pause, the count-in and the keys; a crossing
// is played through exactly the same press/advance/dispatch path as a lighthouse movement,
// with a free chart in the runner. This class owns what is different about the sea: which
// bridge, which part, what is kept, and the moments either side of the playing.
//
// What is kept of a part is its score (which stone on which half-beat). The record a
// bridge is drawn and heard from is that score performed exactly on the beat, so every
// part stacked on a bridge stays in time with the others.

import * as THREE from 'three-afternote';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { CROSSING, PACE } from '../core/Constants.js';
import { MovementRunner } from '../rules/MovementRunner.js';
import { kiteStateAt } from '../rules/Trajectory.js';
import {
  SEA_BPM, SOUNDS, MOODS, PLACE, EDGE, EDGES, FINAL_CHORD, otherEnd, crossingChart, crossingRules, scoreOf, performScore,
  emptySea, sanitizeSea, unlocked, encodeBridge, decodeBridge, receiveBridge,
} from '../music/sea.js';
import { Save } from '../systems/Save.js';

const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const ARRIVE_SEC = 8.5;
/** The backing steps back a little as parts stack up, so each new voice can be heard. */
const THIN = [1, 0.82, 0.7];

export class Voyage {
  constructor(conductor) {
    this.c = conductor;
    this.sea = emptySea();
    /** edge id -> one performed record per part */
    this.records = {};
    /** the same, for each bridge that came from another sea */
    this.afarRecords = [];
    /** a link's code waiting to be taken in, what the last one turned out to be, and the bridge the chart should turn to */
    this.pending = null;
    this.incoming = null;
    this.focus = null;
    /** the crossing being played, or the bridge being listened to */
    this.cross = null;
    this.song = null;
    this.arrival = null;
    this.timer = 0;
    this.cine = {};
    this.muted = [false, false, false];
    this._shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this._v = new THREE.Vector3();
  }

  get world() { return this.c.world; }
  get seaWorld() { return this.c.world.seaWorld; }
  get hud() { return this.c.hud; }

  // -------------------------------------------------------------------------------
  // Keeping
  // -------------------------------------------------------------------------------

  /** Read the saved sea and rebuild everything that stands on it. */
  load() {
    this.sea = sanitizeSea(Save.loadSea());
    this.records = {};
    for (const [id, bridge] of Object.entries(this.sea.bridges)) {
      this.records[id] = bridge.layers.map((l, k) => this._perform(id, bridge, k, l));
      this.seaWorld.setBridge(id, bridge, this.records[id]);
    }
    this._performAfar();
    for (const id of Object.keys(PLACE)) this.seaWorld.setAwake(id, this.sea.awake.includes(id), true);
    gameState.sea = this.sea;
  }

  _performAfar() {
    this.afarRecords = this.sea.afar.map((g) => g.layers.map((l, k) => this._perform(g.edge, g, k, l)));
  }

  /**
   * A bridge by name: its edge when it is the player's own, 'afar:<n>' when it came from
   * another sea. Everything that hears a bridge or lays a part on one goes through here.
   */
  hold(ref) {
    if (typeof ref === 'string' && ref.startsWith('afar:')) {
      const index = Number(ref.slice(5));
      const bridge = this.sea.afar[index];
      return bridge ? { ref, own: false, index, edgeId: bridge.edge, bridge, records: this.afarRecords[index] } : null;
    }
    const bridge = this.sea.bridges[ref];
    return bridge ? { ref, own: true, index: -1, edgeId: ref, bridge, records: this.records[ref] } : null;
  }

  save() {
    gameState.sea = this.sea;
    Save.storeSea(this.sea);
  }

  _chartFor(edgeId, from, layer, sound) {
    return crossingChart({ edge: EDGE[edgeId], from, sound, layer });
  }

  _perform(edgeId, bridge, layer, part) {
    return performScore(MovementRunner, this._chartFor(edgeId, bridge.from, layer, part.sound), bridge.bpm, part.score);
  }

  /** What the chart needs to draw itself and offer the right things. */
  view() {
    const { sounds, moods } = unlocked(this.sea.awake);
    const brief = (id, b) => ({ from: b.from, mood: b.mood, layers: b.layers.map((l) => ({ sound: l.sound, notes: l.score.length })), code: encodeBridge(id, b) });
    const focus = this.focus;
    this.focus = null;
    return {
      at: this.sea.at,
      awake: [...this.sea.awake],
      sounds,
      moods,
      bridges: Object.fromEntries(Object.entries(this.sea.bridges).map(([id, b]) => [id, brief(id, b)])),
      afar: this.sea.afar.map((g) => ({
        edge: g.edge,
        ...brief(g.edge, g),
        // it can stand on the player's own chart once they have reached both of its ends
        canKeep: this.sea.awake.includes(EDGE[g.edge].a) && this.sea.awake.includes(EDGE[g.edge].b),
        swaps: !!this.sea.bridges[g.edge],
      })),
      edges: EDGES.map((e) => ({ ...e, start: this.startOf(e.id) })),
      focus,
    };
  }

  /** The end a new bridge on this edge would be begun from, or null if neither end has been reached. */
  startOf(edgeId) {
    const e = EDGE[edgeId];
    const awake = this.sea.awake;
    if (this.sea.at === e.a || this.sea.at === e.b) return this.sea.at;
    if (awake.includes(e.a)) return e.a;
    if (awake.includes(e.b)) return e.b;
    return null;
  }

  /** A sound for the next part of a bridge that it is not already using, if the player has one. */
  suggestSound(ref) {
    const { sounds } = unlocked(this.sea.awake);
    const used = (this.hold(ref)?.bridge.layers ?? []).map((l) => l.sound);
    return sounds.find((s) => !used.includes(s)) ?? sounds[0];
  }

  // -------------------------------------------------------------------------------
  // The chart
  // -------------------------------------------------------------------------------

  /** Stand at the place Kite last reached and look at the chart. */
  open({ fade = true } = {}) {
    const c = this.c;
    c.transport.stop();
    c.arranger.stop();
    c.arranger.setPiece(null);
    c.runner = null;
    c.echoes = [];
    c.paused = false;
    gameState.paused = false;
    c.countIn = null;
    c.gateWaiting = false;
    gameState.gateWaiting = false;
    this.cross = null;
    this.song = null;
    this.arrival = null;
    this.seaWorld.deactivate();
    this.world.seeds.clear();
    this.world.setSky(null);
    this.world.kite.lookBack = 0;
    this._standAt(this.sea.at);
    if (fade) {
      this.world.post.setFade(1);
      c.fadeIn = 1;
      this.world.rig.snap();
    }
    this.timer = 0;
    c._setPhase('sea');
    c.audio.setAmbience(1, 2);
    c.audio.duck(1, 0.5);
    this.hud.showHud(false);
    this.hud.showTitle(false);
    this.hud.showEnd(false);
    this.hud.showListen(false);
    this.hud.showArrival(false);
    // a bridge that came by link (just now, or while the title was showing) is what the chart turns to
    const came = this.pending ? this.take() : this.incoming;
    this.incoming = null;
    this.hud.showIncoming(null);
    if (came?.ref) this.focus = came.ref;
    this.hud.showChart(true, this.view());
    if (came) this.hud.showCaption(this.incomingText(came), 5200);
    if (!this.sea.seen.opened) {
      this.sea.seen.opened = true;
      this.save();
    }
    eventBus.emit(Events.SEA_OPENED, {});
  }

  _standAt(placeId, pose = 'idle') {
    const pos = this.seaWorld.landing(placeId);
    const yaw = this.world.override?.yaw ?? 0;
    this.world.override = { pos, yaw, pose };
  }

  updateSea(dt, ctx) {
    this.timer += dt;
    ctx.runner = null;
    ctx.follow = false;
    ctx.playing = false;
    ctx.echoes = [];
    const place = this.seaWorld.places[this.sea.at];
    const a = 0.6 + this.timer * 0.035;
    this._shot.pos.set(place.pos.x + Math.sin(a) * 40, 23, place.pos.z + Math.cos(a) * 40);
    this._shot.look.copy(place.pos).setY(4.5);
    this.world.rig.setShot(this._shot, 1.2);
  }

  // -------------------------------------------------------------------------------
  // A crossing
  // -------------------------------------------------------------------------------

  /** Begin a new bridge (or begin an existing one over; the old one stands until the new first part is finished). */
  build(edgeId, { sound, mood } = {}) {
    const from = this.startOf(edgeId);
    if (!from) return false;
    const have = unlocked(this.sea.awake);
    const m = MOODS[have.moods.includes(mood) ? mood : PLACE[from].gift && have.moods.includes(PLACE[from].gift.mood) ? PLACE[from].gift.mood : 'firstlight'];
    const pace = Object.values(PACE).find((p) => p.id === gameState.settings.pace) ?? PACE.FLOWING;
    const bpm = Math.round(SEA_BPM * m.tempo * pace.scale * 10) / 10;
    return this._start({ ref: edgeId, edgeId, from, layer: 0, sound: have.sounds.includes(sound) ? sound : 'bell', mood: m.id, bpm, fresh: true });
  }

  /** Play another part over the ones a bridge already has (the player's own, or one from afar). */
  addPart(ref, { sound } = {}) {
    const h = this.hold(ref);
    if (!h || h.bridge.layers.length >= CROSSING.MAX_LAYERS) return false;
    const have = unlocked(this.sea.awake);
    return this._start({
      ref, edgeId: h.edgeId, from: h.bridge.from, layer: h.bridge.layers.length, sound: have.sounds.includes(sound) ? sound : this.suggestSound(ref),
      mood: h.bridge.mood, bpm: h.bridge.bpm, fresh: false,
    });
  }

  _start({ ref, edgeId, from, layer, sound, mood, bpm, fresh }) {
    const c = this.c;
    const edge = EDGE[edgeId];
    const to = otherEnd(edge, from);
    const chart = this._chartFor(edgeId, from, layer, sound);
    const route = this.seaWorld.routeFor(edgeId, from, layer);
    const h = fresh ? null : this.hold(ref);
    const bridge = h ? h.bridge : null;
    const earlier = h ? h.records.slice(0, layer) : [];
    const own = h ? h.own : true;

    const views = this.seaWorld.activate(edgeId, from, earlier);
    const path = this.seaWorld.beginLayer(layer);
    this.cross = { ref, own, edgeId, edge, from, to, layer, sound, mood, bpm, fresh, chart, route, path };
    this.song = null;
    this.arrival = null;
    // (a bridge from afar may begin somewhere this player has not reached: Kite's own place is left as it is)
    if (own) this.sea.at = from;

    c.runner = new MovementRunner(chart, { bpm, rules: crossingRules() });
    c.transport.bpm = bpm;
    c.transport.latency = c.clock.manual ? 0 : c.audio.outputLatency;
    c.replaying = false;
    gameState.replaying = null;
    c.echoes = earlier.map((record, k) => ({
      mvt: k, record, chart: this._chartFor(edgeId, from, k, bridge.layers[k].sound), route: this.seaWorld.routeFor(edgeId, from, k),
      path: views[k], cursor: 0, opacity: 0,
    }));
    const m = MOODS[mood];
    const thin = THIN[Math.min(layer, THIN.length - 1)];
    c.arranger.setPiece({ harmony: m.harmony, beats: chart.beats, final: FINAL_CHORD });
    c.arranger.setScene({ ...m.scene, pad: m.scene.pad * thin, pulse: m.scene.pulse * thin });
    c.arranger.setEchoes(c.echoes);
    c.arranger.muted = [false, false, false];
    c.arranger.wheel = false;
    c.arranger.reset(chart.startBeat);
    c.audio.duck(1, 0.2);
    c.audio.setAmbience(0.7, 2);

    c.transport.seek(chart.startBeat);
    c.transport.start();
    this.world.override = null;
    this.world.setSky(m.sky);
    this.world.kite.lookBack = 0;
    this.world.post.setFade(1);
    c.fadeIn = 1;
    this.world.rig.setShot(null, 3);
    this.world.rig.snap();
    c.gateWaiting = false;
    gameState.gateWaiting = false;
    c.paused = false;
    c.tip = null;
    c.lastEvents = [];
    c._setPhase('play');

    this.hud.showChart(false);
    this.hud.showArrival(false);
    this.hud.showListen(false);
    this.hud.showHud(true);
    this.hud.showEnd(false);
    const done = [0, 1, 2].map((k) => k < layer);
    this.hud.setPlace('The Sea of Bridges', layer, `${PLACE[from].name} to ${PLACE[to].name}`, done);
    this.hud.setPrompt(null);
    this.hud.showCaption(`${SOUNDS[sound].name} · ${m.name}`, 3400);
    eventBus.emit(Events.CROSSING_STARTED, { edge: edgeId, from, to, layer, sound, mood });
    return true;
  }

  /** The words under the place name while the first note is waited for. */
  gatePrompt() {
    return this.cross.layer === 0 ? 'Play any note to set out. Every note is a stone.' : 'Play any note to join in.';
  }

  /** The far landing has been reached. */
  complete() {
    const c = this.c;
    const x = this.cross;
    const score = scoreOf(c.runner.record());
    c.audio.releaseAll();
    this.hud.setOffers([], false, null, false);
    this.hud.setPrompt(null);
    this.world.seeds.clear();
    if (!score.length) {
      // Kite was carried across on light alone: there is no bridge to keep
      this.seaWorld.dropLayer(x.layer);
      this.open();
      this.hud.showCaption('No stones this time. Any key builds one.', 4200);
      return;
    }
    const part = { sound: x.sound, score };
    const h = x.fresh ? null : this.hold(x.ref);
    const bridge = h ? h.bridge : { from: x.from, mood: x.mood, bpm: x.bpm, layers: [] };
    bridge.layers[x.layer] = part;
    const record = this._perform(x.edgeId, bridge, x.layer, part);
    const newBridge = x.own && !this.sea.bridges[x.edgeId];
    if (x.own) {
      this.sea.bridges[x.edgeId] = bridge;
      this.records[x.edgeId] = x.fresh ? [record] : [...this.records[x.edgeId].slice(0, x.layer), record];
    } else {
      this.afarRecords[h.index] = [...this.afarRecords[h.index].slice(0, x.layer), record];
    }
    // however Kite came, by a bridge of their own or by adding to someone else's, they played their way here
    const first = !this.sea.awake.includes(x.to);
    if (first) this.sea.awake.push(x.to);
    this.sea.at = x.to;
    this.save();
    if (x.own) this.seaWorld.setBridge(x.edgeId, bridge, this.records[x.edgeId]);

    this.arrival = {
      ...x, first, notes: score.length, record, gift: first ? PLACE[x.to].gift : null,
      // the two moments the whole sea has been working towards
      wholeSea: first && this.sea.awake.length === Object.keys(PLACE).length,
      everyBridge: newBridge && Object.keys(this.sea.bridges).length === EDGES.length,
    };
    this.timer = 0;
    this.cine = {};
    c._setPhase('arrive');
    this.hud.showHud(false);
    eventBus.emit(Events.CROSSING_COMPLETE, { edge: x.edgeId, layer: x.layer, notes: score.length, first });
  }

  /** The crossing was left before the far landing: nothing of it is kept. */
  abandon() {
    if (this.cross) this.seaWorld.dropLayer(this.cross.layer);
    this.cross = null;
    this.c.runner = null;
    this.world.seeds.clear();
  }

  /** Start the part being played over again. */
  restart() {
    const x = this.cross;
    if (!x) return;
    this.c.audio.releaseAll();
    this.seaWorld.dropLayer(x.layer);
    this._start({ ref: x.ref, edgeId: x.edgeId, from: x.from, layer: x.layer, sound: x.sound, mood: x.mood, bpm: x.bpm, fresh: x.fresh });
  }

  // -------------------------------------------------------------------------------
  // Arriving
  // -------------------------------------------------------------------------------
  updateArrive(dt, ctx) {
    const c = this.c;
    const a = this.arrival;
    const D = c.dur(ARRIVE_SEC);
    const chart = a.chart;
    if (c.transport.running && c.transport.beat() >= chart.endBeat) {
      c.transport.stop();
      c.transport.seek(chart.endBeat);
    }
    const beat = Math.min(c.transport.beat(), chart.endBeat);
    this.timer += dt;
    const u = clamp01(this.timer / D);
    ctx.beat = beat;
    ctx.playing = false;
    ctx.route = a.route;
    ctx.echoes = c.echoes.map((e) => ({ ...e, opacity: 0 }));

    const place = this.seaWorld.places[a.to];
    if (!this.cine.shot) {
      this.cine.shot = true;
      // look back along what was just made
      a.route.pointAt(chart.endBeat + 2.2, 4.2, 5.4, this._shot.pos);
      a.route.pointAt(chart.endBeat - 14, 0, 1.4, this._shot.look);
      this.world.rig.setShot(this._shot, 1.1);
      this.world.kite.lookBack = 1;
      c.audio.duck(0.55, 1.2);
      this.cine.hits = a.record.entries.filter((e) => e.outcome === 'hit');
      this.cine.next = 0;
      this.hud.showCaption(a.layer === 0 ? 'A bridge of your own' : a.layer === 1 ? 'A second part' : 'A third part', 3200);
    }
    // the bridge lights in the order it was played, its first notes sounding again
    const hits = this.cine.hits;
    const upTo = Math.floor(clamp01((u - 0.06) / 0.4) * hits.length);
    while (this.cine.next < upTo) {
      const n = hits[this.cine.next];
      a.path.pulse(n.b, 1.3);
      if (this.cine.next < 7) c.audio.note({ instrument: chart.instrument, octave: chart.octave, pitch: n.p, dur: 0.5, bus: 'echo', gain: 0.9 });
      this.cine.next++;
    }
    // then Kite turns to the place itself
    if (u > 0.5 && !this.cine.turned) {
      this.cine.turned = true;
      this.world.kite.lookBack = 0;
      this._v.subVectors(place.landmarkPos, place.pos).setY(0).normalize();
      this._shot.pos.copy(place.pos).addScaledVector(this._v, -15).addScaledVector(UP, 6.5);
      this._shot.look.copy(place.landmarkPos).setY(place.landmarkPos.y + 1);
      this.world.rig.setShot(this._shot, 1.0);
      if (a.first) {
        this.seaWorld.setAwake(a.to, true);
        c.audio.swell(3.2, 0.3, 2200);
        c.audio.chime([72, 76, 79, 84], 0.55);
        this.hud.showCaption(`${PLACE[a.to].name} is awake`, 4200);
        eventBus.emit(Events.PLACE_WOKEN, { place: a.to });
      }
    }
    if (u >= 1) this._arrived();
  }

  _arrived() {
    const a = this.arrival;
    const c = this.c;
    c.transport.stop();
    c.arranger.stop();
    c.runner = null;
    c.echoes = [];
    this.cross = null;
    this._standAt(a.to);
    this.timer = 0;
    c._setPhase('arrived');
    const h = this.hold(a.ref);
    const bridge = h.bridge;
    this.hud.showArrival(true, {
      place: PLACE[a.to].name,
      blurb: PLACE[a.to].blurb,
      notes: a.notes,
      layer: a.layer,
      layers: bridge.layers.length,
      canAdd: bridge.layers.length < CROSSING.MAX_LAYERS,
      gift: a.gift ? { sound: SOUNDS[a.gift.sound].name, mood: MOODS[a.gift.mood].name } : null,
      edge: a.ref,
      afar: !h.own,
      wholeSea: a.wholeSea,
      everyBridge: a.everyBridge,
      sounds: unlocked(this.sea.awake).sounds,
      suggest: this.suggestSound(a.ref),
    });
  }

  updateArrived(dt, ctx) {
    this.timer += dt;
    ctx.runner = null;
    ctx.follow = false;
    ctx.playing = false;
    ctx.echoes = [];
    const place = this.seaWorld.places[this.arrival.to];
    const a = 2.2 + this.timer * 0.04;
    this._shot.pos.set(place.pos.x + Math.sin(a) * 30, 12, place.pos.z + Math.cos(a) * 30);
    this._shot.look.copy(place.landmarkPos).setY(6);
    this.world.rig.setShot(this._shot, 0.8);
  }

  // -------------------------------------------------------------------------------
  // Hearing a bridge again
  // -------------------------------------------------------------------------------
  listen(ref) {
    const c = this.c;
    const h = this.hold(ref);
    if (!h) return false;
    const { bridge, edgeId, records } = h;
    const edge = EDGE[edgeId];
    const views = this.seaWorld.activate(edgeId, bridge.from, records);
    const charts = bridge.layers.map((l, k) => this._chartFor(edgeId, bridge.from, k, l.sound));
    this.song = { ref, own: h.own, edgeId, edge, from: bridge.from, to: otherEnd(edge, bridge.from), charts, records, route: this.seaWorld.routeFor(edgeId, bridge.from, 0) };
    this.cross = null;
    this.arrival = null;
    this.muted = [false, false, false];
    c.runner = null;
    c.echoes = records.map((record, k) => ({
      mvt: k, record, chart: charts[k], route: this.seaWorld.routeFor(edgeId, bridge.from, k), path: views[k], cursor: 0, opacity: k === 0 ? 0 : 1,
    }));
    const m = MOODS[bridge.mood];
    c.arranger.setPiece({ harmony: m.harmony, beats: charts[0].beats, final: FINAL_CHORD });
    c.arranger.setScene({ ...m.scene, pad: m.scene.pad * 0.8 });
    c.arranger.setEchoes(c.echoes);
    c.arranger.muted = this.muted;
    c.arranger.wheel = false;
    c.transport.bpm = bridge.bpm;
    c.transport.seek(-2);
    c.arranger.reset(-2);
    c.transport.start();
    c.audio.duck(1, 0.6);
    c.audio.setAmbience(0.6, 2);
    this.world.setSky(m.sky);
    this.world.post.setFade(1);
    c.fadeIn = 1;
    this.world.rig.setShot(null, 3);
    this.world.rig.snap();
    this.world.kite.lookBack = 0;
    if (h.own) this.sea.at = bridge.from;
    c._setPhase('bridgeSong');
    this.hud.showChart(false);
    this.hud.showArrival(false);
    this.hud.showHud(false);
    this.hud.showListen(true, this.muted, {
      label: `${PLACE[bridge.from].name} to ${PLACE[this.song.to].name}`,
      stems: bridge.layers.map((l) => SOUNDS[l.sound].name),
    });
    return true;
  }

  /** Turn one part of the bridge being heard on or off. */
  toggleStem(i) {
    if (!this.song || i >= this.song.records.length) return;
    this.muted[i] = !this.muted[i];
    if (this.song.records.every((_, k) => this.muted[k])) this.muted[i] = false; // never all silent
    this.c.arranger.muted = this.muted;
    this.hud.showListen(true, this.muted);
  }

  updateSong(beat, dt, ctx) {
    const c = this.c;
    const s = this.song;
    const chart = s.charts[0];
    ctx.runner = null;
    ctx.playing = false;
    ctx.route = s.route;
    ctx.follow = false;
    // Kite walks the first part again; the other parts walk beside as Echoes
    const b = Math.max(chart.startBeat, Math.min(beat, chart.endBeat));
    const rec = s.records[0];
    const st = kiteStateAt(rec.pieces, rec.segs, rec.startLane, b);
    const pos = s.route.pointAt(b, st.x, st.y, this._v).clone();
    const moving = s.route.speedAt(b) > 0.25;
    this.world.override = { pos, yaw: s.route.yawAt(b), pose: st.air ? 'leap' : moving ? st.pose : 'idle', u: st.u, airHeight: 0 };
    ctx.beat = b;
    // travel beside and above the bridge, wide enough to hold every part of it
    const wide = s.records.length > 1 ? 1 : 0;
    s.route.pointAt(b - 5.5, -(13 + wide * 7), 9.5 + wide * 4, this._shot.pos);
    s.route.pointAt(b + 4.5, 0, 1.6 + wide, this._shot.look);
    this.world.rig.setShot(this._shot, 2.4);
    c._echoSteps(beat);
    for (const e of c.echoes) {
      const want = e.mvt === 0 ? 0 : this.muted[e.mvt] ? 0.12 : 1;
      e.opacity += (want - e.opacity) * Math.min(1, dt * 3);
    }
    if (beat >= chart.endBeat + 0.5) {
      // hearing a bridge of your own carries Kite across it; one from afar is only heard
      if (s.own) {
        this.sea.at = s.to;
        this.save();
      }
      this.focus = s.ref;
      this.open();
    }
  }

  /** Back from listening or from the arrival card. */
  back() {
    if (this.song) {
      this.c.audio.releaseAll();
      this.focus = this.song.ref;
    }
    this.open();
  }

  // -------------------------------------------------------------------------------
  // Bridges from another sea
  // -------------------------------------------------------------------------------

  /** Whether something is being played or heard that a newly arrived bridge must not disturb. */
  get busy() {
    return !!(this.cross || this.song || this.arrival);
  }

  /**
   * A link has been opened. Its bridge is taken in at once if nothing is being played,
   * otherwise the next time the chart is opened.
   * @returns {{what:string, ref?:string}|null} what it turned out to be, or null if it is waiting
   */
  offer(code) {
    this.pending = code;
    return this.busy ? null : this.take();
  }

  take() {
    const code = this.pending;
    this.pending = null;
    if (!code) return null;
    const got = decodeBridge(code);
    if (!got) {
      this.incoming = { what: 'unreadable' };
      return this.incoming;
    }
    const r = receiveBridge(this.sea, got.edge, got.bridge);
    const h = this.hold(r.ref);
    if (h.own && r.what === 'grown') {
      this.records[h.edgeId] = h.bridge.layers.map((l, k) => this._perform(h.edgeId, h.bridge, k, l));
      this.seaWorld.setBridge(h.edgeId, h.bridge, this.records[h.edgeId]);
    }
    this._performAfar();
    this.save();
    this.incoming = { ...r, own: h.own, parts: h.bridge.layers.length };
    this.focus = r.ref;
    eventBus.emit(Events.BRIDGE_RECEIVED, { what: r.what, own: h.own });
    return this.incoming;
  }

  /** One line for whoever opened the link. */
  incomingText(r) {
    if (!r || r.what === 'unreadable') return 'That link did not hold a bridge.';
    if (r.what === 'grown') return r.own ? 'Your bridge has come back with a new part.' : 'A bridge from afar has grown.';
    if (r.what === 'same') return r.own ? 'This is your own bridge, just as you left it.' : 'You already have this bridge.';
    return 'A bridge has arrived from another sea.';
  }

  /** Go and hear the bridge that has just arrived. */
  hearIncoming() {
    const r = this.incoming;
    this.open();
    if (r?.ref && this.hold(r.ref)) this.listen(r.ref);
  }

  /** Set a bridge from afar on the player's own chart; a bridge of theirs already there changes places with it. */
  keep(ref) {
    const h = this.hold(ref);
    if (!h || h.own) return false;
    const e = EDGE[h.edgeId];
    if (!this.sea.awake.includes(e.a) || !this.sea.awake.includes(e.b)) return false;
    const mine = this.sea.bridges[h.edgeId];
    const { edge: _edge, ...bridge } = h.bridge;
    this.sea.bridges[h.edgeId] = bridge;
    if (mine) this.sea.afar[h.index] = { edge: h.edgeId, ...mine };
    else this.sea.afar.splice(h.index, 1);
    this.records[h.edgeId] = bridge.layers.map((l, k) => this._perform(h.edgeId, bridge, k, l));
    this._performAfar();
    this.seaWorld.setBridge(h.edgeId, bridge, this.records[h.edgeId]);
    this.save();
    this.focus = h.edgeId;
    this.hud.showChart(true, this.view());
    return true;
  }

  /** Let a bridge from afar go. */
  release(ref) {
    const h = this.hold(ref);
    if (!h || h.own) return false;
    this.sea.afar.splice(h.index, 1);
    this._performAfar();
    this.save();
    this.hud.showChart(true, this.view());
    return true;
  }

  /** Handle a UI action that belongs to the sea. @returns {boolean} whether it was one */
  action(action, value) {
    switch (action) {
      case 'sea': this.open(); return true;
      case 'sea-home': this.leave(); return true;
      case 'sea-build': return this.build(value.edge, value) || true;
      case 'sea-add': return this.addPart(value.edge, value) || true;
      case 'sea-listen': return this.listen(value.edge) || true;
      case 'sea-chart':
        if (value?.focus) this.focus = value.focus;
        this.back();
        return true;
      case 'sea-incoming': this.hearIncoming(); return true;
      case 'sea-keep': return this.keep(value.ref) || true;
      case 'sea-release': return this.release(value.ref) || true;
      default: return false;
    }
  }

  /** Leave the sea for the title. */
  leave() {
    this.cross = null;
    this.song = null;
    this.arrival = null;
    this.seaWorld.deactivate();
    this.world.setSky(null);
    this.hud.showChart(false);
    this.hud.showArrival(false);
    this.hud.showListen(false);
    this.c.arranger.setPiece(null);
    this.c.toTitle();
    this.world.post.setFade(1);
    this.c.fadeIn = 1;
    this.world.rig.snap();
  }

  /** For tests and tools. */
  snapshot() {
    const x = this.cross;
    return {
      at: this.sea.at,
      awake: [...this.sea.awake],
      bridges: Object.fromEntries(Object.entries(this.sea.bridges).map(([id, b]) => [id, { from: b.from, mood: b.mood, bpm: b.bpm, parts: b.layers.map((l) => ({ sound: l.sound, notes: l.score.length })) }])),
      afar: this.sea.afar.map((g) => ({ edge: g.edge, from: g.from, mood: g.mood, bpm: g.bpm, parts: g.layers.map((l) => ({ sound: l.sound, notes: l.score.length })) })),
      crossing: x ? { edge: x.edgeId, from: x.from, to: x.to, layer: x.layer, sound: x.sound, mood: x.mood, beats: x.chart.beats, ...(x.own ? {} : { ref: x.ref }) } : null,
      listening: this.song ? this.song.ref : null,
      incoming: this.incoming ? this.incoming.what : null,
      ...unlocked(this.sea.awake),
    };
  }
}
