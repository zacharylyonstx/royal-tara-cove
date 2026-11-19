// Everything drawn in the DOM: the five keys, the place name, one-line prompts, and the few
// screens outside play (title, pause, end card, settings). It reports intent through the
// EventBus as UI_ACTION and never touches game rules.

import { eventBus, Events } from '../core/EventBus.js';
import { PITCH_NAMES } from '../music/Theory.js';
import { DEFAULT_KEYS, PACE } from '../core/Constants.js';
import { keyLabel as capLabel, KEY_PRESETS, presetOf, labelMode } from '../systems/KeyMap.js';
import { SeaChart } from './SeaChart.js';

const NUMERALS = ['I', 'II', 'III'];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

let layout = null;
if (typeof navigator !== 'undefined' && navigator.keyboard?.getLayoutMap) {
  navigator.keyboard.getLayoutMap().then((m) => {
    layout = m;
    document.dispatchEvent(new Event('afternote:layout'));
  }).catch(() => {});
}

/** The text printed on a key, following the player's real keyboard layout where known. */
export function keyLabel(code) {
  return capLabel(code, layout);
}

export class Hud {
  constructor(root) {
    this.root = root;
    this.action = (action, value) => eventBus.emit(Events.UI_ACTION, { action, value });
    this._build();
    this.offers = '';
    this.captionTimer = null;
    this.codes = [...DEFAULT_KEYS];
    document.addEventListener('afternote:layout', () => this.setKeyCaps(this.codes));
  }

