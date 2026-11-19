import { describe, it, expect } from 'vitest';
import { replaceRecord } from '../../src/systems/Save.js';
import { makeRunner, playMovement, perfect, highest, M1, M2, M3 } from './helpers.js';

describe('replace one movement', () => {
  it('replace one movement: only that record changes', () => {
    const a = playMovement(makeRunner(M1), perfect).record();
    const b = playMovement(makeRunner(M2, { echoes: [a] }), perfect).record();
    const c = playMovement(makeRunner(M3, { echoes: [a, b] }), perfect).record();
    const before = [a, b, c];
    const again = playMovement(makeRunner(M1), highest).record();
    const after = replaceRecord(before, 0, again);
    expect(after[0]).toBe(again);
    expect(after[1]).toBe(b);
    expect(after[2]).toBe(c);
    expect(before[0]).toBe(a); // cancelling keeps the old one: the original array is untouched
    expect(after[0].choices['tide-or-arch']).toBe('high');
    expect(before[0].choices['tide-or-arch']).toBe('low');
  });
});
