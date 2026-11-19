// The orchestrator: builds every system, runs the frame, and exposes the hooks that agents
// and tests use to look inside (render_game_to_text, advanceTime).

import * as THREE from 'three-afternote';
import { eventBus, Events } from './EventBus.js';
import { gameState } from './GameState.js';
import { TIMING, DEFAULT_KEYS, PACE } from './Constants.js';
import { RealClock, ManualClock } from './Clock.js';
import { Transport } from '../music/Transport.js';
import { LIGHTHOUSE } from '../music/charts/lighthouse.js';
import { PITCH_NAMES } from '../music/Theory.js';
import { World } from '../world/World.js';
import { G } from '../world/Shared.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Arranger } from '../audio/Arranger.js';
import { Input } from '../systems/Input.js';
import { Save } from '../systems/Save.js';
import { Hud, keyLabel } from '../ui/Hud.js';
import { KEY_PRESETS, labelMode } from '../systems/KeyMap.js';
import { Conductor } from '../gameplay/Conductor.js';
import { Bot } from '../gameplay/Bot.js';

export class Game {
  constructor(container, uiRoot) {
    const params = new URLSearchParams(location.search);
    this.testMode = params.has('test');
    this.fx = params.get('fx') !== '0';
    this.container = container;

    // settings first: they shape everything else
    const saved = Save.loadSettings();
    if (saved) Object.assign(gameState.settings, saved);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !saved) gameState.settings.reducedMotion = true;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.fx, powerPreference: 'high-performance', preserveDrawingBuffer: this.testMode });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.clock = this.testMode ? new ManualClock() : new RealClock();
    this.transport = new Transport(this.clock);
    this.audio = new AudioEngine();
    this.arranger = new Arranger(this.audio, LIGHTHOUSE);
    this.world = new World(this.renderer, { fx: this.fx });
    this.hud = new Hud(uiRoot);
    this.conductor = new Conductor({
      clock: this.clock, transport: this.transport, world: this.world, audio: this.audio,
      arranger: this.arranger, hud: this.hud, island: LIGHTHOUSE, testMode: this.testMode,
      shortCinematics: this.testMode && !params.has('cine'),
    });

    this.input = new Input({
      onDown: (p, e) => this.conductor.handlePress(p, e),
      onUp: (p, e) => this.conductor.handleRelease(p, e),
      onPause: () => this._togglePause(),
      onConfirm: () => this._confirm(),
      onBlur: () => {
        if (!this.testMode) this.conductor.pause();
      },
      onKeyboard: () => {
        // someone on a touch device plugged in a keyboard: show them their keys
        if (!this.keyboard) {
          this.keyboard = true;
          this._applySettings();
        }
      },
    });
    this.input.attachPads(this.hud.keys.map((k) => k.root));
    this.settingsFrom = null;
    this.remapping = null;
    this.keyboard = !window.matchMedia?.('(pointer: coarse)').matches;
    document.addEventListener('afternote:layout', () => this._applySettings());

    eventBus.on(Events.UI_ACTION, ({ action, value }) => this._uiAction(action, value));
    this._applySettings();

    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.last = performance.now();
    this.conductor.boot();
    this._takeLink();
    window.addEventListener('hashchange', () => this._takeLink());
    this.step(1 / 60); // settle the first frame (the test clock never moves on its own)
    this._exposeHooks();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // -------------------------------------------------------------------------------
  // UI wiring
  // -------------------------------------------------------------------------------
  _startAudio() {
    if (this.testMode) return;
    const ctx = this.audio.init();
    if (ctx && !this.clock.ctx) {
      this.clock.attachAudio(ctx);
      this.input.enableMidi();
    }
    this.audio.setVolume(gameState.settings.volume);
  }

  /**
   * A bridge sent by link arrives in the address bar (#b=…). It is taken out of the address
   * at once, so a reload does not bring it twice, and handed to the sea.
   */
  _takeLink() {
    // (anything after the code is left out: a full stop typed after the link, or what a message app adds)
    const m = /^#b=([0-9a-z-]{1,260})/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    const c = this.conductor;
    const came = c.voyage.offer(m[1]);
    if (!came) return; // something is being played: it waits for the chart
    if (c.phase === 'sea') c.voyage.open({ fade: false });
    else if (c.phase === 'title') this.hud.showIncoming({ text: c.voyage.incomingText(came), hear: !!came.ref });
  }

  _confirm() {
    const c = this.conductor;
    if (c.phase === 'title' && this.hud.settings.classList.contains('hidden') && this.hud.confirm.classList.contains('hidden')) {
      this._uiAction(gameState.records.some(Boolean) ? 'continue' : 'begin');
    } else if (c.paused && !this.hud.pause.classList.contains('hidden')) {
      this._uiAction('resume');
    }
  }

  _togglePause() {
    const c = this.conductor;
    if (!this.hud.settings.classList.contains('hidden')) {
      this._uiAction('close-settings');
      return;
    }
    if (c.paused) c.resume();
    else c.pause();
  }

  _uiAction(action, value) {
    const c = this.conductor;
    switch (action) {
      case 'begin':
        // never clear a journey without asking
        if (gameState.records.some(Boolean)) {
          this.hud.showConfirm(true);
          break;
        }
        this._startAudio();
        c.begin();
        break;
      case 'confirm-begin':
        this.hud.showConfirm(false);
        this._startAudio();
        if (c.phase !== 'title') c.leave();
        c.begin();
        break;
      case 'cancel-begin':
        this.hud.showConfirm(false);
        break;
      case 'title-movement':
        this._startAudio();
        c.playFromTitle(Number(value));
        break;
      case 'continue':
        this._startAudio();
        c.resumeJourney();
        break;
      case 'pause':
        c.pause();
        break;
      case 'resume':
        c.resume();
        break;
      case 'restart-phrase':
        if (c.phase !== 'play') break;
        c.paused = false;
        gameState.paused = false;
        c.restartPhrase();
        break;
      case 'leave':
        c.leave();
        break;
      case 'settings':
        this.settingsFrom = c.paused ? (this.hud.struggle.classList.contains('hidden') ? 'pause' : 'struggle') : 'title';
        this.hud.showPause(false);
        this.hud.showStruggle(false);
        this.hud.showSettings(true, gameState.settings);
        break;
      case 'close-settings':
        this.hud.showSettings(false);
        this.input.capture = null;
        this.hud.setRemapping(null);
        if (this.settingsFrom === 'pause') this.hud.showPause(true, c.phase === 'play');
        else if (this.settingsFrom === 'struggle') this.hud.showStruggle(true);
        break;
      case 'setting':
        gameState.settings[value.key] = value.value;
        this._applySettings();
        break;
      case 'remap': {
        const i = Number(value);
        this.hud.setRemapping(i);
        this.input.capture = (code) => {
          const keys = [...(gameState.settings.keys ?? DEFAULT_KEYS)];
          if (code !== 'Escape') {
            const clash = keys.indexOf(code);
            if (clash !== -1 && clash !== i) keys[clash] = keys[i]; // swap rather than duplicate
            keys[i] = code;
            gameState.settings.keys = keys;
            this._applySettings();
          }
          this.hud.setRemapping(null);
        };
        break;
      }
      case 'preset-keys':
        gameState.settings.keys = value === 'numbers' ? null : [...KEY_PRESETS[value].codes];
        this.input.capture = null;
        this._applySettings();
        break;
      case 'new-journey':
        this.hud.showSettings(false);
        this.hud.showConfirm(true);
        break;
      default:
        if (action.startsWith('sea')) {
          this._startAudio();
          c.voyage.action(action, value);
        } else c.endAction(action, value);
        break;
    }
  }

  _applySettings() {
    const s = gameState.settings;
    const keys = s.keys ?? DEFAULT_KEYS;
    this.input.setKeys(keys);
    this.hud.setKeyCaps(keys);
    this.hud.syncSettings(s);
    this.audio.setVolume(s.volume);
    s.labels = labelMode(s);
    delete s.noteNames; // older saves
    this.world.setLabels(s.labels, keys.map((code) => keyLabel(code)), this.keyboard);
    this.hud.setKeyboard(this.keyboard);
    this.world.seeds.contrast = s.highContrast ? 1.8 : 1;
    this.world.rig.reducedMotion = !!s.reducedMotion;
    this.world.effects.reduced = !!s.reducedMotion;
    this.world.post.setReduced(!!s.reducedMotion);
    G.uContrast.value = s.highContrast ? 1 : 0;
    const pace = (Object.values(PACE).find((x) => x.id === s.pace) ?? PACE.FLOWING).scale;
    if (this.conductor.phase === 'play') this.transport.setBpm(LIGHTHOUSE.bpm * pace);
    Save.storeSettings(s);
    eventBus.emit(Events.SETTINGS_CHANGED, s);
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.world.resize(w, h, this.pixelRatio);
  }

  // -------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------
  step(dt) {
    const ctx = this.conductor.update(dt);
    this.world.update(dt, ctx);
  }

  _frame() {
    if (this.testMode) {
      // time only moves when advanceTime() is called; keep presenting the latest state
      this.world.render();
      return;
    }
    const now = performance.now();
    const dt = Math.min(TIMING.MAX_DT, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.world.render();
  }

  // -------------------------------------------------------------------------------
  // Hooks for agents and tests
  // -------------------------------------------------------------------------------
  _exposeHooks() {
    const game = this;
    window.render_game_to_text = () => {
      const c = game.conductor;
      const r = c.runner;
      const beat = game.transport.beat();
      const next = r ? r.nextSlot() : null;
      const kite = r ? r.kiteAt(beat) : null;
      return JSON.stringify({
        phase: c.phase,
        movement: c.mvt,
        movementId: LIGHTHOUSE.movements[c.mvt].id,
        beat: Math.round(beat * 1000) / 1000,
        bpm: game.transport.bpm,
        paused: c.paused,
        countIn: c.countIn ? c.countIn.n : 0,
        gateWaiting: c.gateWaiting,
        replaying: c.replaying,
        next: next ? { beat: next.b, kind: next.k, source: next.src, offers: r.offers(next).map((p) => PITCH_NAMES[p]), ring: r.resonantPitch(next) === null ? null : PITCH_NAMES[r.resonantPitch(next)] } : null,
        lane: r ? PITCH_NAMES[r.lane] : null,
        kite: kite ? { x: +kite.x.toFixed(2), y: +kite.y.toFixed(2), pose: kite.pose, air: kite.air } : null,
        entries: r ? { hits: r.entries.filter((e) => e.outcome === 'hit').length, misses: r.entries.filter((e) => e.outcome === 'miss').length, total: r.slots.length } : null,
        pieces: r ? r.pieces.length : 0,
        melody: r ? r.entries.map((e) => (e.outcome === 'hit' ? PITCH_NAMES[e.p] : '-')).join(' ') : '',
        choices: r ? r.choices : {},
        records: gameState.records.map((x) => (x ? { hits: x.entries.filter((e) => e.outcome === 'hit').length, misses: x.entries.filter((e) => e.outcome === 'miss').length, choices: x.choices } : null)),
        echoes: c.echoes.map((e) => e.mvt),
        discoveries: gameState.discoveries,
        lighthouseLit: game.world.lighthouse.lit,
        awake: +G.uAwake.value.toFixed(2),
        settings: { pace: gameState.settings.pace, help: gameState.settings.help, keys: gameState.settings.keys ?? DEFAULT_KEYS },
        labels: {
          mode: gameState.settings.labels,
          keys: game.world.seeds.keyLabels,
          capsInWorld: game.world.seeds.showCaps,
          notesInWorld: game.world.seeds.showNames,
        },
        lastEvents: c.lastEvents,
        sea: c.voyage.snapshot(),
        ui: {
          chart: game.hud.seaChart.visible,
          arrival: !game.hud.seaChart.arrival.classList.contains('hidden'),
          incoming: game.hud.incoming.classList.contains('hidden') ? '' : game.hud.incoming.querySelector('.incoming-text').textContent,
          sending: game.hud.seaChart.sending,
          title: !game.hud.title.classList.contains('hidden'),
          pause: !game.hud.pause.classList.contains('hidden'),
          end: !game.hud.end.classList.contains('hidden'),
          confirm: !game.hud.confirm.classList.contains('hidden'),
          movements: game.hud.movementChips.map((b) => b.dataset.state),
          prompt: game.hud.prompt.classList.contains('show') ? game.hud.prompt.textContent : '',
        },
      });
    };

    window.advanceTime = (ms) => {
      let left = ms / 1000;
      const stepSize = TIMING.TEST_STEP;
      while (left > 1e-9) {
        const dt = Math.min(stepSize, left);
        if (game.clock.manual) game.clock.advance(dt);
        game.step(dt);
        left -= dt;
      }
      game.world.render();
      return window.render_game_to_text();
    };

    window.__afternote = {
      game,
      state: gameState,
      events: eventBus,
      /** Let a rule-following bot play. opts: strategy, miss, offset, hold, seed. Pass null to stop. */
      bot(opts) {
        game.conductor.bot = opts === null ? null : new Bot(game.conductor, opts ?? {});
        return !!game.conductor.bot;
      },
      press(name) {
        game.conductor.handlePress(PITCH_NAMES.indexOf(name));
      },
      /** The Sea of Bridges: open the chart, build / add to / hear a bridge, without going through the screens. */
      sea: {
        open: () => game.conductor.voyage.open(),
        build: (edge, opts = {}) => game.conductor.voyage.build(edge, opts),
        add: (edge, opts = {}) => game.conductor.voyage.addPart(edge, opts),
        listen: (edge) => game.conductor.voyage.listen(edge),
        view: () => game.conductor.voyage.view(),
      },
      release(name) {
        game.conductor.handleRelease(PITCH_NAMES.indexOf(name));
      },
    };
  }
}
