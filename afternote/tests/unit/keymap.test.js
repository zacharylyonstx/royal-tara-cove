import { describe, it, expect } from 'vitest';
import { pitchForCode, KEY_PRESETS, labelMode } from '../../src/systems/KeyMap.js';
import { DEFAULT_KEYS } from '../../src/core/Constants.js';

const C = 0, D = 1, E = 2, G = 3, A = 4;

describe('which key plays which note', () => {
  it('the default keys are the digits 1–5, in lane order, and none of them is a note letter', () => {
    expect(DEFAULT_KEYS).toEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']);
    expect(DEFAULT_KEYS.map((c) => pitchForCode(c, DEFAULT_KEYS))).toEqual([C, D, E, G, A]);
    for (const code of DEFAULT_KEYS) expect(['KeyC', 'KeyD', 'KeyE', 'KeyG', 'KeyA']).not.toContain(code);
  });

  it("typing a note's own letter plays that note", () => {
    expect(pitchForCode('KeyC', DEFAULT_KEYS)).toBe(C);
    expect(pitchForCode('KeyD', DEFAULT_KEYS)).toBe(D);
    expect(pitchForCode('KeyE', DEFAULT_KEYS)).toBe(E);
    expect(pitchForCode('KeyG', DEFAULT_KEYS)).toBe(G);
    expect(pitchForCode('KeyA', DEFAULT_KEYS)).toBe(A);
  });

  it('the number pad works like the number row', () => {
    expect(pitchForCode('Numpad1', DEFAULT_KEYS)).toBe(C);
    expect(pitchForCode('Numpad5', DEFAULT_KEYS)).toBe(A);
  });

  it('an unrelated key plays nothing', () => {
    expect(pitchForCode('KeyS', DEFAULT_KEYS)).toBe(-1);
    expect(pitchForCode('KeyF', DEFAULT_KEYS)).toBe(-1);
    expect(pitchForCode('Digit6', DEFAULT_KEYS)).toBe(-1);
  });

  it('a chosen key always wins over a note letter it happens to share', () => {
    // someone who remaps to the old home row: A is the first lane (C), not the note A
    const homeLeft = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'];
    expect(pitchForCode('KeyA', homeLeft)).toBe(C);
    expect(pitchForCode('KeyD', homeLeft)).toBe(E);
    expect(pitchForCode('KeyG', homeLeft)).toBe(A);
    // letters that are not taken still mean their own note
    expect(pitchForCode('KeyC', homeLeft)).toBe(C);
    expect(pitchForCode('KeyE', homeLeft)).toBe(E);
  });

  it('every preset is five distinct keys with no note letters in it', () => {
    for (const preset of Object.values(KEY_PRESETS)) {
      expect(new Set(preset.codes).size).toBe(5);
      for (const code of preset.codes) expect(['KeyC', 'KeyD', 'KeyE', 'KeyG', 'KeyA']).not.toContain(code);
    }
  });

  it('old saved settings carry over to the new label modes', () => {
    expect(labelMode({ noteNames: false })).toBe('keys');
    expect(labelMode({ noteNames: true })).toBe('both');
    expect(labelMode({ labels: 'notes', noteNames: false })).toBe('notes');
    expect(labelMode({})).toBe('both');
  });
});
