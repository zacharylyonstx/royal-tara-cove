// Keys, touch pads and (optionally) a MIDI keyboard, all reduced to "pitch down / pitch up".
// Nothing here knows the rules; it only reports what the player did and when.

import { DEFAULT_KEYS } from '../core/Constants.js';
import { pitchForCode } from './KeyMap.js';

const MIDI_PITCH = { 0: 0, 2: 1, 4: 2, 7: 3, 9: 4 }; // C D E G A in any octave

export class Input {
  /**
   * @param {{onDown:(pitch:number,e?:Event)=>void, onUp:(pitch:number,e?:Event)=>void,
   *          onPause:()=>void, onConfirm:()=>void, onBlur:()=>void}} handlers
   */
  constructor(handlers) {
    this.h = handlers;
    this.keys = [...DEFAULT_KEYS];
    this.down = new Set();
    this.capture = null; // when remapping: (code) => void

    window.addEventListener('keydown', (e) => this._keyDown(e));
    window.addEventListener('keyup', (e) => this._keyUp(e));
    window.addEventListener('blur', () => {
      for (const p of [...this.down]) this._up(p);
      this.h.onBlur?.();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.h.onBlur?.();
    });
  }

  setKeys(codes) {
    this.keys = codes && codes.length === 5 ? [...codes] : [...DEFAULT_KEYS];
  }

  _pitchOf(code) {
    return pitchForCode(code, this.keys);
  }

  _keyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.capture) {
      e.preventDefault();
      const cb = this.capture;
      this.capture = null;
      cb(e.code);
      return;
    }
    if (e.code === 'Escape') {
      this.h.onPause?.();
      return;
    }
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.code === 'Enter' || e.code === 'Space') {
      if (tag === 'BUTTON') return; // let the focused button handle it
      e.preventDefault();
      if (!e.repeat) this.h.onConfirm?.();
      return;
    }
    const p = this._pitchOf(e.code);
    if (p === -1) return;
    e.preventDefault();
    if (e.repeat) return;
    this.h.onKeyboard?.();
    this._down(p, e);
  }

  _keyUp(e) {
    const p = this._pitchOf(e.code);
    if (p !== -1) this._up(p, e);
  }

  _down(p, e) {
    if (this.down.has(p)) return;
    this.down.add(p);
    this.h.onDown(p, e);
  }

  _up(p, e) {
    if (!this.down.has(p)) return;
    this.down.delete(p);
    this.h.onUp(p, e);
  }

  /** Make five on-screen elements playable (touch, mouse, pen). */
  attachPads(elements) {
    elements.forEach((el, p) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        this._down(p, e);
      });
      const up = (e) => this._up(p, e);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  /** A physical keyboard is an optional pleasure, never a requirement. */
  async enableMidi() {
    if (!navigator.requestMIDIAccess) return false;
    try {
      const access = await navigator.requestMIDIAccess();
      const hook = (input) => {
        input.onmidimessage = (msg) => {
          const [status, note, vel] = msg.data;
          const type = status & 0xf0;
          const p = MIDI_PITCH[note % 12];
          if (p === undefined) return;
          if (type === 0x90 && vel > 0) this._down(p);
          else if (type === 0x80 || (type === 0x90 && vel === 0)) this._up(p);
        };
      };
      access.inputs.forEach(hook);
      access.onstatechange = (ev) => {
        if (ev.port.type === 'input' && ev.port.state === 'connected') hook(ev.port);
      };
      return access.inputs.size > 0;
    } catch {
      return false;
    }
  }
}
