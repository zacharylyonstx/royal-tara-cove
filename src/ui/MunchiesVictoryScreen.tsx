import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';
import { useNetStore } from '../state/netStore';
import { requestMunchies } from '../net/room';
import { activePlayers } from '../world/munchiesRoster';
import { CHARACTERS } from '../world/characters';

export function MunchiesVictoryScreen() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const myCharacterId = useNetStore((s) => s.myCharacterId);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-victory') return null;

  // The host owns the phase — a guest's tap is relayed (it used to do nothing).
  const playAgain = () => requestMunchies('again');

  const team = activePlayers();
  const winLine = team.length > 1
    ? `${team.map((id) => CHARACTERS[id].name).join(' + ')} win midnight. Snack team crowned!`
    : myCharacterId === 'penny' ? 'Penny wins midnight. Snack queen crowned.'
    : myCharacterId === 'dad' ? 'Dad wins midnight. Snack champ crowned.'
    : 'Luke wins midnight. Snack king crowned.';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20, 20, 30, 0.55)', zIndex: 160,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #3a5a8a, #2a8aaa, #5fa86a)',
        borderRadius: 22, padding: '28px 36px', color: '#fff7e6', textAlign: 'center',
        border: '3px solid #fff7e6', boxShadow: '0 14px 32px rgba(0,0,0,0.5)',
        animation: 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}>
        <div style={{ fontSize: 64 }}>🍪🥛🍪</div>
        <h2 style={{ margin: '6px 0', fontSize: 30 }}>You ate everything!</h2>
        <p style={{ margin: '6px 0' }}>{winLine}</p>
        <p style={{ margin: '12px 0', fontSize: 18 }}>Final score: <strong>{score}</strong></p>
        <button
          onClick={playAgain}
          style={{
            marginTop: 8, padding: '12px 28px', fontSize: 16, fontWeight: 700,
            background: '#5fa86a', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
            minHeight: 48, touchAction: 'manipulation',
          }}
        >Play again ▶</button>
      </div>
    </div>
  );
}
