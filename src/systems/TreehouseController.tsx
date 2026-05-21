import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useTreehouseStore } from '../state/treehouseStore';
import { useNetStore } from '../state/netStore';
import { useCombatStore } from '../state/combatStore';
import {
  MISSIONS,
  getNextMissionId,
  treehouseSpawnPoint,
} from '../world/treehouseMissions';

// TODO(Task 14): replace these with real imports from '../audio'.
const treehouseChime = () => { /* added in Task 14 */ };
const startTreehouseTheme = () => { /* added in Task 14 */ };
const stopTreehouseTheme = () => { /* added in Task 14 */ };

const COMPLETE_TOAST_S = 3.2;

export function TreehouseController() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'treehouse') return null;
  return <TreehouseControllerInner />;
}

function TreehouseControllerInner() {
  const completeAt = useRef<number | null>(null);
  const teleported = useRef(false);

  // On mount: warm afternoon lighting, start theme.
  useEffect(() => {
    useCombatStore.setState({ timeOfDay: 0.25 });
    startTreehouseTheme();
    return () => {
      stopTreehouseTheme();
      useCombatStore.setState({ timeOfDay: 0.0 });
    };
  }, []);

  // Activate the pending mission once on mount (host only).
  useEffect(() => {
    if (!useNetStore.getState().isHost) return;
    const ts = useTreehouseStore.getState();
    if (!ts.activeMissionId && ts.pendingMissionId) {
      const m = MISSIONS[ts.pendingMissionId];
      if (m) {
        m.setup?.();
        useTreehouseStore.getState().setActiveMission(m.id);
      }
    }
  }, []);

  useFrame(() => {
    if (!useNetStore.getState().isHost) return;
    const gs = useGameStore.getState();
    const phase = gs.phase;

    // Teleport players to spawn on first frame after entering the mode.
    if (!teleported.current) {
      const spawn = treehouseSpawnPoint();
      gs.positions.luke.set(spawn.x, 0, spawn.z);
      gs.positions.penny.set(spawn.x + 1.5, 0, spawn.z);
      teleported.current = true;
    }

    // Welcome → play once user dismissed
    if (phase === 'treehouse-welcome' && useTreehouseStore.getState().hasSeenWelcome) {
      gs.setPhase('treehouse-play');
    }

    const now = performance.now() / 1000;

    // Mission completion check
    if (phase === 'treehouse-play') {
      const ts = useTreehouseStore.getState();
      if (ts.activeMissionId) {
        const m = MISSIONS[ts.activeMissionId];
        if (m && m.isComplete()) {
          m.teardown?.();
          useTreehouseStore.getState().completeMission(m.id, m.sticker);
          treehouseChime();
          completeAt.current = now;
          gs.setPhase('treehouse-complete');
          const next = getNextMissionId(m.id);
          if (next) {
            useTreehouseStore.getState().setPendingMission(next);
          }
        }
      }
    }

    // After complete-toast window expires, activate next mission and return to play.
    if (phase === 'treehouse-complete' && completeAt.current !== null && now - completeAt.current > COMPLETE_TOAST_S) {
      completeAt.current = null;
      const ts = useTreehouseStore.getState();
      if (ts.pendingMissionId) {
        const next = MISSIONS[ts.pendingMissionId];
        if (next) {
          next.setup?.();
          useTreehouseStore.getState().setActiveMission(next.id);
        }
      }
      gs.setPhase('treehouse-play');
    }
  });

  return null;
}
