// LocalStorage wrappers for Treehouse Club persistence.
// Single key holds a JSON blob with all persisted fields.

const KEY = 'treehouse.v1';

export interface PersistedTreehouse {
  completedMissions: string[];
  souvenirs: Record<string, { id: string; emoji: string; label: string; earnedAt: number }>;
  pendingMissionId: string;
  hasSeenWelcome: boolean;
}

const DEFAULT: PersistedTreehouse = {
  completedMissions: [],
  souvenirs: {},
  pendingMissionId: 'welcome-to-the-cove',
  hasSeenWelcome: false,
};

export function loadTreehouse(): PersistedTreehouse {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<PersistedTreehouse>;
    return {
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      souvenirs: typeof parsed.souvenirs === 'object' && parsed.souvenirs !== null
        ? parsed.souvenirs as PersistedTreehouse['souvenirs']
        : {},
      pendingMissionId: typeof parsed.pendingMissionId === 'string'
        ? parsed.pendingMissionId
        : DEFAULT.pendingMissionId,
      hasSeenWelcome: !!parsed.hasSeenWelcome,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveTreehouse(state: PersistedTreehouse): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded or storage blocked — silent no-op */
  }
}
