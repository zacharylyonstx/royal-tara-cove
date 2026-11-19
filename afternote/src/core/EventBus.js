// Singleton pub/sub. Cross-module notification goes through here; names are domain:action.

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) this.listeners.delete(event);
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of [...cbs]) {
      try {
        cb(data);
      } catch (e) {
        console.error(`EventBus error [${event}]:`, e);
      }
    }
  }
}

export const eventBus = new EventBus();

export const Events = {
  // flow
  PHASE_CHANGED: 'flow:phase',
  MOVEMENT_STARTED: 'flow:movement-started',
  MOVEMENT_COMPLETE: 'flow:movement-complete',
  ECHO_BORN: 'flow:echo-born',
  IGNITE: 'flow:ignite',
  REVEAL_STARTED: 'flow:reveal-started',
  REVEAL_ENDED: 'flow:reveal-ended',
  PAUSED: 'flow:paused',
  RESUMED: 'flow:resumed',
  COUNT_IN: 'flow:count-in',
  // play (payloads are MovementRunner events plus { mvt })
  NOTE_HIT: 'play:hit',
  NOTE_MISS: 'play:miss',
  NOTE_FLOURISH: 'play:flourish',
  HOLD_START: 'play:hold-start',
  HOLD_END: 'play:hold-end',
  HOLD_BROKEN: 'play:hold-broken',
  RESCUE: 'play:rescue',
  BREATH: 'play:breath',
  CHOICE: 'play:choice',
  RESONANCE: 'play:resonance',
  ACCENT: 'play:accent',
  GATE_WAITING: 'play:gate-waiting',
  GATE_OPENED: 'play:gate-opened',
  PHRASE_STRUGGLE: 'play:phrase-struggle',
  // echoes
  ECHO_NOTE: 'echo:note',
  // input
  KEY_DOWN: 'input:down',
  KEY_UP: 'input:up',
  // ui
  UI_BEGIN: 'ui:begin',
  UI_ACTION: 'ui:action',
  SETTINGS_CHANGED: 'ui:settings',
  CAPTION: 'ui:caption',
  PROMPT: 'ui:prompt',
};
