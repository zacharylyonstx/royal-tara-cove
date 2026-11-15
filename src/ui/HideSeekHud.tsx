import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useHideSeekStore } from '../state/hideSeekStore';
import { requestHideSeek } from '../net/room';
import { HS_NAME, fmtClock } from '../world/hideSeek';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import type { CharacterId } from '../types';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** "Penny", "Penny and Luke", "Dad, Penny and Luke". */
function names(ids: CharacterId[]): string {
  const n = ids.map((id) => HS_NAME[id]);
  if (n.length <= 1) return n[0] ?? '';
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

/** Everything hide-and-seek puts on the glass. */
export function HideSeekHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const me = useNetStore((s) => s.myCharacterId);
  const phase = useHideSeekStore((s) => s.phase);
  const round = useHideSeekStore((s) => s.round);
  const seeker = useHideSeekStore((s) => s.seeker);
  const players = useHideSeekStore((s) => s.players);
  const found = useHideSeekStore((s) => s.found);
  const foundBy = useHideSeekStore((s) => s.foundBy);
  const endsAt = useHideSeekStore((s) => s.endsAt);
  const lastFound = useHideSeekStore((s) => s.lastFound);
  const bumpAt = useHideSeekStore((s) => s.bumpAt);
  const notice = useHideSeekStore((s) => s.notice);
  const stars = useHideSeekStore((s) => s.stars);
  const seekSecs = useHideSeekStore((s) => s.seekSecs);
  const best = useHideSeekStore((s) => s.best);
  const newBest = useHideSeekStore((s) => s.newBest);

  const active = gameMode === 'freeplay' && !welcomeOpen && !!me;
  const [now, setNow] = useState(() => performance.now() / 1000);
  /** When THIS screen saw the seeking start (for the "ready or not" splash). */
  const [seekSeen, setSeekSeen] = useState({ round: -1, at: 0 });
  /** The score card can be closed early; it never outlives its round. */
  const [cardClosed, setCardClosed] = useState(-1);

  // One light ticker drives every countdown and toast timeout here.
  const busy = active && (phase !== 'idle' || (!!notice && now - notice.at < 3.2) || now - bumpAt < 2);
  useEffect(() => {
    if (!busy) return;
    const tick = () => {
      const t = performance.now() / 1000;
      setNow(t);
      const s = useHideSeekStore.getState();
      setSeekSeen((cur) => (s.phase === 'seeking' && cur.round !== s.round ? { round: s.round, at: t } : cur));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [busy]);
  // The score card is a natural pause: hand the mouse back so "OK!" is clickable.
  useEffect(() => {
    if (active && phase === 'results' && document.pointerLockElement) document.exitPointerLock();
  }, [active, phase]);

  if (!active || !me) return null;

  const playing = players.includes(me) && phase !== 'idle';
  const hiders = players.filter((id) => id !== seeker);
  const unfound = hiders.filter((id) => found[id] === undefined);
  const iSeek = seeker === me;
  const iAmFound = found[me] !== undefined;
  const left = Math.max(0, endsAt - now);
  const seekerName = seeker ? HS_NAME[seeker] : 'Someone';
  const out: React.ReactNode[] = [];

  // ------------------------------------------------ counting: the seeker --
  if (phase === 'counting' && iSeek) {
    const n = Math.ceil(left);
    out.push(
      <div
        key="blind"
        style={{
          position: 'fixed', inset: 0, zIndex: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 38%, #2b2360 0%, #15102e 60%, #0a0818 100%)', color: '#fff', fontFamily: FONT, textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 76, lineHeight: 1 }}>🙈</div>
        <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6, letterSpacing: 0.5 }}>No peeking!</div>
        <div key={n} style={{ fontSize: 190, fontWeight: 900, lineHeight: 1.05, color: n <= 5 ? '#ffd866' : '#fff', textShadow: '0 8px 40px rgba(120,100,255,0.6)', animation: 'pop-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          {n}
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, opacity: 0.85 }}>
          You're counting at Home Base while {names(hiders) || 'everyone'} {hiders.length === 1 ? 'hides' : 'hide'}…
        </div>
      </div>,
    );
  }

  // ------------------------------------------------- counting: the hiders --
  if (phase === 'counting' && !iSeek && playing) {
    const n = Math.ceil(left);
    out.push(
      <div key="hide" style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', zIndex: 120, pointerEvents: 'none', fontFamily: FONT, textAlign: 'center' }}>
        <div style={{ background: 'rgba(28,22,60,0.9)', border: '3px solid #ffd866', borderRadius: 18, padding: '10px 30px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 34, fontWeight: 900 }}>
            🏃 HIDE! <span key={n} style={{ display: 'inline-block', color: n <= 5 ? '#ff6b6b' : '#ffd866', minWidth: 54, animation: 'pop-in 0.25s ease-out both' }}>{n}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.9, marginTop: 2 }}>
            {seekerName} is counting at the tree · stay inside the glowing wall
          </div>
        </div>
      </div>,
    );
  }

  // ----------------------------------------------------------- seeking ----
  if (phase === 'seeking') {
    const low = left <= 20;
    let line: string;
    if (!playing) line = 'Hide-and-seek is on — join the next one at the Home Base tree 🌳';
    else if (iSeek) line = `🔎 Find ${names(unfound)}!`;
    else if (iAmFound) line = unfound.length ? `🎉 You were found — help ${seekerName} find ${names(unfound)}!` : '🎉 Everyone\'s found!';
    else line = `🤫 Shh… ${seekerName} is looking for you`;
    out.push(
      <div key="seek" style={{ position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 110, fontFamily: FONT, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ pointerEvents: 'none', background: low ? 'rgba(150,24,34,0.92)' : 'rgba(28,22,60,0.88)', border: `3px solid ${low ? '#ff8a8a' : '#ffd866'}`, borderRadius: 16, padding: '6px 20px', color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 0.5 }}>
            ⏱ {fmtClock(Math.ceil(left))} <span style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}> · found {hiders.length - unfound.length} of {hiders.length}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 1 }}>{line}</div>
        </div>
        {playing && (
          <button
            onClick={() => requestHideSeek({ type: 'stop', by: me })}
            style={{ background: 'rgba(20,28,38,0.7)', color: '#fff', border: '2px solid rgba(255,255,255,0.45)', borderRadius: 999, padding: '3px 12px', fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ✋ stop game
          </button>
        )}
      </div>,
    );
    if (seekSeen.round === round && now - seekSeen.at < 2.4 && playing) {
      out.push(
        <div key="ready" style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 125, pointerEvents: 'none', fontFamily: FONT, background: 'linear-gradient(135deg,#f6c945,#f0883a)', color: '#2a1a05', padding: '14px 34px', borderRadius: 20, fontSize: 32, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', animation: 'pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          {iSeek ? 'Ready or not, here you come! 👀' : `Ready or not, here comes ${seekerName}! 👀`}
        </div>,
      );
    }
  }

  // ------------------------------------------------------ "found you!" ----
  if (lastFound && now - lastFound.at < 2.8 && phase !== 'idle') {
    const who = lastFound.who === me ? 'you' : HS_NAME[lastFound.who];
    const by = lastFound.by === me ? 'You' : lastFound.by ? HS_NAME[lastFound.by] : 'Someone';
    out.push(
      <div key={`found-${lastFound.at}`} style={{ position: 'fixed', top: '36%', left: '50%', transform: 'translateX(-50%)', zIndex: 126, pointerEvents: 'none', fontFamily: FONT, background: 'linear-gradient(135deg,#ff7eb3,#ff4d8d)', color: '#fff', padding: '14px 36px', borderRadius: 22, fontSize: 36, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 12px 34px rgba(0,0,0,0.45)', border: '4px solid #fff', animation: 'pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        🎉 {by} found {who}!
      </div>,
    );
  }

  // -------------------------------------------------- little one-liners ----
  if (now - bumpAt < 1.8 && playing) {
    out.push(
      <div key="bump" style={{ position: 'fixed', bottom: 150, left: '50%', transform: 'translateX(-50%)', zIndex: 115, pointerEvents: 'none', fontFamily: FONT, background: 'rgba(20,28,38,0.86)', color: '#bff6ff', border: '2px solid #5fe6ff', padding: '7px 18px', borderRadius: 999, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>
        🚧 That's the edge of the game — stay inside the glow!
      </div>,
    );
  }
  if (notice && now - notice.at < 3) {
    out.push(
      <div key="notice" style={{ position: 'fixed', top: '24%', left: '50%', transform: 'translateX(-50%)', zIndex: 124, pointerEvents: 'none', fontFamily: FONT, background: 'rgba(28,22,60,0.92)', color: '#fff', border: '2px solid #ffd866', padding: '9px 22px', borderRadius: 16, fontSize: 19, fontWeight: 800, whiteSpace: 'nowrap' }}>
        🙈 {notice.text}
      </div>,
    );
  }

  // -------------------------------------------------------- score card ----
  // (Held back a beat when the last "found you!" ended the round, so that
  // moment gets the screen to itself first.)
  const foundMoment = !!lastFound && now - lastFound.at < 2.6;
  if (phase === 'results' && cardClosed !== round && seeker && !foundMoment) {
    const everyone = unfound.length === 0;
    const order = [...hiders].sort((a, b) => (found[b] ?? 9999) - (found[a] ?? 9999));
    const tallyIds = CHARACTER_ORDER.filter((id) => (stars[id] ?? 0) > 0 || players.includes(id));
    const myTime = !iSeek && players.includes(me) ? (found[me] ?? seekSecs) : 0;
    out.push(
      <div key="card" style={{ position: 'fixed', inset: 0, zIndex: 175, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontFamily: FONT }}>
        <div style={{ pointerEvents: 'auto', width: 'min(460px, 92vw)', background: 'linear-gradient(160deg, #fffaf0, #ffe9bd)', border: '4px solid #3a2f6b', borderRadius: 24, padding: '18px 22px 16px', color: '#2a2433', boxShadow: '0 22px 60px rgba(0,0,0,0.5)', animation: 'pop-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: '#7a6bb8' }}>HIDE &amp; SEEK</div>
          <div style={{ fontSize: 27, fontWeight: 900, margin: '2px 0 10px', lineHeight: 1.15 }}>
            {everyone ? `${seekerName} found everyone! 🎉` : `Time's up — ${names(unfound)} stayed hidden! 🙌`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            {order.map((id, i) => {
              const t = found[id];
              const by = foundBy[id];
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.75)', borderRadius: 12, padding: '7px 12px' }}>
                  <span style={{ fontSize: 26 }}>{CHARACTERS[id].emoji}</span>
                  <span style={{ fontWeight: 800, fontSize: 17, minWidth: 58 }}>{HS_NAME[id]}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: t === undefined ? '#1f7a3a' : '#4a4458' }}>
                    {t === undefined ? 'never found! ⭐' : `hid for ${fmtClock(t)}${by ? ` · found by ${HS_NAME[by]}` : ''}`}
                  </span>
                  {i === 0 && hiders.length > 1 && <span title="Best hider" style={{ fontSize: 20 }}>🏆</span>}
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(58,47,107,0.1)', borderRadius: 12, padding: '7px 12px' }}>
              <span style={{ fontSize: 26 }}>{CHARACTERS[seeker].emoji}</span>
              <span style={{ fontWeight: 800, fontSize: 17, minWidth: 58 }}>{seekerName}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#4a4458' }}>
                🔎 found {hiders.length - unfound.length} of {hiders.length} {'⭐'.repeat(hiders.length - unfound.length)}
              </span>
            </div>
          </div>
          {newBest[me] && myTime >= 20 && (
            <div style={{ marginTop: 9, fontSize: 15, fontWeight: 800, color: '#b3262d' }}>
              🏅 Your longest hide ever: {fmtClock(best[me] ?? myTime)}!
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: '#4a4458' }}>
            Today's stars: {tallyIds.map((id) => `${HS_NAME[id]} ⭐${stars[id] ?? 0}`).join('  ·  ')}
          </div>
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, background: 'rgba(58,47,107,0.1)', borderRadius: 12, padding: '7px 10px' }}>
            Play again? Whoever wants to count next walks up to the Home Base tree 🌳
          </div>
          <button
            onClick={() => setCardClosed(round)}
            style={{ marginTop: 12, background: '#3a2f6b', color: '#fff', border: 'none', borderRadius: 12, padding: '9px 26px', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
          >
            OK!
          </button>
        </div>
      </div>,
    );
  }

  return <>{out}</>;
}
