// The chart of the Sea of Bridges, and the card shown on arriving somewhere.
//
// The chart is the menu, the progress and the songbook at once: every place, every bridge
// that could be built (a dotted line), and every bridge that has been (a line of light with
// one strand per part). Choosing a line is choosing what to do next.
//
// Like the rest of the HUD it only reports intent (UI_ACTION); it knows no rules.

import { PLACES, PLACE, EDGE, SOUNDS, MOODS, otherEnd } from '../music/sea.js';
import { CROSSING } from '../core/Constants.js';

const NUMERALS = ['I', 'II', 'III'];
const STRAND = ['#ffd08a', '#a9d8ff', '#d9b8ff'];
const PLACE_TINT = {
  lighthouse: '#ffc870', chimes: '#ffe6b0', harp: '#8fe8d8', garden: '#c8f09a', stacks: '#cfd8ff', harbor: '#ffb06a', deep: '#7df0ff',
};
const W = 1000, H = 700, PAD_X = 120, PAD_TOP = 86, PAD_BOTTOM = 96;

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

    this.node = el('div', 'screen chart-screen hidden');
    this.node.innerHTML = `
      <div class="chart-head">
        <div class="chart-kicker">Beyond the lighthouse</div>
        <h2 class="chart-title">The Sea of Bridges</h2>
      </div>
      <div class="chart-body">
        <div class="chart-map-wrap"><svg class="chart-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Chart of the sea"></svg></div>
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
    // keep looking at the same thing if it is still there; otherwise suggest what to do next
    if (!this.sel || (this.sel.kind === 'edge' && !EDGE[this.sel.id])) this.sel = null;
    if (!this.sel) this.sel = this._suggest();
    this.pick = { sound: null, mood: null };
    this._draw();
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
      const selected = this.sel?.kind === 'edge' && this.sel.id === e.id;
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
        <circle class="glow" r="34"/><circle class="disc" r="23"/>
        <g class="glyph">${glyph(p.kind)}</g>
        ${here ? '<path class="kite" d="M0 -40 L7 -31 L0 -22 L-7 -31 Z"/>' : ''}
        <text class="name" y="46">${esc(p.name)}</text></g>`);
    }
    this.svg.innerHTML = parts.join('');
    this._panel();
    const built = Object.keys(v.bridges).length;
    this.tally.textContent = `${built} of ${v.edges.length} bridges · ${v.awake.length} of ${PLACES.length} places awake · ${v.sounds.length} of ${Object.keys(SOUNDS).length} sounds`;
  }

  _chips(kind, ids, current) {
    const table = kind === 'sound' ? SOUNDS : MOODS;
    return `<div class="chip-row" data-pick="${kind}">${ids.map((id) => `<button class="chip${id === current ? ' on' : ''}" data-chart="pick" data-kind="${kind}" data-id="${id}" title="${esc(table[id].hint)}">${esc(table[id].name)}</button>`).join('')}</div>`;
  }

  _panel() {
    const v = this.view;
    const sel = this.sel;
    let html = '';
    if (!sel) {
      html = `<h3>Where to?</h3><p>Choose a dotted line to build a bridge, or a bridge to hear it again.</p>`;
    } else if (sel.kind === 'place') {
      const p = PLACE[sel.id];
      const awake = v.awake.includes(p.id);
      const gift = p.gift;
      html = `<div class="panel-kicker">${awake ? (v.at === p.id ? 'You are here' : 'Awake') : 'Asleep'}</div><h3>${esc(p.name)}</h3><p>${esc(p.blurb)}</p>`;
      if (gift) {
        html += awake
          ? `<p class="gift">It gave you <b>${esc(SOUNDS[gift.sound].name)}</b> and <b>${esc(MOODS[gift.mood].name)}</b>.</p>`
          : `<p class="gift">A bridge will wake it. It is keeping a sound and a mood for whoever arrives.</p>`;
      }
    } else {
      const e = v.edges.find((x) => x.id === sel.id);
      const bridge = v.bridges[e.id];
      const secs = Math.round((e.bars * 4 * 60) / 80 / 5) * 5;
      if (bridge && !this.over) {
        const to = otherEnd(e, bridge.from);
        const mood = MOODS[bridge.mood];
        html = `<div class="panel-kicker">A bridge · ${esc(mood.name)}</div><h3>${esc(PLACE[bridge.from].name)} <span class="arrow">to</span> ${esc(PLACE[to].name)}</h3>
          <ul class="parts">${bridge.layers.map((l, k) => `<li><b style="color:${STRAND[k]}">${NUMERALS[k]}</b><span>${esc(SOUNDS[l.sound].name)}</span><i>${l.notes} ${l.notes === 1 ? 'stone' : 'stones'}</i></li>`).join('')}</ul>
          <button class="btn primary" data-chart="listen">Hear it</button>`;
        if (bridge.layers.length < CROSSING.MAX_LAYERS) {
          const used = bridge.layers.map((l) => l.sound);
          if (!this.pick.sound) this.pick.sound = v.sounds.find((s) => !used.includes(s)) ?? v.sounds[0];
          html += `<div class="panel-label">Add a part, in…</div>${this._chips('sound', v.sounds, this.pick.sound)}
            <button class="btn" data-chart="add">Add part ${NUMERALS[bridge.layers.length]}</button>`;
        } else {
          html += `<p class="fine">This bridge has all three of its parts.</p>`;
        }
        html += `<button class="btn quiet" data-chart="over">Start it over</button>`;
      } else if (e.start) {
        const to = otherEnd(e, e.start);
        if (!this.pick.sound) this.pick.sound = PLACE[e.start].gift && v.sounds.includes(PLACE[e.start].gift.sound) ? PLACE[e.start].gift.sound : v.sounds[0];
        if (!this.pick.mood) this.pick.mood = PLACE[e.start].gift && v.moods.includes(PLACE[e.start].gift.mood) ? PLACE[e.start].gift.mood : v.moods[0];
        html = `<div class="panel-kicker">${bridge ? 'Start over' : v.awake.includes(to) ? 'A new bridge' : 'Somewhere new'} · about ${secs} seconds</div>
          <h3>${esc(PLACE[e.start].name)} <span class="arrow">to</span> ${esc(PLACE[to].name)}</h3>
          <p>${bridge ? 'The bridge that is here stays until you finish the new one.' : 'Every key builds a stone. Nothing can be missed.'}</p>
          <div class="panel-label">Sound</div>${this._chips('sound', v.sounds, this.pick.sound)}
          <div class="panel-label">Mood</div>${this._chips('mood', v.moods, this.pick.mood)}
          <button class="btn primary" data-chart="build">${bridge ? 'Build it again' : 'Build this bridge'}</button>
          ${bridge ? '<button class="btn quiet" data-chart="keep">Keep the old one</button>' : ''}`;
      } else {
        html = `<div class="panel-kicker">Too far for now</div><h3>${esc(PLACE[e.a].name)} <span class="arrow">to</span> ${esc(PLACE[e.b].name)}</h3>
          <p>Reach ${esc(PLACE[e.a].name)} or ${esc(PLACE[e.b].name)} first, then this bridge can begin.</p>`;
      }
    }
    this.panel.innerHTML = html;
  }

  /** Clicks inside the chart or the arrival card. @returns {boolean} whether the click was handled here */
  click(e) {
    if (this.visible) {
      const pick = e.target.closest('[data-chart]');
      if (pick) {
        const what = pick.dataset.chart;
        const edge = this.sel?.kind === 'edge' ? this.sel.id : null;
        if (what === 'pick') {
          this.pick[pick.dataset.kind] = pick.dataset.id;
          this._panel();
        } else if (what === 'over') {
          this.over = true;
          this.pick = { sound: null, mood: null };
          this._panel();
        } else if (what === 'keep') {
          this.over = false;
          this.pick = { sound: null, mood: null };
          this._panel();
        } else if (what === 'build' && edge) this.action('sea-build', { edge, sound: this.pick.sound, mood: this.pick.mood });
        else if (what === 'add' && edge) this.action('sea-add', { edge, sound: this.pick.sound });
        else if (what === 'listen' && edge) this.action('sea-listen', { edge });
        return true;
      }
      const edgeNode = e.target.closest('[data-edge]');
      const placeNode = e.target.closest('[data-place]');
      if (placeNode || edgeNode) {
        this.sel = placeNode ? { kind: 'place', id: placeNode.dataset.place } : { kind: 'edge', id: edgeNode.dataset.edge };
        this.over = false;
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
        } else if (what === 'add') this.action('sea-add', { edge: d.edge, sound: this.arrivalSound });
        else if (what === 'listen') this.action('sea-listen', { edge: d.edge });
        else if (what === 'chart') {
          this.sel = null;
          this.action('sea-chart');
        }
        return true;
      }
    }
    return false;
  }

  /** Keyboard: Enter or Space on a focused place or bridge chooses it. */
  key(e) {
    if (!this.visible || (e.key !== 'Enter' && e.key !== ' ')) return false;
    const node = document.activeElement?.closest?.('[data-edge], [data-place]');
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
    this._arrival();
  }

  _arrival() {
    const d = this.arrivalData;
    const made = d.layer === 0
      ? `Your bridge has <b>${d.notes}</b> ${d.notes === 1 ? 'stone' : 'stones'}.`
      : `Part ${NUMERALS[d.layer]} adds <b>${d.notes}</b> ${d.notes === 1 ? 'stone' : 'stones'}. The bridge has ${d.layers} parts now.`;
    let html = `<div class="arrival-inner">
      <div class="end-kicker">${d.gift ? 'You woke' : 'You reached'}</div>
      <h2 class="end-title">${esc(d.place)}</h2>
      <p class="end-note">${made}</p>`;
    if (d.gift) {
      html += `<div class="gift-box"><span>It gave you</span><b>${esc(d.gift.sound)}</b><i>a new sound</i><b>${esc(d.gift.mood)}</b><i>a new mood</i></div>`;
    }
    html += '<div class="arrival-actions">';
    if (d.canAdd) {
      html += `<div class="panel-label">Play another part over it, in…</div>
        <div class="chip-row">${d.sounds.map((id) => `<button class="chip${id === this.arrivalSound ? ' on' : ''}" data-arrive="pick" data-id="${id}">${esc(SOUNDS[id].name)}</button>`).join('')}</div>
        <button class="btn primary" data-arrive="add">Add part ${NUMERALS[d.layers]}</button>
        <button class="btn" data-arrive="listen">Hear the bridge</button>`;
    } else {
      html += `<button class="btn primary" data-arrive="listen">Hear the bridge</button>`;
    }
    html += `<button class="btn" data-arrive="chart">The sea chart</button></div></div>`;
    this.arrival.innerHTML = html;
  }
}
