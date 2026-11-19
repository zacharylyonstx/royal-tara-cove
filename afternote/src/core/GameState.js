// Single shared state object. Systems read it; the Conductor and UI mutate it.

import { PACE } from './Constants.js';

class GameState {
  constructor() {
    this.settings = {
      pace: PACE.FLOWING.id,
      volume: 0.85,
      labels: 'both', // 'both' = note + key, 'keys', 'notes'
      reducedMotion: false,
      highContrast: false,
      keys: null, // null = defaults
      quality: 'auto',
    };
    this.reset();
  }

  reset() {
    this.phase = 'boot'; // boot | title | intro | play | echoBirth | transit | ignite | reveal | end | listen | rest
    this.movement = 0;
    this.beat = 0;
    this.paused = false;
    this.gateWaiting = false;
    this.records = [null, null, null];
    this.discoveries = [];
    this.replaying = null; // index of a movement being replaced, or null
    this.seen = {}; // one-time captions and tips already shown
    this.stats = { hits: 0, misses: 0, perfect: 0 };
  }
}

export const gameState = new GameState();
