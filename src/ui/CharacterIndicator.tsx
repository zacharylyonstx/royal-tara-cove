import { useGameStore } from '../state/gameStore';
import { CHARACTERS } from '../world/characters';

export function CharacterIndicator() {
  const activeId = useGameStore((s) => s.activeCharacterId);
  const gameMode = useGameStore((s) => s.gameMode);
  const def = CHARACTERS[activeId];

  // Munchies and Treehouse use netStore.myCharacterId for character selection;
  // activeCharacterId here reflects the free-roam 3D character and is
  // irrelevant/misleading while those modes are active.
  if (gameMode === 'munchies' || gameMode === 'treehouse') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        padding: '10px 16px',
        background: `linear-gradient(135deg, ${def.bodyColor}cc, ${def.bodyColor}99)`,
        color: 'white',
        borderRadius: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 15,
        fontWeight: 600,
        pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        zIndex: 100,
      }}
    >
      <span style={{ fontSize: 22, marginRight: 8 }}>{def.emoji}</span>
      Playing as {def.name}
    </div>
  );
}
