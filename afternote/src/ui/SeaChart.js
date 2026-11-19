// The chart of the Sea of Bridges, and the card shown on arriving somewhere.
//
// The chart is the menu, the progress and the songbook at once: every place, every bridge
// that could be built (a dotted line), and every bridge that has been (a line of light with
// one strand per part). Choosing a line is choosing what to do next.
//
// Like the rest of the HUD it only reports intent (UI_ACTION); it knows no rules.

import { PLACES, PLACE, EDGE, SOUNDS, MOODS, otherEnd } from '../music/sea.js';
import { CROSSING } from '../core/Constants.js';

// (plain numbers: a six-year-old reads "2" long before "II")
const NUMERALS = ['1', '2', '3'];

/** Small drawn signs, so the main buttons can be read without reading. */
const ic = (d, stroke = false) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"${stroke ? ' fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"' : ''}/></svg>`;
const ICON = {
  play: ic('M7.5 4.5v15l12-7.5z'),
  add: ic('M12 5v14M5 12h14', true),
  build: ic('M3 18c3-10 15-10 18 0M7.2 12.4v.1M12 10.4v.1M16.8 12.4v.1', true),
  send: ic('M3 11.4 21 3l-6.6 18-3-7.6z'),
  map: ic('M4 6.5 9.5 4l5 2.5L20 4v13.5L14.5 20l-5-2.5L4 20zM9.500 4v13.5M14.5 6.5V20', true),
  copy: ic('M9 9h10v11H9zM5 15V4h10', true),
};

/** About how long a crossing takes, said the way a child would. */
function about(seconds) {
  if (seconds < 50) return `about ${Math.max(10, Math.round(seconds / 5) * 5)} seconds`;
  const halves = Math.round(seconds / 30);
  return halves === 2 ? 'about a minute' : `about ${Math.floor(halves / 2)}${halves % 2 ? '½' : ''} minutes`;
}
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const STRAND = ['#ffd08a', '#a9d8ff', '#d9b8ff'];
const PLACE_TINT = {
  lighthouse: '#ffc870', chimes: '#ffe6b0', harp: '#8fe8d8', garden: '#c8f09a', stacks: '#cfd8ff', harbor: '#ffb06a', deep: '#7df0ff',
};
const W = 1000, H = 700, PAD_X = 120, PAD_TOP = 86, PAD_BOTTOM = 96;
// bridges that came from another sea wait in the empty corner of the chart, six to a row
const AFAR_X = 54, AFAR_Y = 616, AFAR_STEP = 56, AFAR_ROW = 6;
const selOf = (ref) => (ref.startsWith('afar:') ? { kind: 'afar', id: Number(ref.slice(5)) } : { kind: 'edge', id: ref });

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// where each place sits on the chart: east is right, and the far north of the sea is the top
const xs = PLACES.map((p) => p.x), zs = PLACES.map((p) => p.z);
const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
const POS = Object.fromEntries(PLACES.map((p) => [p.id, {
  x: PAD_X + ((p.x - minX) / (maxX - minX)) * (W - 2 * PAD_X),
  y: PAD_TOP + ((p.z - minZ) / (maxZ - minZ)) * (H - PAD_TOP - PAD_BOTTOM),
}]));

/** A small drawn sign for each kind of place (24 x 24, centred on 0,0). */
function glyph(kind) {
  switch (kind) {
    case 'home': return '<path d="M-5 9 L-3 -5 L3 -5 L5 9 Z M-4 -5 L0 -11 L4 -5 Z"/><path d="M-13 -8 L-5 -7 M13 -8 L5 -7" fill="none"/>';
    case 'chimes': return '<path d="M-9 -9 H9 M-6 -9 V5 M0 -9 V9 M6 -9 V2" fill="none"/>';
    case 'harp': return '<path d="M-8 9 L-8 -10 L9 2 L-8 9 Z M-4 7 V-7 M0 5 V-4 M4 4 V-1" fill="none"/>';
    case 'garden': return '<path d="M0 10 V-1" fill="none"/><circle cx="0" cy="-5" r="6" fill="none"/><path d="M0 2 L-5 -2 M0 4 L5 0" fill="none"/>';
    case 'stacks': return '<path d="M-9 10 V-4 M-2 10 V-11 M5 10 V-7 M11 10 V1" fill="none"/>';
    case 'harbor': return '<circle cx="0" cy="0" r="8.5" fill="none"/><path d="M0 -8.5 V8.5 M-8.5 0 H8.5 M-6 -6 L6 6 M-6 6 L6 -6" fill="none"/>';
    default: return '<circle cx="-6" cy="3" r="2.2"/><circle cx="3" cy="-5" r="2.2"/><circle cx="7" cy="5" r="2.2"/><circle cx="-2" cy="-1" r="1.4"/>';
  }
}

