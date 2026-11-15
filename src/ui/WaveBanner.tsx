import { useEffect, useState } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { SPAWN_SITES, WAVES, WAVE_COUNT, sitesForWave } from '../world/blobWaves';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
/** How long the "WAVE N" title card stays up once a wave starts. */
const TITLE_S = 3.6;

/**
 * Wave title cards. Built only from synced state (wave number + state), so the
 * kids on the guest side get the same call-outs Dad does — "a pod landed up
 * the street!" used to exist only as a host-side speech bubble.
 */
export function WaveBanner() {
  const phase = useGameStore((s) => s.phase);
  const gameMode = useGameStore((s) => s.gameMode);
  const waveState = useCombatStore((s) => s.waveState);
  const waveIndex = useCombatStore((s) => s.waveIndex);
  const intermissionEndsAt = useCombatStore((s) => s.intermissionEndsAt);
  const [now, setNow] = useState(() => performance.now() / 1000);
  /** When each wave's card went up (so it shows once, for TITLE_S). */
  const [card, setCard] = useState<{ wave: number; at: number }>({ wave: 0, at: 0 });

  const live = gameMode === 'aliens' && phase === 'combat';
  const spawning = live && waveState === 'spawning';
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      const t = performance.now() / 1000;
      setNow(t);
      setCard((c) => {
        const cs = useCombatStore.getState();
        return cs.waveState === 'spawning' && c.wave !== cs.waveIndex ? { wave: cs.waveIndex, at: t } : c;
      });
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [live, spawning]);

  if (!live) return null;

  // Between waves: breather + countdown.
  if (waveState === 'intermission') {
    const remain = Math.max(0, intermissionEndsAt - now);
    const next = waveIndex + 1;
    return (
      <div
        style={{
          position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(16, 44, 30, 0.86)', border: '3px solid #7be36a', borderRadius: 16,
          padding: '16px 34px', color: 'white', fontFamily: FONT, textAlign: 'center',
          boxShadow: '0 12px 30px rgba(0,0,0,0.4)', zIndex: 95, pointerEvents: 'none',
          animation: 'pop-in 0.35s ease-out',
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 800 }}>✅ Wave {waveIndex} cleared!</div>
        <div style={{ fontSize: 16, marginTop: 6, color: '#c9f5c0' }}>
          {next >= WAVE_COUNT ? 'Last wave' : `Wave ${next}`} in {Math.ceil(remain)}… grab the glowing power-ups!
        </div>
      </div>
    );
  }

  // A wave just started: title card.
  if (card.wave === waveIndex && waveIndex >= 1 && now - card.at < TITLE_S) {
    const def = WAVES[waveIndex - 1];
    const boss = waveIndex === WAVE_COUNT;
    const pods = sitesForWave(waveIndex).filter((s) => SPAWN_SITES[s].pod).map((s) => SPAWN_SITES[s].label);
    return (
      <div
        style={{
          position: 'fixed', top: '21%', left: '50%', transform: 'translateX(-50%)',
          background: boss ? 'rgba(70, 8, 22, 0.88)' : 'rgba(14, 28, 44, 0.84)',
          border: `3px solid ${boss ? '#ff4d6d' : '#3afff0'}`, borderRadius: 16,
          padding: '14px 36px', color: 'white', fontFamily: FONT, textAlign: 'center',
          boxShadow: '0 12px 30px rgba(0,0,0,0.45)', zIndex: 95, pointerEvents: 'none',
          animation: 'pop-in 0.35s ease-out', maxWidth: '86vw',
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 4, opacity: 0.75 }}>WAVE {waveIndex} OF {WAVE_COUNT}</div>
        <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{def?.title ?? 'Here they come!'}</div>
        {pods.length > 0 && (
          <div style={{ fontSize: 15, marginTop: 6, color: boss ? '#ffc2cc' : '#b9f7f2' }}>
            🛸 Pods landing {pods.join(' and ')}
          </div>
        )}
      </div>
    );
  }

  return null;
}
