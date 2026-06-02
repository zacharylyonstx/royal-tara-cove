import { create } from 'zustand';
import { applyMasterOutput } from '../audio';

// Master mute / volume, persisted. The source of truth for the speaker button;
// drives audio.ts's master gain so one toggle silences the whole game.
const KEY = 'audio.v1';
const DEFAULT_VOLUME = 0.85;

function load(): { muted: boolean; volume: number } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as { muted?: unknown; volume?: unknown };
      return {
        muted: p.muted === true,
        volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : DEFAULT_VOLUME,
      };
    }
  } catch {
    /* ignore */
  }
  return { muted: false, volume: DEFAULT_VOLUME };
}

function apply(muted: boolean, volume: number) {
  applyMasterOutput(muted ? 0 : volume);
  try {
    localStorage.setItem(KEY, JSON.stringify({ muted, volume }));
  } catch {
    /* ignore */
  }
}

const initial = load();
apply(initial.muted, initial.volume); // honor saved mute even before the first sound

interface AudioStore {
  muted: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  muted: initial.muted,
  volume: initial.volume,
  toggleMute: () => {
    const muted = !get().muted;
    apply(muted, get().volume);
    set({ muted });
  },
  setVolume: (v: number) => {
    const volume = Math.max(0, Math.min(1, v));
    apply(get().muted, volume);
    set({ volume });
  },
}));