export class SeaChart {
  /**
   * @param {HTMLElement} root   the HUD root
   * @param {(action:string, value:any)=>void} action
   */
  constructor(root, action) {
    this.action = action;
    this.view = null;
    this.sel = null; // { kind:'edge'|'place', id }
    this.pick = { sound: null, mood: null };
    this.over = false; // starting an existing bridge over
    this.sending = false; // showing the link to the chosen bridge
    this.wantSend = false; // ...as soon as the chart next opens
    this.confirm = false; // asking before a bridge from afar is let go
    // A finger still tapping where the last screen's button was must not press this screen's
    // (children do this a great deal). After a screen or its buttons change, taps wait a moment.
    this.settle = 1; // 0 in tests, which click as fast as they can
    this.quietUntil = 0;

    this.node = el('div', 'screen chart-screen hidden');
    this.node.innerHTML = `
      <div class="chart-head">
        <div class="chart-kicker">Beyond the lighthouse</div>
        <h2 class="chart-title">The Sea of Bridges</h2>
      </div>
      <div class="chart-body">
        <div class="chart-map-wrap"><svg class="chart-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Map of the sea"></svg></div>
        <div class="chart-panel" aria-live="polite"></div>
      </div>
      <div class="chart-foot">
        <span class="chart-tally"></span>
        <button class="btn quiet" data-action="sea-home">Back to the lighthouse</button>
      </div>`;
    root.append(this.node);
    this.svg = this.node.querySelector('.chart-map');
    this.panel = this.node.querySelector('.chart-panel');
    this.tally = this.node.querySelector('.chart-tally');

    this.arrival = el('div', 'screen arrival-card hidden');
    root.append(this.arrival);
    this.arrivalData = null;
    this.arrivalSound = null;
  }

  get visible() {
    return !this.node.classList.contains('hidden');
  }

  // -------------------------------------------------------------------------------
  // The chart
  // -------------------------------------------------------------------------------
  show(v, view = null) {
    this.node.classList.toggle('hidden', !v);
    if (!v) return;
    this.view = view;
    this.over = false;
    this.confirm = false;
    if (view.focus) this.sel = selOf(view.focus);
    // keep looking at the same thing if it is still there; otherwise suggest what to do next
    if (this.sel?.kind === 'edge' && !EDGE[this.sel.id]) this.sel = null;
    if (this.sel?.kind === 'afar' && !view.afar[this.sel.id]) this.sel = null;
    if (!this.sel) this.sel = this._suggest();
    this.sending = this.wantSend && !!this._chosen();
    this.wantSend = false;
    this.pick = { sound: null, mood: null };
    this._quiet(550);
    this._draw();
    // (so the next Tab lands on what to do, without Enter or Space doing anything by surprise)
    this.panel.tabIndex = -1;
    this.panel.focus({ preventScroll: true });
  }

  _quiet(ms) {
    this.quietUntil = performance.now() + ms * this.settle;
  }

  /** The name the game knows the chosen bridge by: its edge, or 'afar:<n>'. */
  _ref() {
    return this.sel?.kind === 'afar' ? `afar:${this.sel.id}` : this.sel?.kind === 'edge' ? this.sel.id : null;
  }

  /** The chosen bridge, if what is chosen is a bridge that has been built. */
  _chosen() {
    const v = this.view;
    if (this.sel?.kind === 'afar') return v.afar[this.sel.id] ?? null;
    if (this.sel?.kind === 'edge') return v.bridges[this.sel.id] ?? null;
    return null;
  }

  _link(code) {
    return `${location.origin}${location.pathname}#b=${code}`;
  }

