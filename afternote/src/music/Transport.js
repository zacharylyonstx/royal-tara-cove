// Musical time. Maps a clock (seconds) to beats and back.
//
// `latency` is how long after scheduling a sound the player actually hears it. beat()
// reports the beat the player is currently *perceiving*, so what they see, what they
// hear and what their press is judged against all agree. Sounds are scheduled with
// timeOfBeat(), which is the un-shifted audio time.

export class Transport {
  constructor(clock) {
    this.clock = clock;
    this.bpm = 96;
    this.latency = 0;
    this.running = false;
    this._beat0 = 0;
    this._t0 = 0;
  }

  get secPerBeat() {
    return 60 / this.bpm;
  }

  beat() {
    return this.beatAtTime(this.clock.now());
  }

  beatAtTime(t) {
    if (!this.running) return this._beat0;
    return this._beat0 + (t - this._t0 - this.latency) / this.secPerBeat;
  }

  /** The beat that is being *scheduled* right now (ahead of the perceived beat by the latency). */
  scheduleBeat() {
    if (!this.running) return this._beat0;
    return this._beat0 + (this.clock.now() - this._t0) / this.secPerBeat;
  }

  /** Clock time at which a sound for `beat` should be started. */
  timeOfBeat(beat) {
    return this._t0 + (beat - this._beat0) * this.secPerBeat;
  }

  start(beat = this._beat0) {
    this._beat0 = beat;
    this._t0 = this.clock.now() + (this.running ? 0 : 0);
    this.running = true;
  }

  stop() {
    this._beat0 = this.beat();
    this.running = false;
  }

  seek(beat) {
    this._beat0 = beat;
    this._t0 = this.clock.now();
  }

  setBpm(bpm) {
    const now = this.beat();
    this.bpm = bpm;
    this._beat0 = now;
    this._t0 = this.clock.now() - this.latency;
  }
}
