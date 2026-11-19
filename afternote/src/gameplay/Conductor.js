// The flow of a visit: title -> three movements, each born into an Echo -> the lens ignites
// -> the World Reveal -> the end card and its four quiet choices.
//
// The Conductor owns the transport and the current MovementRunner, forwards the runner's
// events to the world, the sound and the HUD, and stages the cinematic moments between
// movements. All rules stay in src/rules.

import * as THREE from 'three-afternote';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { COLORS, PACE, TIMING, LANES, HELP, CROSSING } from '../core/Constants.js';
import { MovementRunner } from '../rules/MovementRunner.js';
import { midiOf } from '../music/Theory.js';
import { buildTransit } from '../world/Routes.js';
import { Save, replaceRecord } from '../systems/Save.js';
import { Voyage } from './Voyage.js';

const UP = new THREE.Vector3(0, 1, 0);
const SCENE_NAMES = ['causeway', 'roots', 'lens'];
const AWAKE_AFTER = [0.3, 0.56, 1.0];

// One sentence at a time, only the first time, only when it helps (bible §11.5).
const TIPS = [
  [
    { from: -3.2, to: -0.4, text: null },
    { from: 2.3, to: 5.0, text: 'Two notes glow. Either one is yours.', once: 'choice' },
    { from: 17.2, to: 21.6, text: 'Hold until the ribbon ends.', once: 'hold' },
    { from: 30.3, to: 34.4, text: 'Now choose your own.', once: 'open' },
  ],
  [
    { from: -5.5, to: 1.5, text: 'Your Echo plays above. Answer it.', once: 'echo', needsEchoes: 1 },
    { from: 12.0, to: 15.2, text: 'A shared ring: play with your Echo.', once: 'crossing', needsRing: 'crossing1' },
  ],
  [{ from: -5.5, to: 0.5, text: 'Both Echoes are with you.', once: 'both', needsEchoes: 2 }],
];

// Where the camera waits on the title (world units relative to Kite and the route's heading).
const TITLE_SHOT = { back: 10, left: 4.4, height: 3.4, yaw: 2.6, drop: 5.6 };

const ease = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.max(0, Math.min(1, u));

