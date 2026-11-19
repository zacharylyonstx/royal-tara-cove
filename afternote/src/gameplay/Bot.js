// A player made of rules. Used by tests, by window.__afternote for inspection, and for
// taking screenshots of specific moments. It presses through the same handlers a person does.

export class Bot {
  /**
   * @param {object} conductor
   * @param {{strategy?:'low'|'high'|'wander'|'resonant', miss?:number, offset?:number, hold?:number, seed?:number}} opts
   */
  constructor(conductor, opts = {}) {
    this.c = conductor;
    this.strategy = opts.strategy ?? 'low';
    this.miss = opts.miss ?? 0;
    this.offset = opts.offset ?? 0;
    this.hold = opts.hold ?? 1.02;
    this.decided = new Map();
    this.release = null;
    let s = (opts.seed ?? 12345) >>> 0;
    this.rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    this.lastRunner = null;
  }

  _pick(runner, slot, offers) {
    const ring = runner.resonantPitch(slot);
    if (ring !== null && (this.strategy === 'resonant' || this.strategy === 'wander')) return ring;
    if (this.strategy === 'high') return offers[offers.length - 1];
    if (this.strategy === 'wander') return offers[Math.floor(this.rnd() * offers.length)];
    return offers[0];
  }

  update(beat) {
    const runner = this.c.runner;
    if (!runner) return;
    if (runner !== this.lastRunner) {
      this.lastRunner = runner;
      this.decided.clear();
      this.release = null;
    }
    if (this.release && beat >= this.release.at) {
      const p = this.release.pitch;
      this.release = null;
      this.c.handleRelease(p);
    }
    const slot = runner.nextSlot();
    if (!slot) return;
    if (!this.decided.has(slot.i)) this.decided.set(slot.i, { skip: !slot.gate && this.rnd() < this.miss, done: false });
    const plan = this.decided.get(slot.i);
    if (plan.done || plan.skip) return;
    if (slot.gate || beat >= slot.b + this.offset) {
      const offers = runner.offers(slot);
      if (!offers.length) return;
      plan.done = true;
      const pitch = this._pick(runner, slot, offers);
      this.c.handlePress(pitch);
      if (slot.k === 'hold') this.release = { pitch, at: slot.b + slot.d * this.hold };
      else this.c.handleRelease(pitch);
    }
  }
}
