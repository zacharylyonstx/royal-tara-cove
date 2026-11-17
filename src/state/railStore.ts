import { create } from 'zustand';

// The little bit of rail state the UI needs to REACT to (everything else is
// read straight off world/redLine's `rail` each frame).
interface RailStore {
  /** Which train (0/1) my character is riding, or −1. */
  aboard: number;
  setAboard: (i: number) => void;
}
export const useRailStore = create<RailStore>((set, get) => ({
  aboard: -1,
  setAboard: (aboard) => { if (get().aboard !== aboard) set({ aboard }); },
}));