  _build() {
    const r = this.root;
    r.innerHTML = '';

    // --- in-play HUD -----------------------------------------------------------
    this.hud = el('div', 'hud hidden');
    this.place = el('div', 'place');
    this.placeTitle = el('div', 'place-title');
    this.progress = el('div', 'progress');
    this.placeSub = el('div', 'place-sub');
    this.place.append(this.placeTitle, this.progress, this.placeSub);

    this.pauseBtn = el('button', 'icon-btn pause-btn', '<span></span><span></span>');
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.addEventListener('click', () => this.action('pause'));

    this.prompt = el('div', 'prompt');
    this.caption = el('div', 'caption');
    this.count = el('div', 'count-in');

    this.keysRow = el('div', 'keys');
    this.keys = PITCH_NAMES.map((name, i) => {
      const k = el('div', 'key');
      k.dataset.pitch = String(i);
      const glyph = el('div', 'key-glyph');
      const letter = el('div', 'key-letter', name);
      const mark = el('div', 'key-mark');
      const cap = el('div', 'key-cap', keyLabel(DEFAULT_KEYS[i]));
      k.append(glyph, letter, mark, cap);
      this.keysRow.append(k);
      return { root: k, letter, cap, mark };
    });
    this.hud.append(this.place, this.pauseBtn, this.caption, this.prompt, this.count, this.keysRow);
    r.append(this.hud);

    // --- title -----------------------------------------------------------------
    this.title = el('div', 'screen title-screen');
    this.title.innerHTML = `
      <a class="home-link" href="/" aria-label="Back to Royal Tara Cove">&#8249; Royal Tara Cove</a>
      <div class="title-inner">
        <h1 class="logo">AFTERNOTE</h1>
        <p class="tagline">Play a note. Make somewhere to go.</p>
        <div class="title-actions">
          <button class="btn primary" data-action="begin">Begin</button>
          <button class="btn" data-action="continue" hidden>Return to your lighthouse</button>
          <button class="btn" data-action="sea">The Sea of Bridges</button>
          <button class="btn quiet" data-action="settings">Settings</button>
        </div>
        <div class="movements" aria-label="Movements">
          <div class="movements-label">Lighthouse of First Light · three movements</div>
          <div class="movements-row"></div>
          <p class="fine movements-hint"></p>
        </div>
        <p class="fine">Best with sound on.</p>
      </div>`;
    r.append(this.title);
    this.movementRow = this.title.querySelector('.movements-row');
    this.movementHint = this.title.querySelector('.movements-hint');
    this.movementChips = [];

    // --- before a journey is cleared -----------------------------------------------
    this.confirm = el('div', 'screen overlay hidden');
    this.confirm.innerHTML = `
      <div class="panel">
        <h2>Begin again?</h2>
        <p>Your lighthouse, its paths and its song will be cleared so a new journey can start.</p>
        <button class="btn primary" data-action="cancel-begin">Keep my lighthouse</button>
        <button class="btn quiet danger" data-action="confirm-begin">Clear it and begin again</button>
      </div>`;
    r.append(this.confirm);

    // --- pause -----------------------------------------------------------------
    this.pause = el('div', 'screen overlay hidden');
    this.pause.innerHTML = `
      <div class="panel">
        <h2>Paused</h2>
        <button class="btn primary" data-action="resume">Continue</button>
        <button class="btn" data-action="restart-phrase">Restart this passage</button>
        <button class="btn" data-action="settings">Controls &amp; settings</button>
        <button class="btn quiet" data-action="leave">Leave</button>
      </div>`;
    r.append(this.pause);

    // --- gentle retry ------------------------------------------------------------
    this.struggle = el('div', 'screen overlay hidden');
    this.struggle.innerHTML = `
      <div class="panel">
        <h2>Take your time</h2>
        <p>Press the glowing key as the ring closes around the stone ahead.<br>In Settings you can slow the pace, or let any key play the glowing note.</p>
        <button class="btn primary" data-action="restart-phrase">Try that part again</button>
        <button class="btn" data-action="resume">Keep going</button>
        <button class="btn quiet" data-action="settings">Settings</button>
      </div>`;
    r.append(this.struggle);

    // --- end card ----------------------------------------------------------------
    this.end = el('div', 'screen end-card hidden');
    this.end.innerHTML = `
      <div class="end-inner">
        <div class="end-kicker">Lighthouse of First Light</div>
        <h2 class="end-title">You made this.</h2>
        <p class="end-note"></p>
        <div class="end-actions">
          <button class="btn primary" data-action="listen">Hear my song</button>
          <button class="btn" data-action="again">Try another path</button>
          <button class="btn" data-action="rest">Rest here</button>
          <button class="btn" data-action="sea">The Sea of Bridges</button>
        </div>
      </div>`;
    r.append(this.end);

    // --- choose a movement to replace ----------------------------------------------
    this.chooser = el('div', 'screen overlay hidden');
    this.chooser.innerHTML = `
      <div class="panel">
        <h2>Try another path</h2>
        <p>Choose one part to play again. The other two stay exactly as you made them.<br>
        Your old part is only replaced when you finish the new one.</p>
        <div class="choose-row">
          <button class="btn tall" data-action="replay" data-value="0"><b>I</b><span>The Causeway</span></button>
          <button class="btn tall" data-action="replay" data-value="1"><b>II</b><span>The Answering Roots</span></button>
          <button class="btn tall" data-action="replay" data-value="2"><b>III</b><span>Lighting the Lens</span></button>
        </div>
        <button class="btn quiet" data-action="back">Back</button>
      </div>`;
    r.append(this.chooser);

    // --- listening ------------------------------------------------------------------
    this.listen = el('div', 'listen-bar hidden');
    this.listen.innerHTML = `
      <span class="listen-label">Your song</span>
      <button class="chip on" data-action="stem" data-value="0">I · Lead</button>
      <button class="chip on" data-action="stem" data-value="1">II · Roots</button>
      <button class="chip on" data-action="stem" data-value="2">III · Lens</button>
      <button class="chip" data-action="back">Back</button>`;
    r.append(this.listen);

    this.restBar = el('div', 'listen-bar hidden');
    this.restBar.innerHTML = `<span class="listen-label">Resting at the lighthouse</span><button class="chip" data-action="back">Back</button>`;
    r.append(this.restBar);

    // --- next place ------------------------------------------------------------------
    this.teaser = el('div', 'screen overlay hidden');
    this.teaser.innerHTML = `
      <div class="panel">
        <div class="end-kicker">The beam has found something</div>
        <h2>The Rootgarden</h2>
        <p>A garden drawn in pale stone, its plants only outlines, its water perfectly still.<br>
        It is still unheard — this place has not been built yet.</p>
        <button class="btn primary" data-action="back">Stay at the lighthouse</button>
      </div>`;
    r.append(this.teaser);

    // --- settings ---------------------------------------------------------------------
    this.settings = el('div', 'screen overlay hidden');
    this.settings.innerHTML = `
      <div class="panel wide">
        <h2>Settings</h2>
        <div class="set-row"><label>Pace</label>
          <div class="seg" data-setting="pace">
            <button data-value="${PACE.GENTLE.id}">Gentle</button>
            <button data-value="${PACE.UNHURRIED.id}">Unhurried</button>
            <button data-value="${PACE.FLOWING.id}">Flowing</button>
          </div>
        </div>
        <div class="set-row"><label>Helping hand</label>
          <div class="seg" data-setting="help">
            <button data-value="off">Exact key</button>
            <button data-value="near">Near keys</button>
            <button data-value="any">Any key</button>
          </div>
        </div>
        <div class="set-row"><label for="vol">Volume</label><input id="vol" type="range" min="0" max="1" step="0.01" data-setting="volume"></div>
        <div class="set-row needs-keyboard"><label>Labels</label><div class="seg" data-setting="labels"><button data-value="both">Notes + keys</button><button data-value="keys">Keys only</button><button data-value="notes">Notes only</button></div></div>
        <div class="set-row"><label>Motion</label><div class="seg" data-setting="reducedMotion"><button data-value="false">Full</button><button data-value="true">Reduced</button></div></div>
        <div class="set-row"><label>Contrast</label><div class="seg" data-setting="highContrast"><button data-value="false">Standard</button><button data-value="true">High</button></div></div>
        <div class="set-row needs-keyboard"><label>Keys</label>
          <div class="seg presets">
            <button data-action="preset-keys" data-value="numbers">${KEY_PRESETS.numbers.label}</button>
            <button data-action="preset-keys" data-value="home">${KEY_PRESETS.home.label}</button>
          </div>
        </div>
        <div class="set-row needs-keyboard"><label>Or choose</label>
          <div class="remap"></div>
        </div>
        <p class="fine remap-hint needs-keyboard"></p>
        <div class="set-actions">
          <button class="btn quiet danger" data-action="new-journey" hidden>Begin a new journey</button>
          <button class="btn primary" data-action="close-settings">Done</button>
        </div>
      </div>`;
    r.append(this.settings);
    this.remap = this.settings.querySelector('.remap');
    this.remapButtons = PITCH_NAMES.map((name, i) => {
      const b = el('button', 'remap-key', `<span class="cap"></span><b>${name}</b>`);
      b.dataset.action = 'remap';
      b.dataset.value = String(i);
      this.remap.append(b);
      return b;
    });

    // --- the sea chart and the arrival card (ui/SeaChart.js) ---------------------------
    this.seaChart = new SeaChart(r, this.action);
    r.addEventListener('keydown', (e) => {
      if (this.seaChart.key(e)) e.preventDefault();
    });
    this.listenDefault = [...this.listen.querySelectorAll('[data-action="stem"]')].map((b) => b.textContent);

    // one delegated listener for every button
    r.addEventListener('click', (e) => {
      if (this.seaChart.click(e)) return;
      const btn = e.target.closest('[data-action]');
      if (btn) {
        this.action(btn.dataset.action, btn.dataset.value);
        return;
      }
      const seg = e.target.closest('.seg button');
      if (seg) {
        const key = seg.parentElement.dataset.setting;
        let v = seg.dataset.value;
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        this.action('setting', { key, value: v });
      }
    });
    this.settings.querySelector('#vol').addEventListener('input', (e) => this.action('setting', { key: 'volume', value: Number(e.target.value) }));
  }

