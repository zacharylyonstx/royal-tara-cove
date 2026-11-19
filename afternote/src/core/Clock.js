// Time sources. The transport reads whichever clock it is given.
//
//   RealClock   – the AudioContext clock once audio is running (sample-steady), otherwise
//                 performance.now(). Both are in seconds.
//   ManualClock – advanced explicitly; used by tests and window.advanceTime().

export class RealClock {
  constructor() {
    this.ctx = null;
    this._perfOffset = 0;
    this._audioOffset = 0;
    this._audioMode = false;
    this._last = performance.now() / 1000;
  }

  /** Use the audio clock from now on. Reported time never jumps when the source changes. */
  attachAudio(ctx) {
    this.now();
    this.ctx = ctx;
  }

  now() {
    const audio = !!this.ctx && this.ctx.state === 'running';
    if (audio !== this._audioMode) {
      // switching source (audio starting, or interrupted): carry on from the last reported time
      if (audio) this._audioOffset = this._last - this.ctx.currentTime;
      else this._perfOffset = this._last - performance.now() / 1000;
      this._audioMode = audio;
    }
    const t = audio ? this.ctx.currentTime + this._audioOffset : performance.now() / 1000 + this._perfOffset;
    // an audio clock advances in small blocks; never report time running backwards
    this._last = Math.max(this._last, t);
    return this._last;
  }

  /** Audio-context time for a clock time (for scheduling). */
  toAudioTime(t) {
    return this._audioMode ? t - this._audioOffset : this.ctx ? this.ctx.currentTime + (t - this._last) : t;
  }

  /** The clock time at which a DOM event happened. */
  timeOfEvent(e) {
    const age = e && e.timeStamp ? Math.max(0, Math.min(0.1, (performance.now() - e.timeStamp) / 1000)) : 0;
    return this.now() - age;
  }

  get manual() {
    return false;
  }
}

export class ManualClock {
  constructor() {
    this.t = 0;
  }

  advance(dt) {
    this.t += dt;
  }

  now() {
    return this.t;
  }

  toAudioTime(t) {
    return t;
  }

  timeOfEvent() {
    return this.t;
  }

  get manual() {
    return true;
  }
}
