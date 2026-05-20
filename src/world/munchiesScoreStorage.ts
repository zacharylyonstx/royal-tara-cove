// Tiny localStorage wrappers for munchies persistence.
// Safe against quota/disabled-storage exceptions.

import type { Difficulty, PlayableCharacter } from './munchiesConfig';

const BEST_KEY = (c: PlayableCharacter) => `munchies.best.${c}`;
const DIFFICULTY_KEY = 'munchies.difficulty';

export function loadBestScore(character: PlayableCharacter): number {
  try {
    const raw = localStorage.getItem(BEST_KEY(character));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(character: PlayableCharacter, score: number): void {
  try {
    if (score > loadBestScore(character)) {
      localStorage.setItem(BEST_KEY(character), String(score));
    }
  } catch {
    /* localStorage blocked; silent no-op */
  }
}

export function loadDifficulty(): Difficulty {
  try {
    const raw = localStorage.getItem(DIFFICULTY_KEY);
    if (raw === 'awake') return 'awake';
    return 'sleepy';
  } catch {
    return 'sleepy';
  }
}

export function saveDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    /* silent */
  }
}