  // -------------------------------------------------------------------------------
  // In-play
  // -------------------------------------------------------------------------------
  showHud(v) {
    this.hud.classList.toggle('hidden', !v);
  }

  /** Whether a keyboard is in play; without one, settings about keys are hidden. */
  setKeyboard(v) {
    this.root.classList.toggle('no-keyboard', !v);
  }

  /** The five keys and the prompt step back during cinematic moments. */
  showKeys(v) {
    this.hud.classList.toggle('watching', !v);
  }

  setPlace(title, movementIndex, subtitle, done = []) {
    this.placeTitle.textContent = title;
    this.placeSub.textContent = subtitle ?? '';
    this.progress.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = el('span', 'dia' + (done[i] ? ' done' : '') + (i === movementIndex ? ' now' : ''));
      d.title = NUMERALS[i];
      this.progress.append(d);
      if (i < 2) this.progress.append(el('span', 'dia-line'));
    }
  }

  setKeyCaps(codes) {
    this.codes = [...codes];
    this.keys.forEach((k, i) => {
      k.cap.textContent = keyLabel(codes[i]);
    });
    this.remapButtons.forEach((b, i) => {
      b.querySelector('.cap').textContent = keyLabel(codes[i]);
    });
    const preset = presetOf(codes);
    this.settings.querySelectorAll('.presets button').forEach((b) => b.classList.toggle('on', b.dataset.value === preset));
  }

  /**
   * Which keys will build ground at the next beat.
   * @param {number[]} offers  pitches
   * @param {boolean} hot      the timing window is open now
   * @param {number|null} ring the resonant pitch, if any
   * @param {boolean} hold     the next note is a hold
   */
  setOffers(offers, hot, ring, hold) {
    const sig = `${offers.join(',')}|${hot ? 1 : 0}|${ring ?? ''}|${hold ? 1 : 0}`;
    if (sig === this.offers) return;
    this.offers = sig;
    this.keys.forEach((k, i) => {
      const on = offers.includes(i);
      k.root.classList.toggle('offered', on);
      k.root.classList.toggle('hot', on && hot);
      k.root.classList.toggle('ring', on && ring === i);
      k.root.classList.toggle('hold', on && hold);
    });
  }

  /** kind: 'hit' | 'soft' | 'down' | 'up' */
  flashKey(pitch, kind) {
    const k = this.keys[pitch]?.root;
    if (!k) return;
    if (kind === 'down') { k.classList.add('down'); return; }
    if (kind === 'up') { k.classList.remove('down'); return; }
    const cls = kind === 'hit' ? 'flash' : 'soft';
    k.classList.remove(cls);
    void k.offsetWidth;
    k.classList.add(cls);
  }

  setPrompt(text) {
    if (!text) {
      this.prompt.classList.remove('show');
      return;
    }
    this.prompt.textContent = text;
    this.prompt.classList.add('show');
  }

  showCaption(text, ms = 3600) {
    clearTimeout(this.captionTimer);
    this.caption.textContent = text;
    this.caption.classList.add('show');
    this.captionTimer = setTimeout(() => this.caption.classList.remove('show'), ms);
  }

  countIn(n) {
    if (!n) {
      this.count.classList.remove('show');
      return;
    }
    this.count.textContent = String(n);
    this.count.classList.remove('beat');
    void this.count.offsetWidth;
    this.count.classList.add('show', 'beat');
  }

  // -------------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------------
  _show(node, v) {
    node.classList.toggle('hidden', !v);
  }

  showTitle(v, { canContinue = false, complete = false } = {}) {
    this._show(this.title, v);
    const cont = this.title.querySelector('[data-action="continue"]');
    cont.hidden = !canContinue;
    cont.textContent = complete ? 'Return to your lighthouse' : 'Continue your journey';
    const begin = this.title.querySelector('[data-action="begin"]');
    begin.textContent = canContinue ? 'Begin again' : 'Begin';
    begin.classList.toggle('primary', !canContinue);
    cont.classList.toggle('primary', canContinue);
    this.settings.querySelector('[data-action="new-journey"]').hidden = !canContinue;
  }

  /**
   * The three movements on the title. A movement opens once the ones before it are recorded,
   * because it is played with their Echoes.
   * @param {Array<{numeral:string,title:string}>} movements
   * @param {boolean[]} done
   */
  setMovements(movements, done) {
    const next = done.indexOf(false);
    if (!this.movementChips.length) {
      movements.forEach((m, i) => {
        const b = el('button', 'movement-chip', `<b>${m.numeral}</b><span class="name">${m.title}</span><span class="mark"></span>`);
        b.dataset.action = 'title-movement';
        b.dataset.value = String(i);
        this.movementRow.append(b);
        this.movementChips.push(b);
      });
    }
    this.movementChips.forEach((b, i) => {
      // nothing is locked: 'next' is only where the story would go, 'open' is any other unplayed part
      const state = done[i] ? 'done' : i === next ? 'next' : 'open';
      b.dataset.state = state;
      b.disabled = false;
      b.querySelector('.mark').textContent = state === 'done' ? 'play again' : state === 'next' ? (i === 0 ? 'start here' : 'continue here') : 'play any time';
      b.setAttribute('aria-label', `${movements[i].numeral}. ${movements[i].title} — ${state === 'done' ? 'finished; play again' : 'play'}`);
    });
    this.movementHint.textContent = done.some(Boolean)
      ? 'Playing a finished movement again only replaces it if you finish the new one.'
      : '';
  }

  showConfirm(v) { this._show(this.confirm, v); }
  /** @param {boolean} canRestart  only a passage being played can be restarted */
  showPause(v, canRestart = true) {
    this._show(this.pause, v);
    this.pause.querySelector('[data-action="restart-phrase"]').hidden = !canRestart;
  }
  showStruggle(v) { this._show(this.struggle, v); }
  showChooser(v) { this._show(this.chooser, v); }
  showTeaser(v) { this._show(this.teaser, v); }
  showRest(v) { this._show(this.restBar, v); }

  showEnd(v, summary = '') {
    this._show(this.end, v);
    if (v) this.end.querySelector('.end-note').textContent = summary;
  }

  /**
   * The bar shown while a song plays back. `opts` relabels it for a bridge of the sea
   * ({label, stems:[names]}); passing null puts the lighthouse's own labels back.
   */
  showListen(v, muted = [false, false, false], opts = undefined) {
    this._show(this.listen, v);
    const stems = [...this.listen.querySelectorAll('[data-action="stem"]')];
    if (opts !== undefined) {
      this.listen.querySelector('.listen-label').textContent = opts?.label ?? 'Your song';
      stems.forEach((b, i) => {
        const name = opts ? opts.stems[i] : this.listenDefault[i];
        b.hidden = !name;
        if (name) b.textContent = opts ? `${NUMERALS[i]} · ${name}` : name;
      });
    }
    stems.forEach((b, i) => b.classList.toggle('on', !muted[i]));
  }

  showChart(v, view) { this.seaChart.show(v, view); }
  showArrival(v, data) { this.seaChart.showArrival(v, data); }

  showSettings(v, settings) {
    this._show(this.settings, v);
    if (v && settings) this.syncSettings(settings);
  }

  syncSettings(s) {
    this.settings.querySelectorAll('.seg[data-setting]').forEach((seg) => {
      const key = seg.dataset.setting;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(s[key]) === b.dataset.value));
    });
    this.settings.querySelector('#vol').value = String(s.volume);
    this.root.classList.toggle('high-contrast', !!s.highContrast);
    this.setKeyCaps(this.codes);
    const mode = labelMode(s);
    this.root.classList.toggle('labels-keys', mode === 'keys');
    this.root.classList.toggle('labels-notes', mode === 'notes');
    this.settings.querySelectorAll('.seg[data-setting="labels"] button').forEach((b) => b.classList.toggle('on', b.dataset.value === mode));
    this.setRemapping(null);
  }

  setRemapping(index) {
    this.remapButtons.forEach((b, i) => b.classList.toggle('listening', i === index));
    this.settings.querySelector('.remap-hint').textContent = index === null || index === undefined
      ? "Keys are shown as keycaps; notes are the italic letters. Typing a note's own letter (C D E G A) plays it too."
      : `Press the key you want for ${PITCH_NAMES[index]}…`;
  }
}