  /** What a player would most likely want next: an unbuilt bridge from where they are. */
  _suggest() {
    const v = this.view;
    const reachable = v.edges.filter((e) => !v.bridges[e.id] && e.start);
    const fromHere = reachable.find((e) => e.start === v.at);
    const toNew = reachable.find((e) => !v.awake.includes(otherEnd(e, e.start)));
    const edge = fromHere ?? toNew ?? reachable[0];
    if (edge) return { kind: 'edge', id: edge.id };
    const built = v.edges.find((e) => v.bridges[e.id] && v.bridges[e.id].layers.length < CROSSING.MAX_LAYERS) ?? v.edges.find((e) => v.bridges[e.id]);
    return built ? { kind: 'edge', id: built.id } : { kind: 'place', id: v.at };
  }

  _draw() {
    const v = this.view;
    const parts = [];
    // bridges and the lines where bridges could be
    for (const e of v.edges) {
      const a = POS[e.a], b = POS[e.b];
      const bridge = v.bridges[e.id];
      const selected = (this.sel?.kind === 'edge' && this.sel.id === e.id) || (this.sel?.kind === 'afar' && v.afar[this.sel.id]?.edge === e.id);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const trim = 30;
      const x1 = a.x + (dx / len) * trim, y1 = a.y + (dy / len) * trim, x2 = b.x - (dx / len) * trim, y2 = b.y - (dy / len) * trim;
      let lines = '';
      if (bridge) {
        const n = bridge.layers.length;
        bridge.layers.forEach((_, k) => {
          const off = (k - (n - 1) / 2) * 7;
          lines += `<line class="strand" x1="${x1 + nx * off}" y1="${y1 + ny * off}" x2="${x2 + nx * off}" y2="${y2 + ny * off}" stroke="${STRAND[k]}"/>`;
        });
      } else {
        lines = `<line class="dots" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
      const state = bridge ? 'built' : e.start ? 'open' : 'far';
      parts.push(`<g class="edge ${state}${selected ? ' sel' : ''}" data-edge="${e.id}" tabindex="0" role="button" aria-label="${esc(PLACE[e.a].name)} to ${esc(PLACE[e.b].name)}: ${bridge ? `a bridge of ${bridge.layers.length} ${bridge.layers.length === 1 ? 'part' : 'parts'}` : e.start ? 'no bridge yet' : 'too far for now'}">
        <line class="halo" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${lines}
        <line class="hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></g>`);
    }
    // places
    for (const p of PLACES) {
      const { x, y } = POS[p.id];
      const awake = v.awake.includes(p.id);
      const selected = this.sel?.kind === 'place' && this.sel.id === p.id;
      const here = v.at === p.id;
      parts.push(`<g class="place ${awake ? 'awake' : 'asleep'}${selected ? ' sel' : ''}${here ? ' here' : ''}" data-place="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}${awake ? '' : ', asleep'}" style="--tint:${PLACE_TINT[p.id]}" transform="translate(${x} ${y})">
        <circle class="glow" r="34"/><circle class="reach" r="52"/><circle class="disc" r="23"/>
        <g class="glyph">${glyph(p.kind)}</g>
        ${here ? '<path class="kite" d="M0 -40 L7 -31 L0 -22 L-7 -31 Z"/>' : ''}
        <text class="name" y="46">${esc(p.name)}</text></g>`);
    }
    // bridges from another sea
    if (v.afar.length) {
      parts.push(`<text class="afar-label" x="${AFAR_X - 20}" y="${AFAR_Y - 34}">From friends</text>`);
      v.afar.forEach((g, i) => {
        const x = AFAR_X + (i % AFAR_ROW) * AFAR_STEP, y = AFAR_Y + Math.floor(i / AFAR_ROW) * (AFAR_STEP - 8);
        const n = g.layers.length;
        const to = otherEnd(EDGE[g.edge], g.from);
        parts.push(`<g class="afar${this.sel?.kind === 'afar' && this.sel.id === i ? ' sel' : ''}" data-afar="${i}" tabindex="0" role="button" aria-label="A bridge from a friend: ${esc(PLACE[g.from].name)} to ${esc(PLACE[to].name)}, ${n} ${n === 1 ? 'part' : 'parts'}" transform="translate(${x} ${y})">
          <circle class="reach" r="30"/><circle class="disc" r="21"/><path class="arc" d="M-11 4 Q0 -16 11 4"/>
          ${g.layers.map((_, k) => `<circle cx="${(k - (n - 1) / 2) * 8}" cy="11" r="2.6" fill="${STRAND[k]}"/>`).join('')}</g>`);
      });
    }
    this.svg.innerHTML = parts.join('');
    this._panel();
    const built = Object.keys(v.bridges).length;
    this.tally.textContent = `${built} of ${v.edges.length} bridges · ${v.awake.length} of ${PLACES.length} places awake · ${v.sounds.length} of ${Object.keys(SOUNDS).length} sounds`;
  }

  _chips(kind, ids, current) {
    const table = kind === 'sound' ? SOUNDS : MOODS;
    // a mood wears the colour of its sky; a sound is known by ear (tapping one plays it)
    const dot = (id) => (kind === 'mood' ? `<i class="dot" style="background:${hex(MOODS[id].sky?.horizon ?? 0xc9a0d8)}"></i>` : '');
    return `<div class="chip-row" data-pick="${kind}">${ids.map((id) => `<button class="chip${id === current ? ' on' : ''}" data-chart="pick" data-kind="${kind}" data-id="${id}" aria-pressed="${id === current}">${dot(id)}${esc(table[id].name)}</button>`).join('')}</div>
      <div class="chip-hint">${esc(table[current]?.hint ?? '')}</div>`;
  }

  _panel() {
    const v = this.view;
    const sel = this.sel;
    let html = '';
    let foot = ''; // what stays in reach beneath the part that scrolls
    const chosen = this._chosen();
    const partsList = (b) => `<ul class="parts">${b.layers.map((l, k) => `<li><b style="color:${STRAND[k]}">${NUMERALS[k]}</b><span>${esc(SOUNDS[l.sound].name)}</span><i>${l.notes} ${l.notes === 1 ? 'stone' : 'stones'}</i></li>`).join('')}</ul>`;
    const hear = `<button class="btn primary" data-chart="listen">${ICON.play}<span>Hear it</span></button>`;
    const addBtn = (n) => `<button class="btn" data-chart="add">${ICON.add}<span>Add part ${NUMERALS[n]}</span></button>`;
    if (this.sending && chosen) {
      const full = chosen.layers.length >= CROSSING.MAX_LAYERS;
      html = `<div class="panel-kicker">A link to this bridge</div><h3>Send it to someone</h3>
        <p>${full ? 'Send this link to someone. They can hear your bridge.' : 'Send this link to someone. They can hear your bridge and add a part of their own.'}</p>
        <input class="link-box" readonly value="${esc(this._link(chosen.code))}" aria-label="The link to this bridge">
        <p class="fine link-note">The link holds only the notes. Nothing about you.</p>`;
      const copy = `<button class="btn primary" data-chart="copy">${ICON.copy}<span>Copy link</span></button>`;
      foot = `${navigator.share ? `<div class="pair">${copy}<button class="btn" data-chart="share">${ICON.send}<span>Share</span></button></div>` : copy}
        <button class="btn quiet small" data-chart="send-done">Done</button>`;
    } else if (sel?.kind === 'afar') {
      const g = chosen;
      const to = otherEnd(EDGE[g.edge], g.from);
      html = `<div class="panel-kicker">From a friend · ${esc(MOODS[g.mood].name)}</div><h3>${esc(PLACE[g.from].name)} <span class="arrow">to</span> ${esc(PLACE[to].name)}</h3>${partsList(g)}`;
      if (this.confirm) {
        html += `<p>Let this bridge go? You can only get it back with its link.</p>`;
        foot = `<button class="btn primary" data-chart="release-no">Keep it</button><button class="btn quiet small" data-chart="release-yes">Let it go</button>`;
      } else {
        html += `<div class="panel-row"><button class="btn quiet small" data-chart="send">${g.layers.length > 1 ? 'Send it back' : 'Send it on'}</button>
          ${g.canKeep ? `<button class="btn quiet small" data-chart="keep-afar">${g.swaps ? 'Swap with mine' : 'Put it on my map'}</button>` : ''}
          <button class="btn quiet small" data-chart="release">Let it go</button></div>
          ${g.canKeep && g.swaps ? '<p class="fine">Swapping keeps both: your own bridge waits here instead.</p>' : ''}`;
        foot = hear;
        if (g.layers.length < CROSSING.MAX_LAYERS) {
          const used = g.layers.map((l) => l.sound);
          if (!this.pick.sound) this.pick.sound = v.sounds.find((x) => !used.includes(x)) ?? v.sounds[0];
          html += `<div class="panel-label">Pick a sound for your part</div>${this._chips('sound', v.sounds, this.pick.sound)}`;
          foot = `<div class="pair">${foot}${addBtn(g.layers.length)}</div>`;
        } else {
          html += `<p class="fine">This bridge has all three parts.</p>`;
        }
      }
    } else if (!sel) {
      html = `<h3>Where to?</h3><p>Tap a dotted line to build a bridge. Tap a bridge to hear it.</p>`;
    } else if (sel.kind === 'place') {
      const p = PLACE[sel.id];
      const awake = v.awake.includes(p.id);
      const gift = p.gift;
      html = `<div class="panel-kicker">${awake ? (v.at === p.id ? 'You are here' : 'Awake') : 'Asleep'}</div><h3>${esc(p.name)}</h3><p>${esc(p.blurb)}</p>`;
      if (gift) {
        html += awake
          ? `<p class="gift">It gave you <b>${esc(SOUNDS[gift.sound].name)}</b> and <b>${esc(MOODS[gift.mood].name)}</b>.</p>`
          : `<p class="gift">Build a bridge here to wake it up. It has a new sound for you.</p>`;
      }
    } else {
      const e = v.edges.find((x) => x.id === sel.id);
      const bridge = v.bridges[e.id];
      if (bridge && !this.over) {
        const to = otherEnd(e, bridge.from);
        const mood = MOODS[bridge.mood];
        html = `<div class="panel-kicker">A bridge · ${esc(mood.name)}</div><h3>${esc(PLACE[bridge.from].name)} <span class="arrow">to</span> ${esc(PLACE[to].name)}</h3>
          ${partsList(bridge)}
          <div class="panel-row"><button class="btn quiet small" data-chart="over">Start over</button><button class="btn quiet small" data-chart="send">Send it to someone</button></div>`;
        foot = hear;
        if (bridge.layers.length < CROSSING.MAX_LAYERS) {
          const used = bridge.layers.map((l) => l.sound);
          if (!this.pick.sound) this.pick.sound = v.sounds.find((s) => !used.includes(s)) ?? v.sounds[0];
          html += `<div class="panel-label">Pick a sound for part ${NUMERALS[bridge.layers.length]}</div>${this._chips('sound', v.sounds, this.pick.sound)}`;
          foot = `<div class="pair">${foot}${addBtn(bridge.layers.length)}</div>`;
        } else {
          html += `<p class="fine">This bridge has all three parts.</p>`;
        }
      } else if (e.start) {
        const to = otherEnd(e, e.start);
        if (!this.pick.sound) this.pick.sound = PLACE[e.start].gift && v.sounds.includes(PLACE[e.start].gift.sound) ? PLACE[e.start].gift.sound : v.sounds[0];
        if (!this.pick.mood) this.pick.mood = PLACE[e.start].gift && v.moods.includes(PLACE[e.start].gift.mood) ? PLACE[e.start].gift.mood : v.moods[0];
        // (the walk out and the walk in are part of it, as well as the bars of the bridge)
        const secs = ((e.bars * 4 + 8) * 60) / ((v.bpm ?? 80) * MOODS[this.pick.mood].tempo);
        html = `<div class="panel-kicker">${bridge ? 'Start over' : v.awake.includes(to) ? 'A new bridge' : 'Somewhere new'} · ${about(secs)}</div>
          <h3>${esc(PLACE[e.start].name)} <span class="arrow">to</span> ${esc(PLACE[to].name)}</h3>
          <p>${bridge ? 'Your old bridge stays until the new one is done.' : 'Play any keys. Your notes turn into stones. You can\'t get it wrong.'}</p>
          <div class="panel-label">Sound</div>${this._chips('sound', v.sounds, this.pick.sound)}
          <div class="panel-label">Mood</div>${this._chips('mood', v.moods, this.pick.mood)}`;
        foot = `<button class="btn primary" data-chart="build">${ICON.build}<span>${bridge ? 'Build it again' : 'Build this bridge'}</span></button>
          ${bridge ? '<button class="btn quiet" data-chart="keep">Keep the old one</button>' : ''}`;
      } else {
        html = `<div class="panel-kicker">Too far for now</div><h3>${esc(PLACE[e.a].name)} <span class="arrow">to</span> ${esc(PLACE[e.b].name)}</h3>
          <p>Go to ${esc(PLACE[e.a].name)} or ${esc(PLACE[e.b].name)} first. Then you can build this bridge.</p>`;
      }
    }
    // choosing a sound or a mood must not throw the list back to its top
    const top = this.panel.querySelector('.panel-scroll')?.scrollTop ?? 0;
    this.panel.innerHTML = `<div class="panel-scroll">${html}</div>${foot ? `<div class="panel-foot">${foot}</div>` : ''}`;
    const key = sel ? `${sel.kind}:${sel.id}:${this.over}:${this.sending}:${this.confirm}` : '';
    if (this._panelKey === key) this.panel.querySelector('.panel-scroll').scrollTop = top;
    this._panelKey = key;
  }

  /** Clicks inside the chart or the arrival card. @returns {boolean} whether the click was handled here */
  click(e) {
    if (performance.now() < this.quietUntil && (this.visible || !this.arrival.classList.contains('hidden'))) return true;
    if (this.visible) {
      const pick = e.target.closest('[data-chart]');
      if (pick) {
        const what = pick.dataset.chart;
        // these change which buttons are under the finger
        if (['send', 'send-done', 'release', 'release-no', 'over', 'keep'].includes(what)) this._quiet(320);
        const edge = this.sel?.kind === 'edge' ? this.sel.id : null;
        const ref = this._ref();
        if (what === 'send' || what === 'send-done') {
          this.sending = what === 'send' && !!this._chosen();
          this._panel();
        } else if (what === 'copy') this._copy(pick);
        else if (what === 'share') navigator.share?.({ title: 'A bridge from the Sea of Bridges', text: 'A bridge from the Sea of Bridges. Open it to hear it.', url: this.panel.querySelector('.link-box').value }).catch(() => {});
        else if (what === 'release' || what === 'release-no') {
          this.confirm = what === 'release';
          this._panel();
        } else if (what === 'release-yes') {
          this.sel = null;
          this.action('sea-release', { ref });
        } else if (what === 'keep-afar') this.action('sea-keep', { ref });
        else if (what === 'pick') {
          this.pick[pick.dataset.kind] = pick.dataset.id;
          this._panel();
          this.action('sea-preview', { [pick.dataset.kind]: pick.dataset.id });
        } else if (what === 'over') {
          this.over = true;
          this.pick = { sound: null, mood: null };
          this._panel();
        } else if (what === 'keep') {
          this.over = false;
          this.pick = { sound: null, mood: null };
          this._panel();
        } else if (what === 'build' && edge) this.action('sea-build', { edge, sound: this.pick.sound, mood: this.pick.mood });
        else if (what === 'add' && ref) this.action('sea-add', { edge: ref, sound: this.pick.sound });
        else if (what === 'listen' && ref) this.action('sea-listen', { edge: ref });
        return true;
      }
      const edgeNode = e.target.closest('[data-edge]');
      const placeNode = e.target.closest('[data-place]');
      const afarNode = e.target.closest('[data-afar]');
      if (placeNode || edgeNode || afarNode) {
        this.sel = afarNode ? { kind: 'afar', id: Number(afarNode.dataset.afar) } : placeNode ? { kind: 'place', id: placeNode.dataset.place } : { kind: 'edge', id: edgeNode.dataset.edge };
        this.over = false;
        this.sending = false;
        this.confirm = false;
        this.pick = { sound: null, mood: null };
        this._draw();
        return true;
      }
    }
    if (!this.arrival.classList.contains('hidden')) {
      const pick = e.target.closest('[data-arrive]');
      if (pick) {
        const what = pick.dataset.arrive;
        const d = this.arrivalData;
        if (what === 'pick') {
          this.arrivalSound = pick.dataset.id;
          this._arrival();
          this.action('sea-preview', { sound: pick.dataset.id });
        } else if (what === 'add') this.action('sea-add', { edge: d.edge, sound: this.arrivalSound });
        else if (what === 'listen') this.action('sea-listen', { edge: d.edge });
        else if (what === 'chart') {
          this.sel = null;
          this.action('sea-chart');
        } else if (what === 'send') {
          this.wantSend = true;
          this.action('sea-chart', { focus: d.edge });
        }
        return true;
      }
    }
    return false;
  }

  /** Put the link where it can be pasted from; if the browser will not, leave it selected to be copied by hand. */
  async _copy(btn) {
    const box = this.panel.querySelector('.link-box');
    let ok = false;
    try {
      await navigator.clipboard.writeText(box.value);
      ok = true;
    } catch {
      box.focus();
      box.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
    }
    if (!btn.isConnected) return; // the panel moved on while the browser was being asked
    (btn.querySelector('span') ?? btn).textContent = ok ? 'Copied' : 'Copy by hand';
    const note = this.panel.querySelector('.link-note');
    if (!ok && note) note.textContent = 'Press and hold the link above, then choose Copy.';
    this.copied = ok;
  }

  /** Keyboard: Enter or Space on a focused place or bridge chooses it. */
  key(e) {
    if (!this.visible || (e.key !== 'Enter' && e.key !== ' ')) return false;
    const node = document.activeElement?.closest?.('[data-edge], [data-place], [data-afar]');
    if (!node || !this.node.contains(node)) return false;
    this.click({ target: node });
    return true;
  }

  // -------------------------------------------------------------------------------
  // Arriving
  // -------------------------------------------------------------------------------
  showArrival(v, data = null) {
    this.arrival.classList.toggle('hidden', !v);
    if (!v) return;
    this.arrivalData = data;
    this.arrivalSound = data.suggest;
    this._quiet(750);
    this._arrival();
  }

  _arrival() {
    const d = this.arrivalData;
    const made = d.layer === 0
      ? `Your bridge has <b>${d.notes}</b> ${d.notes === 1 ? 'stone' : 'stones'}.`
      : `Part ${NUMERALS[d.layer]} adds <b>${d.notes}</b> ${d.notes === 1 ? 'stone' : 'stones'}. The bridge has ${d.layers} parts now.`;
    const sound = SOUNDS[this.arrivalSound];
    let html = `<div class="arrival-inner">
      <div class="end-kicker">${d.gift ? 'You woke' : 'You reached'}</div>
      <h2 class="end-title">${esc(d.place)}</h2>
      <p class="end-note">${made}</p>`;
    if (d.gift) {
      html += `<div class="gift-box"><span>It gave you</span><b>${esc(d.gift.sound)}</b><i>a new sound</i><b>${esc(d.gift.mood)}</b><i>a new mood</i></div>`;
    }
    if (d.wholeSea) html += `<p class="end-note whole">Every place in the sea is awake.</p>`;
    if (d.everyBridge) html += `<p class="end-note whole">Every bridge in the sea is built.</p>`;
    html += '<div class="arrival-actions">';
    if (d.canAdd) {
      html += `<div class="panel-label">Pick a sound for part ${NUMERALS[d.layers]}</div>
        <div class="chip-row">${d.sounds.map((id) => `<button class="chip${id === this.arrivalSound ? ' on' : ''}" data-arrive="pick" data-id="${id}" aria-pressed="${id === this.arrivalSound}">${esc(SOUNDS[id].name)}</button>`).join('')}</div>
        <div class="chip-hint">${esc(sound?.hint ?? '')}</div>
        <button class="btn primary" data-arrive="add">${ICON.add}<span>Add part ${NUMERALS[d.layers]}</span></button>
        <button class="btn" data-arrive="listen">${ICON.play}<span>Hear the bridge</span></button>`;
    } else {
      html += `<button class="btn primary" data-arrive="listen">${ICON.play}<span>Hear the bridge</span></button>`;
    }
    html += `<button class="btn" data-arrive="chart">${ICON.map}<span>The sea map</span></button>
      <button class="btn quiet send-link" data-arrive="send">${d.afar ? 'Send it back' : 'Send this bridge to someone'}</button></div></div>`;
    this.arrival.innerHTML = html;
    const inner = this.arrival.querySelector('.arrival-inner');
    inner.tabIndex = -1;
    if (!this.arrival.contains(document.activeElement)) inner.focus({ preventScroll: true });
  }
}
