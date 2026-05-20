import { useMunchiesStore } from '../state/munchiesStore';
import type { Difficulty } from '../world/munchiesConfig';

const opts: { value: Difficulty; label: string; emoji: string }[] = [
  { value: 'sleepy', label: 'Sleepy',  emoji: '😴' },
  { value: 'awake',  label: 'Awake',   emoji: '😬' },
];

export function MunchiesDifficultyToggle() {
  const difficulty = useMunchiesStore((s) => s.difficulty);
  const setDifficulty = useMunchiesStore((s) => s.setDifficulty);

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        margin: '4px 0 12px',
      }}
    >
      {opts.map((o) => {
        const selected = difficulty === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setDifficulty(o.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: `2px solid ${selected ? '#7a5cad' : '#bba8d8'}`,
              background: selected ? '#7a5cad' : 'rgba(255,255,255,0.85)',
              color: selected ? '#fff' : '#3a2858',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 80ms ease',
            }}
          >
            {o.emoji} {o.label}
          </button>
        );
      })}
    </div>
  );
}
