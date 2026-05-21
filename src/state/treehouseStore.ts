import { create } from 'zustand';
import { loadTreehouse, saveTreehouse } from '../world/treehouseStorage';

export interface Souvenir {
  id: string;
  emoji: string;
  label: string;
  earnedAt: number;
}

export interface MissionItemState {
  /** Which mission item is active in the world (e.g. 'gnome', 'sparky'). */
  id: string;
  x: number; z: number;
  carriedBy: 'luke' | 'penny' | null;
}

interface TreehouseStore {
  completedMissions: string[];
  souvenirs: Record<string, Souvenir>;
  activeMissionId: string | null;
  pendingMissionId: string;
  missionItem: MissionItemState | null;
  hasSeenWelcome: boolean;

  setActiveMission: (id: string | null) => void;
  setPendingMission: (id: string) => void;
  completeMission: (id: string, sticker: Omit<Souvenir, 'earnedAt'>) => void;
  spawnMissionItem: (id: string, x: number, z: number) => void;
  pickUpMissionItem: (who: 'luke' | 'penny') => void;
  dropMissionItem: (x: number, z: number) => void;
  setMissionItemPos: (x: number, z: number) => void;
  clearMissionItem: () => void;
  markWelcomeSeen: () => void;
  reset: () => void;
}

const initial = loadTreehouse();

export const useTreehouseStore = create<TreehouseStore>((set, get) => ({
  completedMissions: initial.completedMissions,
  souvenirs: initial.souvenirs,
  activeMissionId: null,
  pendingMissionId: initial.pendingMissionId,
  missionItem: null,
  hasSeenWelcome: initial.hasSeenWelcome,

  setActiveMission: (id) => set({ activeMissionId: id }),
  setPendingMission: (id) => {
    set({ pendingMissionId: id });
    persist(get);
  },
  completeMission: (id, sticker) => {
    set((s) => ({
      completedMissions: s.completedMissions.includes(id)
        ? s.completedMissions
        : [...s.completedMissions, id],
      souvenirs: {
        ...s.souvenirs,
        [sticker.id]: { ...sticker, earnedAt: Date.now() },
      },
      activeMissionId: null,
      missionItem: null,
    }));
    persist(get);
  },
  spawnMissionItem: (id, x, z) => set({ missionItem: { id, x, z, carriedBy: null } }),
  pickUpMissionItem: (who) => set((s) => {
    if (!s.missionItem) return s;
    return { missionItem: { ...s.missionItem, carriedBy: who } };
  }),
  dropMissionItem: (x, z) => set((s) => {
    if (!s.missionItem) return s;
    return { missionItem: { ...s.missionItem, x, z, carriedBy: null } };
  }),
  setMissionItemPos: (x, z) => set((s) => {
    if (!s.missionItem) return s;
    return { missionItem: { ...s.missionItem, x, z } };
  }),
  clearMissionItem: () => set({ missionItem: null }),

  markWelcomeSeen: () => {
    set({ hasSeenWelcome: true });
    persist(get);
  },

  reset: () => {
    set({
      completedMissions: [],
      souvenirs: {},
      activeMissionId: null,
      pendingMissionId: 'welcome-to-the-cove',
      missionItem: null,
      hasSeenWelcome: false,
    });
    persist(get);
  },
}));

function persist(get: () => TreehouseStore) {
  const s = get();
  saveTreehouse({
    completedMissions: s.completedMissions,
    souvenirs: s.souvenirs,
    pendingMissionId: s.pendingMissionId,
    hasSeenWelcome: s.hasSeenWelcome,
  });
}
