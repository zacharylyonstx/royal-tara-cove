import { create } from 'zustand';
import { Vector3 } from 'three';
import type { CharacterId } from '../types';

interface GameStore {
  activeCharacterId: CharacterId;
  welcomeOpen: boolean;
  // Per-character world state. These are mutable containers — systems mutate
  // them directly inside useFrame loops; React doesn't re-render on mutation.
  positions: Record<CharacterId, Vector3>;
  yaws: Record<CharacterId, number>;
  setActiveCharacter: (id: CharacterId) => void;
  closeWelcome: () => void;
  openWelcome: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  activeCharacterId: 'dad',
  welcomeOpen: true,
  positions: {
    // Spawn the three of you at the entry of Royal Tara Cove (north end of
    // the straight section, just south of the Avery Ranch Blvd intersection).
    // World convention: -Z = north, +Z = south.
    dad: new Vector3(-2.5, 0, -110),
    penny: new Vector3(0, 0, -111),
    luke: new Vector3(2.5, 0, -110),
  },
  yaws: {
    dad: 0,
    penny: 0,
    luke: 0,
  },
  setActiveCharacter: (id) => set({ activeCharacterId: id }),
  closeWelcome: () => set({ welcomeOpen: false }),
  openWelcome: () => set({ welcomeOpen: true }),
}));
