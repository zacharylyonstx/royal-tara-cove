import { useAudioStore } from '../state/audioStore';
import { useWardrobeStore } from '../state/wardrobeStore';

// Always-available mute toggle (parents will use this constantly). Sits top-right
// just below the character chip. Hidden while the dress-up modal is open so it
// doesn't overlap that panel's tabs.
export function AudioButton() {
  const muted = useAudioStore((s) => s.muted);
  const toggle = useAudioStore((s) => s.toggleMute);
  const wardrobeOpen = useWardrobeStore((s) => s.open);
  if (wardrobeOpen) return null;
  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute' : 'Mute'}
      title={muted ? 'Unmute' : 'Mute'}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 66px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        zIndex: 1001,
        width: 44,
        height: 44,
        borderRadius: 12,
        border: '2px solid rgba(255,255,255,0.4)',
        background: muted ? 'rgba(150,40,40,0.6)' : 'rgba(20,30,40,0.55)',
        color: '#fff',
        fontSize: 20,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
