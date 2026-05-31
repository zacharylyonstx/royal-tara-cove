import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';

const PLAY_LABELS: Record<string, string> = {
  ride: 'ride bike',
  getoff: 'get off',
  pickup: 'pick up ball',
};

export function InteractPrompt() {
  const hover = useGameStore((s) => s.hoverDoorId);
  const doors = useGameStore((s) => s.doors);
  const hoverPlay = usePlayStore((s) => s.hoverPlay);

  // Free-roam play cues take precedence over doors.
  let label: string | null = null;
  let key = 'E';
  if (hoverPlay === 'shoot') {
    label = 'shoot';
    key = 'click';
  } else if (hoverPlay && PLAY_LABELS[hoverPlay]) {
    label = PLAY_LABELS[hoverPlay];
  } else if (hover) {
    label = doors[hover]?.open ? 'close door' : 'open door';
  }
  if (!label) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 90,
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        background: 'rgba(20, 30, 40, 0.7)',
        color: 'white',
        borderRadius: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 16,
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <kbd
        style={{
          padding: '3px 10px',
          background: '#3a5a25',
          color: 'white',
          borderRadius: 6,
          fontWeight: 700,
          marginRight: 8,
        }}
      >
        {key}
      </kbd>
      {label}
    </div>
  );
}