export class Conductor {
  constructor({ clock, transport, world, audio, arranger, hud, island, testMode = false, shortCinematics = false }) {
    this.clock = clock;
    this.transport = transport;
    this.world = world;
    this.audio = audio;
    this.arranger = arranger;
    this.hud = hud;
    this.island = island;
    this.testMode = testMode;
    this.shortCinematics = shortCinematics;

    this.phase = 'boot';
    this.mvt = 0;
    this.runner = null;
    this.echoes = []; // { mvt, record, chart, cursor, opacity }
    this.timer = 0;
    this.paused = false;
    this.countIn = null;
    this.gateWaiting = false;
    this.tip = null;
    this.phraseChecked = new Set();
    this.struggleOffered = false;
    /** physical key (pitch index) → the pitch it is sounding, while held */
    this.sounding = new Map();
    this.muted = [false, false, false];
    this.bot = null;
    this.replaying = false;
    this.cine = {};
    this.lastEvents = [];
    this.fadeIn = 0;
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this._frame = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3() };
    /** The Sea of Bridges: crossings are played through this Conductor, with a free chart in the runner. */
    this.voyage = new Voyage(this);
  }

  /** What is being played: a part of a sea crossing, or a movement of the lighthouse. */
  get chart() {
    return this.voyage.cross ? this.voyage.cross.chart : this.island.movements[this.mvt];
  }

  dur(sec) {
    return this.shortCinematics ? Math.min(sec, 0.35) : sec;
  }

  // -------------------------------------------------------------------------------
  // Boot and title
  // -------------------------------------------------------------------------------
  boot() {
    const saved = Save.load();
    if (saved) {
      gameState.records = saved.records;
      gameState.discoveries = saved.discoveries;
      gameState.seen = saved.seen;
      this.world.restore(saved.records, this.island.movements);
    }
    this.voyage.load();
    this._applyAwake(true);
    this.world.post.setFade(1);
    this.fadeIn = 1;
    this.toTitle();
  }

  _done() {
    return gameState.records.map((r) => !!r);
  }

  _applyAwake(instant = false) {
    const n = gameState.records.filter(Boolean).length;
    const level = n === 0 ? 0 : AWAKE_AFTER[Math.min(2, n - 1)];
    this.world.awakeTarget = Math.max(level, n === 0 && gameState.seen.firstStone ? 0.08 : 0);
    if (instant) this.world.awakeTarget = level;
  }

  toTitle() {
    // whatever was happening on the sea is over
    this.voyage.cross = null;
    this.voyage.song = null;
    this.voyage.arrival = null;
    this.world.seaWorld.deactivate();
    this.world.setSky(null);
    this.arranger.setPiece(null);
    this.hud.showChart(false);
    this.hud.showArrival(false);
    this.hud.showListen(false, undefined, null);
    this._setPhase('title');
    this.transport.stop();
    this.arranger.stop();
    this.runner = null;
    this.echoes = [];
    this.paused = false;
    this.mvt = 0;
    const chart = this.island.movements[0];
    this.transport.seek(chart.startBeat);
    this._standAt(0, chart.startBeat, chart.startLane);
    this.world.rig.setShot(null);
    this.world.rig.snap();
    const done = this._done();
    this.hud.showHud(false);
    this.hud.showEnd(false);
    this.hud.showTitle(true, { canContinue: done.some(Boolean), complete: done.every(Boolean) });
    this.hud.setMovements(this.island.movements, done);
    this.audio.setAmbience(1, 3);
  }

  /** Put Kite, standing, at a beat/lane of a route (used outside active play). */
  _standAt(mvt, beat, lane, pose = 'idle') {
    const route = this.world.routes[mvt];
    const pos = route.pointAt(beat, LANES.X[lane], LANES.Y[lane], new THREE.Vector3());
    this.world.override = { pos, yaw: route.yawAt(beat), pose };
    this.standing = { mvt, beat };
  }

  // -------------------------------------------------------------------------------
  // Starting things
  // -------------------------------------------------------------------------------

  /** From the title: a brand-new journey. */
  begin() {
    gameState.records = [null, null, null];
    gameState.discoveries = [];
    gameState.seen = {};
    gameState.stats = { hits: 0, misses: 0, perfect: 0 };
    Save.clear();
    this.world.restore([null, null, null], this.island.movements);
    for (let i = 0; i < 3; i++) {
      this.world.clearArcs(i);
      if (this.world.paths[i]) {
        this.world.paths[i].dispose();
        this.world.paths[i] = null;
      }
    }
    this.world.awakeTarget = 0;
    this.world.effects.clearLeaves();
    this.hud.showTitle(false);
    this.startMovement(0);
  }

  /** From the title with a save: pick up at the next unfinished movement, or the restored island. */
  resumeJourney() {
    this.hud.showTitle(false);
    const next = gameState.records.findIndex((r) => !r);
    if (next === -1) this.toEnd(true);
    else if (next === 0) this.startMovement(0);
    else {
      // arrive at the start of the next movement out of the mist
      this.world.post.setFade(1);
      this.fadeIn = 1;
      this.startMovement(next);
      this.world.rig.snap();
    }
  }

  /** Every movement is open from the start. One played before its elders simply has no Echo to answer yet. */
  isUnlocked(i) {
    return i >= 0 && i < this.island.movements.length;
  }

  /**
   * From the title: play one movement. An unfinished one continues the journey; a finished
   * one is played again and only replaces the old performance if it is completed.
   */
  playFromTitle(i) {
    if (this.phase !== 'title' || !this.isUnlocked(i)) return false;
    if (i === 0 && !gameState.records.some(Boolean)) {
      this.begin();
      return true;
    }
    this.hud.showTitle(false);
    this.world.post.setFade(1);
    this.fadeIn = 1;
    this.startMovement(i, { replay: !!gameState.records[i] });
    this.world.rig.snap();
    return true;
  }

  startMovement(i, { replay = false } = {}) {
    this.voyage.cross = null;
    this.voyage.song = null;
    this.world.seaWorld.deactivate();
    this.world.setSky(null);
    this.arranger.setPiece(null);
    const chart = this.island.movements[i];
    const pace = Object.values(PACE).find((p) => p.id === gameState.settings.pace) ?? PACE.FLOWING;
    const bpm = this.island.bpm * pace.scale;
    this.transport.bpm = bpm;
    this.transport.latency = this.clock.manual ? 0 : this.audio.outputLatency;
    this.mvt = i;
    this.replaying = replay;
    gameState.replaying = replay ? i : null;

    // rules may only resonate with movements that come earlier in the piece
    const earlier = gameState.records.map((r, k) => (k < i ? r : undefined));
    this.runner = new MovementRunner(chart, { bpm, echoes: earlier });
    this.world.clearArcs(i);
    this.world.beginMovement(i, this.runner);

    this.echoes = gameState.records
      .map((record, k) => (record && k !== i ? { mvt: k, record, chart: this.island.movements[k], cursor: 0, opacity: 0 } : null))
      .filter(Boolean);
    this.arranger.setScene(SCENE_NAMES[i]);
    this.arranger.setEchoes(this.echoes);
    this.arranger.muted = [false, false, false];
    this.arranger.wheel = i === 1 ? false : this.arranger.wheel;
    this.arranger.reset(chart.startBeat);
    this.audio.duck(1, 0.2);
    this.audio.setAmbience(i === 0 ? 1 : 0.7, 2);

    this.transport.seek(chart.startBeat);
    this.transport.start();
    this.world.override = null;
    this.world.rig.setShot(null, 1.4);
    this.world.kite.lookBack = 0;
    this.gateWaiting = false;
    this.paused = false;
    this.tip = null;
    this.phraseChecked.clear();
    this.struggleOffered = false;
    this.lastEvents = [];
    this._setPhase('play');

    this.hud.showHud(true);
    this.hud.showEnd(false);
    this.hud.setPlace(this.island.title, i, chart.title, this._done());
    this.hud.setPrompt(null);
    if (i > 0 || replay) this.hud.showCaption(chart.title, 3400);
    eventBus.emit(Events.MOVEMENT_STARTED, { mvt: i, replay });
  }

  // -------------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------------
  /**
   * The helping hand (Settings): a key that is not offered right now may stand in for the
   * nearest note that is — the key next door ('near') or any key at all ('any'). What gets
   * built, heard and recorded is the note that was actually sounded, pressed in the player's
   * own time; a press outside every window still builds nothing.
   */
  _assist(pitch, beat) {
    const mode = gameState.settings.help ?? HELP.DEFAULT;
    if (mode === HELP.OFF) return pitch;
    const r = this.runner;
    const sets = [];
    if (r.lateHold) sets.push(r.offers(r.lateHold.slot));
    const slot = r.nextSlot();
    if (slot && (slot.gate || beat >= r.windows[slot.i].open)) sets.push(r.offers(slot));
    if (sets.some((offers) => offers.includes(pitch))) return pitch;
    for (const offers of sets) {
      let best = null;
      for (const p of offers) if (best === null || Math.abs(p - pitch) < Math.abs(best - pitch)) best = p;
      if (best !== null && (mode === HELP.ANY || Math.abs(best - pitch) <= 1)) return best;
    }
    return pitch;
  }

  handlePress(pressed, e) {
    this.hud.flashKey(pressed, 'down');
    if (this.phase !== 'play' || this.paused || this.countIn || !this.runner) {
      // the keys are an instrument everywhere: outside a passage they still sing, softly
      if (this.phase !== 'title' && !this.paused && this.chart) {
        this.audio.flourish(this.chart, pressed);
        this.world.kite.flash(COLORS.PITCH[pressed], 0.6);
      }
      return;
    }
    const t = this.clock.timeOfEvent(e);
    const beat = this.gateWaiting ? this.runner.gateBeat() : this.transport.beatAtTime(t);
    const before = this.runner.advance(beat);
    const slot = this.runner.nextSlot();
    const pitch = this._assist(pressed, beat);
    const res = this.runner.press(pitch, beat);
    if (res.type === 'hit') this.sounding.set(pressed, pitch);
    if (res.type === 'hit') {
      const e2 = res.entry;
      const sustain = e2.k === 'hold';
      // sound first: nothing may come between the finger and the note
      if (this.chart.free) this.audio.playerTap(this.chart, pitch, CROSSING.RING_BEATS * this.transport.secPerBeat);
      else this.audio.playerDown(this.chart, pitch, sustain, Math.min(e2.d, 2) * this.transport.secPerBeat);
      if (this.gateWaiting) {
        this.gateWaiting = false;
        gameState.gateWaiting = false;
        this.transport.start(beat);
        this.arranger.reset(beat);
        this.hud.setPrompt(null);
        eventBus.emit(Events.GATE_OPENED, {});
      }
    } else {
      this.audio.flourish(this.chart, pitch);
    }
    void slot;
    this._dispatch(before.concat(res.events));
  }

  handleRelease(pressed, e) {
    this.hud.flashKey(pressed, 'up');
    // the note this key actually sounded (the helping hand may have moved it)
    const pitch = this.sounding.get(pressed) ?? pressed;
    this.sounding.delete(pressed);
    if (this.phase !== 'play' || !this.runner) return;
    if (this.paused || this.countIn) return; // a hold interrupted by a pause is granted
    const beat = this.transport.beatAtTime(this.clock.timeOfEvent(e));
    const events = this.runner.release(pitch, beat);
    this.audio.playerUp(pitch);
    this._dispatch(events);
  }

  // -------------------------------------------------------------------------------
  // Events from the rules
  // -------------------------------------------------------------------------------
  _dispatch(events) {
    for (const ev of events) {
      this.lastEvents.push(ev.type);
      if (this.lastEvents.length > 12) this.lastEvents.shift();
      const sea = this.voyage.cross;
      const where = this.world.onRunnerEvent(ev, this.mvt, sea ? { path: sea.path, route: sea.route } : null);
      switch (ev.type) {
        case 'hit':
          gameState.stats.hits++;
          if (ev.entry.q === 'perfect') gameState.stats.perfect++;
          this.hud.flashKey(ev.entry.p, 'hit');
          eventBus.emit(Events.NOTE_HIT, { mvt: this.mvt, entry: ev.entry });
          break;
        case 'miss':
          gameState.stats.misses++;
          eventBus.emit(Events.NOTE_MISS, { mvt: this.mvt, entry: ev.entry });
          break;
        case 'flourish':
          this.hud.flashKey(ev.p, 'soft');
          // a key that builds nothing is still answered: the ember takes its colour
          this.world.kite.flash(COLORS.PITCH[ev.p], 0.75);
          eventBus.emit(Events.NOTE_FLOURISH, { mvt: this.mvt, p: ev.p, reason: ev.reason });
          break;
        case 'hold:end':
          this.audio.playerUp(ev.entry.p);
          eventBus.emit(Events.HOLD_END, { mvt: this.mvt, entry: ev.entry, full: ev.full });
          break;
        case 'hold:broken':
          eventBus.emit(Events.HOLD_BROKEN, { mvt: this.mvt, entry: ev.entry });
          break;
        case 'choice':
          eventBus.emit(Events.CHOICE, { mvt: this.mvt, id: ev.id, route: ev.route, auto: ev.auto });
          break;
        case 'resonance':
          this._resonanceSound(ev);
          if (!gameState.seen.resonance) {
            gameState.seen.resonance = true;
            this.hud.showCaption('Resonance', 2600);
          }
          eventBus.emit(Events.RESONANCE, { mvt: this.mvt, entry: ev.entry });
          break;
        case 'accent':
          this._accentSound(ev.tag, where);
          if (ev.tag === 'firstStone') {
            gameState.seen.firstStone = true;
            this.world.awakeTarget = Math.max(this.world.awakeTarget, 0.08);
          }
          if (ev.tag === 'wheel') this.arranger.wheel = true;
          eventBus.emit(Events.ACCENT, { mvt: this.mvt, tag: ev.tag });
          break;
        case 'complete':
          if (sea) break; // a crossing's landmark is the place it reaches (see Voyage.complete)
          this.world.completeLandmark(this.mvt);
          if (this.mvt === 1) this.arranger.wheel = true;
          break;
        default:
          break;
      }
    }
  }

  _accentSound(tag) {
    const a = this.audio;
    const bar = Math.max(0, Math.min(15, Math.floor(this.transport.beat() / 4)));
    const color = this.island.harmony[bar].color;
    if (tag.startsWith('lantern')) a.chime([color[0] + 12, color[1] + 12], 0.5);
    else if (tag === 'chime') a.chime([88, 91, 96], 0.6);
    else if (tag === 'fish') { a.plip(72, 0.4); a.plip(76, 0.35, a.now() + 0.22); a.plip(79, 0.3, a.now() + 0.44); }
    else if (tag === 'root1' || tag === 'root2') { a.swell(2.4, 0.2, 900); a.chime([color[0] - 12, color[1]], 0.3); }
    else if (tag === 'wheel') { a.swell(2.2, 0.22, 1400); a.wood(a.now(), 0.25, 440); a.wood(a.now() + 0.3, 0.2, 520); }
    else if (tag === 'lighthouseWheel') { a.swell(3.5, 0.3, 1600); a.chime([60, 67, 72], 0.5); }
    else if (tag.startsWith('panel')) a.chime([color[1] + 12, color[2] + 12], 0.5);
    else if (tag.startsWith('lens')) a.swell(3.0, 0.26, 3200);
    else if (tag === 'gulls') a.swell(1.6, 0.14, 4200);
    else if (tag === 'stars') a.chime([91, 96, 100, 103], 0.4);
  }

  /** Both paths sing: the Echo's note is re-struck softly an octave up with the answer. */
  _resonanceSound(ev) {
    const echoRec = gameState.records[ev.echoMvt];
    const echoEntry = echoRec?.entries.find((x) => x.b === ev.echoBeat && x.outcome === 'hit');
    const echoChart = this.island.movements[ev.echoMvt];
    const notes = [midiOf(ev.entry.p, this.chart.octave + 1)];
    if (echoEntry) notes.unshift(midiOf(echoEntry.p, Math.min(6, echoChart.octave + 1)));
    this.audio.chime(notes, 0.55);
    this.audio.swell(1.8, 0.16, 3000);
  }

  // -------------------------------------------------------------------------------
  // Pause
  // -------------------------------------------------------------------------------
  canPause() {
    return ['play', 'reveal', 'listen', 'rest', 'bridgeSong'].includes(this.phase) && !this.paused;
  }

  pause(kind = 'pause') {
    if (!this.canPause()) return;
    this.paused = true;
    gameState.paused = true;
    this.countIn = null;
    this.hud.countIn(0);
    this.wasRunning = this.transport.running;
    this.transport.stop();
    this.audio.duck(0, 0.08);
    this.audio.releaseAll();
    if (this.runner) this.runner.grantHold();
    if (kind === 'struggle') this.hud.showStruggle(true);
    else this.hud.showPause(true, this.phase === 'play');
    eventBus.emit(Events.PAUSED, {});
  }

  resume() {
    if (!this.paused) return;
    this.hud.showPause(false);
    this.hud.showStruggle(false);
    this.hud.showSettings(false);
    this.paused = false;
    gameState.paused = false;
    if (!this.wasRunning || this.gateWaiting) {
      this.audio.duck(1, 0.3);
      eventBus.emit(Events.RESUMED, {});
      return;
    }
    // always a count-in before the music moves again
    this.countIn = { n: TIMING.COUNT_IN_BEATS, t: 0, every: this.shortCinematics ? 0.05 : this.transport.secPerBeat };
    this._countTick();
  }

  _countTick() {
    const c = this.countIn;
    this.hud.countIn(c.n);
    this.audio.count(null, c.n === TIMING.COUNT_IN_BEATS);
    eventBus.emit(Events.COUNT_IN, { n: c.n });
  }

  _updateCountIn(dt) {
    const c = this.countIn;
    c.t += dt;
    if (c.t < c.every) return;
    c.t -= c.every;
    c.n--;
    if (c.n > 0) {
      this._countTick();
      return;
    }
    this.countIn = null;
    this.hud.countIn(0);
    this.audio.duck(1, 0.2);
    const beat = this.transport.beat();
    this.transport.start(beat);
    this.arranger.reset(beat);
    eventBus.emit(Events.RESUMED, {});
  }

  /** Start the current passage over. Earlier Echoes are untouched. */
  restartPhrase() {
    if (this.phase !== 'play') return;
    this.hud.showPause(false);
    this.hud.showStruggle(false);
    this.audio.releaseAll();
    if (this.voyage.cross) {
      this.voyage.restart();
      return;
    }
    // throw away the unfinished path; if this was a replay the old one is still kept aside
    const i = this.mvt;
    if (this.world.paths[i]) {
      this.world.paths[i].dispose();
      this.world.paths[i] = null;
    }
    const old = this.world.oldPaths[i];
    this.world.oldPaths[i] = null;
    this.startMovement(i, { replay: this.replaying });
    this.world.oldPaths[i] = old;
  }

  /** Leave to the title. Finished movements are kept; an unfinished one is not. */
  leave() {
    this.hud.showPause(false);
    this.hud.showStruggle(false);
    this.audio.releaseAll();
    if (this.voyage.cross || this.voyage.song) {
      // out on the sea, leaving means back to the chart; a part that was not finished is not kept
      if (this.voyage.cross) this.voyage.abandon();
      this.voyage.open();
      return;
    }
    this.audio.duck(0, 0.3);
    if (this.phase === 'play') this._abandonCurrent();
    this.hud.showListen(false);
    this.hud.showRest(false);
    this.paused = false;
    gameState.paused = false;
    this.countIn = null;
    this.world.kite.lookBack = 0;
    this.toTitle();
  }

  _abandonCurrent() {
    const i = this.mvt;
    this.runner = null;
    this.world.seeds.clear();
    // rebuild from the records so nothing half-made is left behind
    this.world.restore(gameState.records, this.island.movements);
    if (!gameState.records[i] && this.world.paths[i]) {
      this.world.paths[i].dispose();
      this.world.paths[i] = null;
    }
    this.world.oldPaths[i] = null;
    this.replaying = false;
    gameState.replaying = null;
  }

  // -------------------------------------------------------------------------------
  // The frame
  // -------------------------------------------------------------------------------
  update(dt) {
    if (this.fadeIn > 0) {
      this.fadeIn = Math.max(0, this.fadeIn - dt / 1.6);
      this.world.post.setFade(this.fadeIn * this.fadeIn);
    }
    if (this.countIn) this._updateCountIn(dt);
    const beat = this.transport.beat();
    gameState.beat = beat;
    gameState.phase = this.phase;
    gameState.movement = this.mvt;

    const ctx = { beat, mvt: this.mvt, runner: this.runner, gate: this.gateWaiting, playing: false, echoes: this.echoes, follow: true, route: this.voyage.cross?.route ?? null };
    if (!this.paused) {
      switch (this.phase) {
        case 'play': this._updatePlay(beat, dt, ctx); break;
        case 'echoBirth': this._updateEchoBirth(dt, ctx); break;
        case 'transit': this._updateTransit(dt, ctx); break;
        case 'ignite': this._updateIgnite(dt, ctx); break;
        case 'reveal':
        case 'listen':
        case 'rest': this._updateSong(beat, dt, ctx); break;
        case 'end': this._updateEnd(dt, ctx); break;
        case 'title': this._updateTitle(dt, ctx); break;
        case 'sea': this.voyage.updateSea(dt, ctx); break;
        case 'arrive': this.voyage.updateArrive(dt, ctx); break;
        case 'arrived': this.voyage.updateArrived(dt, ctx); break;
        case 'bridgeSong': this.voyage.updateSong(beat, dt, ctx); break;
        default: break;
      }
    } else if (this.phase === 'play') {
      ctx.playing = false;
    }
    this.arranger.update(this.transport, this.clock);
    return ctx;
  }

  _updateTitle(dt, ctx) {
    ctx.runner = null;
    ctx.mvt = 0;
    ctx.beat = this.island.movements[0].startBeat;
    // stand to the sea side of Kite so the title's words have the left of the picture to
    // themselves, Kite waits on the right, and the lighthouse sits between them
    const f = this.world.routes[0].frameAt(ctx.beat, this._frame);
    const kite = this.world.override?.pos ?? f.pos;
    const t = TITLE_SHOT;
    this._shot.pos.copy(kite).addScaledVector(f.tan, -t.back).addScaledVector(f.right, -t.left).addScaledVector(UP, t.height);
    this._shot.look.copy(this._shot.pos).addScaledVector(f.tan, 50).addScaledVector(f.right, t.yaw).addScaledVector(UP, -t.drop);
    this.world.rig.setShot(this._shot, 6);
    ctx.echoes = [];
  }

  _updatePlay(beat, dt, ctx) {
    const runner = this.runner;
    const gate = runner.gateBeat();
    if (gate !== null && beat >= gate) {
      if (this.transport.running) {
        this.transport.stop();
        this.transport.seek(gate);
      }
      beat = gate;
      ctx.beat = gate;
      if (!this.gateWaiting) {
        this.gateWaiting = true;
        gameState.gateWaiting = true;
        this.hud.setPrompt(this.voyage.cross ? this.voyage.gatePrompt() : 'Play the glowing note.');
        eventBus.emit(Events.GATE_WAITING, {});
      }
    }
    ctx.gate = this.gateWaiting;
    ctx.playing = !this.countIn;
    if (this.countIn) return;

    if (this.bot) this.bot.update(beat);
    const sea = this.voyage.cross;
    this._dispatch(runner.advance(beat));
    this._echoSteps(beat);
    if (!sea) this._tips(beat);
    this._hudOffers(beat);
    if (!sea) this._struggle(beat);

    // Echoes step back while the player has something to decide, and forward when they rest
    // (on a crossing every beat is the player's, so the earlier parts simply keep them company)
    const next = runner.nextSlot();
    const busy = !sea && next && next.b - beat < 1.6;
    for (const e of this.echoes) e.opacity += ((sea ? 0.85 : busy ? 0.5 : 1) - e.opacity) * Math.min(1, dt * 2.5);

    const endAt = sea ? this.chart.endBeat - 0.4 : this.mvt === 2 ? this.chart.endBeat - 2.2 : this.chart.endBeat - 0.4;
    if (runner.done && beat >= endAt) {
      if (sea) this.voyage.complete();
      else this._completeMovement();
    }
  }

  _hudOffers(beat) {
    const runner = this.runner;
    const slot = runner.nextSlot();
    if (!slot) {
      this.hud.setOffers([], false, null, false);
      return;
    }
    if (slot.b - beat > 4.5 && !slot.gate) {
      this.hud.setOffers([], false, null, false);
      return;
    }
    const win = runner.windows[slot.i];
    this.hud.setOffers(runner.offers(slot), slot.gate || beat >= win.open, runner.resonantPitch(slot), slot.k === 'hold');
  }

  _tips(beat) {
    const list = TIPS[this.mvt] ?? [];
    let active = null;
    for (const tip of list) {
      if (beat < tip.from || beat > tip.to || !tip.text) continue;
      if (this.replaying) continue;
      if (tip.once && gameState.seen[`tip:${tip.once}`] && this.tip !== tip) continue;
      if (tip.needsEchoes && this.echoes.length < tip.needsEchoes) continue;
      if (tip.needsRing) {
        const slot = this.runner.slots.find((s) => s.id === tip.needsRing);
        if (!slot || this.runner.resonantPitch(slot) === null) continue;
      }
      active = tip;
    }
    if (active !== this.tip) {
      if (this.tip?.once) gameState.seen[`tip:${this.tip.once}`] = true;
      this.tip = active;
      if (!this.gateWaiting) this.hud.setPrompt(active ? active.text : null);
    }
  }

  /** If nearly a whole phrase went by untouched, offer a gentle choice instead of carrying on regardless. */
  _struggle(beat) {
    if (this.struggleOffered || this.replaying || this.bot) return;
    const boundary = Math.floor(beat / 16) * 16;
    if (boundary < 16 || this.phraseChecked.has(boundary) || beat - boundary > 0.6) return;
    this.phraseChecked.add(boundary);
    const phrase = this.runner.entries.filter((e) => e.b >= boundary - 16 && e.b < boundary);
    if (phrase.length < 4) return;
    const missed = phrase.filter((e) => e.outcome === 'miss').length;
    if (missed / phrase.length >= 0.75) {
      this.struggleOffered = true;
      this.pause('struggle');
      eventBus.emit(Events.PHRASE_STRUGGLE, { mvt: this.mvt, boundary });
    }
  }

  /** Light the stones an Echo steps on, exactly when it steps on them. */
  _echoSteps(beat) {
    for (const e of this.echoes) {
      const entries = e.record.entries;
      while (e.cursor < entries.length) {
        const n = entries[e.cursor];
        const at = n.outcome === 'hit' ? n.pressBeat : n.b;
        if (at > beat) break;
        e.cursor++;
        if (n.outcome !== 'hit' || at < beat - 1.5) continue;
        if (this.muted[e.mvt] && this.phase === 'listen') continue;
        if (e.route) {
          // a part of a sea bridge carries its own path and ghost
          if (this.phase === 'bridgeSong' && this.voyage.muted[e.mvt]) continue;
          e.path?.pulse(n.b, 1);
          this.world.seaWorld.ghosts[e.mvt]?.flash(undefined, 0.8);
          eventBus.emit(Events.ECHO_NOTE, { mvt: e.mvt, entry: n });
          continue;
        }
        this.world.paths[e.mvt]?.pulse(n.b, 1);
        this.world.ghosts[e.mvt]?.flash(undefined, 0.8);
        eventBus.emit(Events.ECHO_NOTE, { mvt: e.mvt, entry: n });
      }
    }
  }

  // -------------------------------------------------------------------------------
  // A movement ends
  // -------------------------------------------------------------------------------
  _completeMovement() {
    const i = this.mvt;
    const record = this.runner.record();
    gameState.records = replaceRecord(gameState.records, i, record);
    for (const d of record.discoveries) if (!gameState.discoveries.includes(d)) gameState.discoveries.push(d);
    this.world.commitReplace(i);
    this.audio.releaseAll();
    this.hud.setOffers([], false, null, false);
    this.hud.setPrompt(null);
    this.world.seeds.clear();
    this._applyAwake();
    if (i < 2 || this.replaying) this.world.awakeTarget = Math.max(this.world.awakeTarget, AWAKE_AFTER[Math.min(2, gameState.records.filter(Boolean).length - 1)]);
    Save.store({ records: gameState.records, discoveries: gameState.discoveries, seen: gameState.seen });
    this.hud.setPlace(this.island.title, i, this.chart.title, this._done());
    eventBus.emit(Events.MOVEMENT_COMPLETE, { mvt: i, replay: this.replaying });

    this.timer = 0;
    this.cine = {};
    if (this.replaying) {
      // a replaced part: a short look back, then on to wherever the journey stands —
      // the end card if everything is recorded, the next movement if that is still unplayed
      const all = gameState.records.every(Boolean);
      this.afterBirth = all ? 'end' : i < 2 && !gameState.records[i + 1] ? 'transit' : 'title';
      this._setPhase('echoBirth');
    } else if (i < 2) {
      // on to the next part if it is still unplayed; a journey played out of order goes home instead
      this.afterBirth = !gameState.records[i + 1] ? 'transit' : gameState.records.every(Boolean) ? 'end' : 'title';
      this._setPhase('echoBirth');
    } else {
      this._setPhase('ignite');
    }
  }

  _updateEchoBirth(dt, ctx) {
    const D = this.dur(TIMING.ECHO_BIRTH_SEC);
    const i = this.mvt;
    const route = this.world.routes[i];
    const chart = this.chart;
    const record = gameState.records[i];
    const beat = Math.min(this.transport.beat(), chart.endBeat);
    if (this.transport.running && this.transport.beat() >= chart.endBeat) {
      this.transport.stop();
      this.transport.seek(chart.endBeat);
    }
    this.timer += dt;
    const u = clamp01(this.timer / D);
    ctx.beat = beat;
    ctx.playing = false;

    // Kite turns to look at what they made
    this.world.kite.lookBack = u > 0.08 && u < 0.9 ? 1 : 0;
    if (!this.cine.shot) {
      this.cine.shot = true;
      route.pointAt(chart.endBeat + 1.6, 3.4, 4.6, this._shot.pos);
      route.pointAt(chart.endBeat - 12, 0, 1.2, this._shot.look);
      this.world.rig.setShot(this._shot, 1.1);
      this.audio.duck(0.55, 1.2);
      this.cine.hits = record.entries.filter((e) => e.outcome === 'hit');
      this.cine.next = 0;
    }

    // the path lights in the order it was played, with the first notes sounding again
    const hits = this.cine.hits;
    const lightU = clamp01((u - 0.1) / 0.5);
    const upTo = Math.floor(lightU * hits.length);
    while (this.cine.next < upTo) {
      const n = hits[this.cine.next];
      this.world.paths[i].pulse(n.b, 1.3);
      if (this.cine.next < 7) {
        this.audio.note({ instrument: chart.instrument, octave: chart.octave, pitch: n.p, dur: 0.5, bus: 'echo', gain: 0.9 });
      }
      this.cine.next++;
    }

    // the Echo appears where the movement began
    const ghostU = clamp01((u - 0.5) / 0.3);
    ctx.echoes = this.echoes.map((e) => ({ ...e, opacity: 0 }));
    if (ghostU > 0) {
      ctx.echoes.push({ mvt: i, record, chart, opacity: ghostU, beat: chart.startBeat });
      if (!this.cine.born) {
        this.cine.born = true;
        const key = `echo${i}`;
        const first = !gameState.seen[key];
        gameState.seen[key] = true;
        if (!this.replaying) this.hud.showCaption(i === 0 ? 'Your first Echo' : 'A second Echo', 3600);
        else this.hud.showCaption('A new Echo', 3000);
        void first;
        eventBus.emit(Events.ECHO_BORN, { mvt: i });
      }
    }

    if (u >= 1) {
      this.world.kite.lookBack = 0;
      if (this.afterBirth === 'end') this.toEnd(false);
      else if (this.afterBirth === 'title') this.toTitle();
      else this._startTransit();
    }
  }

  _startTransit() {
    const from = this.world.kitePos.clone();
    const next = this.mvt + 1;
    const chart = this.island.movements[next];
    const to = this.world.routes[next].pointAt(chart.startBeat, LANES.X[chart.startLane], LANES.Y[chart.startLane], new THREE.Vector3());
    this.cine = { curve: buildTransit(from, to, next === 2 ? 9 : 5), to, next };
    this.timer = 0;
    this._setPhase('transit');
    this.audio.swell(this.dur(TIMING.TRANSIT_SEC), 0.22, 2400);
    this.audio.duck(0.4, 1);
  }

  _updateTransit(dt, ctx) {
    const D = this.dur(TIMING.TRANSIT_SEC);
    this.timer += dt;
    const u = ease(clamp01(this.timer / D));
    const curve = this.cine.curve;
    const pos = curve.getPoint(u, this._v1);
    const tan = curve.getTangent(Math.min(0.999, u), this._v2);
    this.world.override = { pos: pos.clone(), yaw: Math.atan2(-tan.x, -tan.z), pose: 'glide' };
    this._shot.pos.copy(pos).addScaledVector(tan, -8.5).addScaledVector(UP, 3.4);
    this._shot.look.copy(pos).addScaledVector(tan, 7).addScaledVector(UP, 0.8);
    this.world.rig.setShot(this._shot, 3);
    if (Math.random() < dt * 30) this.world.effects.burst(pos, COLORS.BREATH, 2, 0.6, { up: 0.2, life: 1.0, size: 0.45, gravity: 0.1 });
    ctx.playing = false;
    ctx.follow = false;
    ctx.runner = null;
    ctx.echoes = [];
    if (this.timer >= D) {
      this.world.override = null;
      this.startMovement(this.cine.next);
    }
  }

  _updateIgnite(dt, ctx) {
    const D = this.dur(TIMING.IGNITE_SEC);
    const L = this.world.lighthouse;
    const chart = this.chart;
    if (this.transport.running && this.transport.beat() >= chart.endBeat) {
      this.transport.stop();
      this.transport.seek(chart.endBeat);
    }
    ctx.beat = Math.min(this.transport.beat(), chart.endBeat);
    ctx.playing = false;
    this.timer += dt;
    const u = clamp01(this.timer / D);
    if (!this.cine.started) {
      this.cine.started = true;
      this.audio.duck(0.12, 1.6); // the instant before the light is very quiet
      this.cine.from = this.world.camera.position.clone();
    }
    // close on Kite and the dark lens, then pull far back as the beam comes
    const out = this._v1.subVectors(this.world.kitePos, L.lensPos).setY(0).normalize();
    const side = this._v2.crossVectors(out, UP);
    const pull = ease(clamp01((u - 0.34) / 0.66));
    this._shot.pos.copy(L.lensPos).addScaledVector(out, 13 + pull * 78).addScaledVector(side, 5 + pull * 30).addScaledVector(UP, 1.5 + pull * 16);
    this._shot.look.copy(L.lensPos).addScaledVector(UP, -1 - pull * 6);
    this.world.rig.setShot(this._shot, 1.4);
    if (u > 0.34 && !this.cine.lit) {
      this.cine.lit = true;
      L.ignite();
      this.audio.ignite();
      this.world.awakeTarget = 1;
      this.world.effects.burst(L.lensPos, COLORS.GOLD, 120, 9, { up: 2, life: 2.2, size: 0.9, gravity: 0.2 });
      this.world.effects.rise(L.lensPos, COLORS.GOLD, 60, 6, 9);
      eventBus.emit(Events.IGNITE, {});
    }
    ctx.echoes = this.echoes.map((e) => ({ ...e, opacity: 0.8 }));
    if (u >= 1) this._startSong('reveal');
  }

  // -------------------------------------------------------------------------------
  // The song played back: World Reveal, Hear my song, Rest here
  // -------------------------------------------------------------------------------
  _startSong(phase) {
    const first = this.island.movements[0];
    this.runner = null;
    this.echoes = gameState.records
      .map((record, k) => (record ? { mvt: k, record, chart: this.island.movements[k], cursor: 0, opacity: 1 } : null))
      .filter(Boolean);
    this.arranger.setScene(phase === 'rest' ? 'rest' : 'reveal');
    this.arranger.setEchoes(this.echoes);
    this.arranger.muted = phase === 'listen' ? this.muted : [false, false, false];
    this.arranger.wheel = phase !== 'rest';
    const startBeat = Math.max(first.startBeat, -6);
    this.arranger.reset(startBeat);
    const pace = Object.values(PACE).find((p) => p.id === gameState.settings.pace) ?? PACE.FLOWING;
    this.transport.bpm = this.island.bpm * pace.scale;
    this.transport.seek(startBeat);
    this.transport.start();
    this.audio.duck(1, 0.8);
    this.audio.setAmbience(0.6, 2);
    // Kite waits at the lens, watching
    const last = this.island.movements[2];
    this._standAt(2, last.endBeat, last.endLane, 'idle');
    this.world.kite.lookBack = 1;
    this.timer = 0;
    this.cine = {};
    this._setPhase(phase);
    this.hud.showHud(false);
    if (phase === 'reveal') eventBus.emit(Events.REVEAL_STARTED, {});
  }

  _updateSong(beat, dt, ctx) {
    ctx.runner = null;
    ctx.follow = false;
    ctx.playing = false;
    ctx.mvt = 0;
    this._echoSteps(beat);
    if (this.phase === 'listen') {
      for (const e of this.echoes) e.opacity += ((this.muted[e.mvt] ? 0.12 : 1) - e.opacity) * Math.min(1, dt * 3);
    }
    this._revealCamera(beat, dt);
    if (beat >= 66.5) {
      if (this.phase === 'reveal') {
        eventBus.emit(Events.REVEAL_ENDED, {});
        this.toEnd(false);
      } else {
        // listening and resting loop gently
        for (const e of this.echoes) e.cursor = 0;
        this.arranger.reset(-6);
        this.transport.seek(-6);
        this.transport.start();
      }
    }
  }

  /** A camera journey from the first stone to the lit lens, through everything that was built. */
  _revealCamera(beat, dt) {
    const w = this.world;
    const [r0, r1] = w.routes;
    const L = w.lighthouse;
    const shots = [
      // along the causeway beside the first Echo
      // (high and outside the colonnade, so no column or the gate crosses the lens)
      { from: -8, to: 15, at: (b, s) => { r0.pointAt(b - 3.4, 12.5, 12, s.pos); r0.pointAt(b + 2.2, 0.5, 1.2, s.look); } },
      // down beneath, beside the second
      // (above the sea stacks on the open side, looking across to the road above)
      { from: 15, to: 30, at: (b, s) => { r1.pointAt(b - 3.8, -11, 9.5, s.pos); r1.pointAt(b + 2.4, 3, 1.6, s.look); } },
      // rising wide over both paths
      { from: 30, to: 45, at: (b, s) => { r0.pointAt(b - 7, -17, 15, s.pos); r0.pointAt(b + 6, -4, 0, s.look); } },
      // toward the island
      { from: 45, to: 57, at: (b, s) => { r0.pointAt(b - 3, 13, 9, s.pos); s.look.copy(L.lensPos).setY(L.lensPos.y * 0.55); } },
      // around the lit lantern room
      { from: 57, to: 80, at: (b, s) => {
        const a = 2.4 + (b - 57) * 0.085;
        s.pos.set(L.lensPos.x + Math.sin(a) * 34, L.lensPos.y + 7 - (b - 57) * 0.2, L.lensPos.z + Math.cos(a) * 34);
        s.look.copy(L.lensPos).setY(L.lensPos.y - 3);
      } },
    ];
    const blend = 3.5;
    let idx = shots.findIndex((s) => beat < s.to);
    if (idx === -1) idx = shots.length - 1;
    const cur = shots[idx];
    cur.at(beat, this._shot);
    const into = (beat - cur.from) / blend;
    if (idx > 0 && into < 1) {
      const prev = { pos: this._v1, look: this._v2 };
      shots[idx - 1].at(beat, prev);
      const k = ease(clamp01(into));
      this._shot.pos.lerpVectors(prev.pos, this._shot.pos, k);
      this._shot.look.lerpVectors(prev.look, this._shot.look, k);
    }
    w.rig.setShot(this._shot, 2.2);
    void dt;
  }

  // -------------------------------------------------------------------------------
  // The end card and its four choices
  // -------------------------------------------------------------------------------
  toEnd(instant) {
    this.runner = null;
    this.replaying = false;
    gameState.replaying = null;
    this.transport.stop();
    this.arranger.stop();
    this.audio.duck(0, 2.5);
    this.audio.setAmbience(1, 3);
    this.echoes = [];
    const last = this.island.movements[2];
    this._standAt(2, last.endBeat, last.endLane, 'idle');
    this.world.kite.lookBack = 1;
    if (instant) {
      this.world.lighthouse.ignite(true);
      this.world.awakeTarget = 1;
    }
    this.timer = 0;
    this._setPhase('end');
    this.hud.showHud(false);
    this.hud.showListen(false);
    this.hud.showRest(false);
    this.hud.showEnd(true, this._summary());
  }

  _summary() {
    const recs = gameState.records.filter(Boolean);
    const notes = recs.reduce((n, r) => n + r.entries.filter((e) => e.outcome === 'hit').length, 0);
    const found = gameState.discoveries.filter((d) => ['fish', 'chime', 'gulls', 'stars', 'crossing1', 'crossing2', 'crossing3'].includes(d));
    const crossings = found.filter((d) => d.startsWith('crossing')).length;
    const bits = [`${notes} notes of yours are in this place`];
    if (crossings) bits.push(`${crossings} ${crossings === 1 ? 'crossing' : 'crossings'} with your Echoes`);
    return bits.join(' · ') + '.';
  }

  _updateEnd(dt, ctx) {
    ctx.runner = null;
    ctx.follow = false;
    ctx.playing = false;
    ctx.echoes = [];
    this.timer += dt;
    const L = this.world.lighthouse;
    const a = 2.9 + this.timer * 0.03;
    this._shot.pos.set(L.lensPos.x + Math.sin(a) * 74, L.lensPos.y * 0.52, L.lensPos.z + Math.cos(a) * 74);
    this._shot.look.copy(L.lensPos).setY(L.lensPos.y * 0.7);
    this.world.rig.setShot(this._shot, 0.7);
  }

  /** UI actions from the end card and its sub-screens. */
  endAction(action, value) {
    // while a bridge of the sea is being heard, the listening bar belongs to it
    if (this.voyage.song && action === 'stem') {
      this.voyage.toggleStem(Number(value));
      return;
    }
    if (this.voyage.song && action === 'back') {
      this.voyage.back();
      return;
    }
    switch (action) {
      case 'listen':
        this.hud.showEnd(false);
        this.muted = [false, false, false];
        this.hud.showListen(true, this.muted);
        this._startSong('listen');
        break;
      case 'stem': {
        const i = Number(value);
        this.muted[i] = !this.muted[i];
        if (this.muted.every(Boolean)) this.muted[i] = false; // never all silent
        this.arranger.muted = this.muted;
        this.hud.showListen(true, this.muted);
        break;
      }
      case 'rest':
        this.hud.showEnd(false);
        this.hud.showRest(true);
        this._startSong('rest');
        break;
      case 'again':
        this.hud.showEnd(false);
        this.hud.showChooser(true);
        break;
      case 'replay':
        this.hud.showChooser(false);
        this.world.kite.lookBack = 0;
        this.startMovement(Number(value), { replay: true });
        break;
      case 'next':
        this.hud.showEnd(false);
        this.hud.showTeaser(true);
        break;
      case 'back':
        this.hud.showChooser(false);
        this.hud.showTeaser(false);
        if (this.phase === 'listen' || this.phase === 'rest') this.toEnd(false);
        else this.hud.showEnd(true, this._summary());
        break;
      default:
        break;
    }
  }

  _setPhase(phase) {
    this.phase = phase;
    gameState.phase = phase;
    this.hud.showKeys(phase === 'play');
    eventBus.emit(Events.PHASE_CHANGED, { phase, mvt: this.mvt });
  }
}
