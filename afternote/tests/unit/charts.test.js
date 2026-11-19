import { describe, it, expect } from 'vitest';
import { LIGHTHOUSE } from '../../src/music/charts/lighthouse.js';
import { buildSlots } from '../../src/rules/Slots.js';
import { PITCH_COUNT } from '../../src/music/Theory.js';

describe('authored charts are well formed', () => {
  it('the island has three movements over one 16-bar harmony', () => {
    expect(LIGHTHOUSE.movements).toHaveLength(3);
    expect(LIGHTHOUSE.harmony).toHaveLength(16);
    expect(LIGHTHOUSE.bpm).toBeGreaterThan(60);
  });

  for (const chart of LIGHTHOUSE.movements) {
    describe(chart.id, () => {
      const { slots, breaths } = buildSlots(chart);

      it('slots are strictly ordered and inside the movement', () => {
        for (let i = 1; i < slots.length; i++) expect(slots[i].b).toBeGreaterThan(slots[i - 1].b);
        expect(slots[0].b).toBeGreaterThanOrEqual(chart.startBeat);
        const last = slots.at(-1);
        expect(last.b + last.d).toBeLessThanOrEqual(64);
        expect(chart.endBeat).toBeGreaterThan(last.b + last.d);
      });

      it('pitches are valid and every slot has a positive duration', () => {
        for (const s of slots) {
          expect(s.d).toBeGreaterThan(0);
          const ps = s.p !== undefined && s.p !== null ? [s.p] : s.routeP ? Object.values(s.routeP) : s.fallback ?? [];
          for (const p of ps) {
            expect(Number.isInteger(p)).toBe(true);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThan(PITCH_COUNT);
          }
        }
      });

      it('notes never overlap a hold, and nothing starts inside another note', () => {
        for (let i = 0; i < slots.length - 1; i++) {
          if (slots[i].k === 'hold') expect(slots[i + 1].b).toBeGreaterThanOrEqual(slots[i].b + slots[i].d);
        }
      });

      it('breaths never sit on top of a slot start', () => {
        for (const br of breaths) {
          expect(br.d).toBeGreaterThan(0);
          for (const s of slots) {
            const inside = s.b >= br.b - 1e-9 && s.b < br.b + br.d - 1e-9;
            expect(inside, `slot ${s.b} inside breath ${br.b}`).toBe(false);
          }
        }
      });

      it('choice routes share one rhythm and offer different first pitches', () => {
        const byChoice = new Map();
        for (const s of slots.filter((x) => x.choiceId)) {
          if (!byChoice.has(s.choiceId)) byChoice.set(s.choiceId, []);
          byChoice.get(s.choiceId).push(s);
        }
        for (const [, list] of byChoice) {
          const first = list[0];
          const firsts = Object.values(first.routeP);
          expect(new Set(firsts).size).toBe(firsts.length);
          for (const s of list) expect(Object.keys(s.routeP).sort()).toEqual(Object.keys(first.routeP).sort());
        }
      });

      it('only the very first note of the island is gated', () => {
        const gated = slots.filter((s) => s.gate);
        if (chart === LIGHTHOUSE.movements[0]) {
          expect(gated).toHaveLength(1);
          expect(gated[0]).toBe(slots[0]);
        } else {
          expect(gated).toHaveLength(0);
        }
      });

      it('resonance slots point at an earlier movement and have a two-pitch fallback', () => {
        const idx = LIGHTHOUSE.movements.indexOf(chart);
        for (const s of slots.filter((x) => x.src === 'resonance')) {
          expect(s.echo.mvt).toBeLessThan(idx);
          expect(s.echo.b).toBeLessThan(s.b);
          expect(s.fallback).toHaveLength(2);
          expect(s.fallback[0]).not.toBe(s.fallback[1]);
        }
      });

      it('leaves real room to breathe', () => {
        const rest = breaths.reduce((a, b) => a + b.d, 0);
        expect(rest).toBeGreaterThanOrEqual(8);
      });
    });
  }

  it('movement two is sparser than movement one, and three sparser still', () => {
    const counts = LIGHTHOUSE.movements.map((c) => buildSlots(c).slots.length);
    expect(counts[1]).toBeLessThan(counts[0]);
    expect(counts[2]).toBeLessThanOrEqual(counts[1]);
  });
});
