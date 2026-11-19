import { useGameStore } from '../state/gameStore';
import type { GameMode } from '../state/gameStore';
import { unlockAudio } from '../audio';
import { joinRoom } from '../net/room';

export function WelcomeScreen() {
  const open = useGameStore((s) => s.welcomeOpen);
  const setGameMode = useGameStore((s) => s.setGameMode);

  const pick = async (mode: GameMode) => {
    unlockAudio();
    setGameMode(mode);
    // Hide welcome but DON'T start phase yet — CharacterSelect appears next
    // and calls closeWelcome() (which sets the phase) once a character is
    // claimed.
    useGameStore.setState({ welcomeOpen: false });
    await joinRoom(mode);
  };

  // Afternote is its own little game on its own page: no room to join, no
  // character to pick. (Its title screen has a link back here.)
  const openAfternote = () => { window.location.href = '/afternote/'; };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 30, 40, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)',
          border: '4px solid #5a8a3e',
          borderRadius: 24,
          padding: '28px 36px',
          maxWidth: 820,
          width: '100%',
          // On a short window the bottom row of games must still be reachable.
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          animation: 'pop-in 0.42s ease both',
        }}
      >
        <h1 style={{ fontSize: 38, margin: 0, color: '#3a5a25' }}>🏡 Royal Tara Cove</h1>
        <p style={{ fontSize: 18, color: '#3a4030', margin: '8px 0 4px' }}>
          Hi <strong>Penny</strong> &amp; <strong>Luke</strong>!
        </p>
        <p style={{ fontSize: 15, color: '#5a5040', margin: '4px 0 18px' }}>
          Welcome back to the old neighborhood. Pick a game:
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            margin: '4px 0 18px',
            animation: 'card-rise 0.5s ease both',
            animationDelay: '0.12s',
          }}
        >
          <GameCard
            emoji="🏘️"
            title="FREE PLAY"
            blurb="Just play! Ride the MetroRail train to the Domain, Downtown Austin and all the way out to Bastrop (there are cars, bikes and golf carts to drive at every stop), play hide-and-seek at the big tree in our yard, bike to Rutledge Elementary, run errands for the neighbors, swim at the pool, adopt a Pomeranian, and hang out in our house."
            accent="#e09028"
            onPlay={() => pick('freeplay')}
          />
          <GameCard
            emoji="👽"
            title="ALIEN INVASION"
            blurb="The Schmorgesblobs crashed in our cul-de-sac! Use the ray gun to save the family."
            accent="#5a8a3e"
            onPlay={() => pick('aliens')}
          />
          <GameCard
            emoji="🌪️"
            title="TORNADO WARNING"
            blurb="A tornado is ripping down the street. Run inside 10600 before it throws you away!"
            accent="#3a5a8a"
            onPlay={() => pick('tornado')}
          />
          <GameCard
            emoji="🥛"
            title="MIDNIGHT MUNCHIES"
            blurb="It's midnight. Sneak through our house, grab every cookie, and don't let the sleepwalkers catch you! Play together — whoever isn't sneaking is sleepwalking."
            accent="#7a5cad"
            onPlay={() => pick('munchies')}
          />
          <GameCard
            emoji="🔦"
            title="SIREN HEAD"
            blurb="It's dark and foggy and tall Siren Head is roaming the street! Sneak out together, grab the 5 glowing lanterns, and light up the block before he finds you. Get bonked? A buddy helps you up!"
            accent="#b0344f"
            onPlay={() => pick('night')}
          />
          <GameCard
            emoji="🎵"
            title="AFTERNOTE"
            blurb="A music adventure. Play a note and a stone appears to land on — play a melody and you've built a path. Bring the lighthouse to life with your own song! (One player; opens in its own screen.)"
            accent="#6a4fc3"
            onPlay={openAfternote}
          />
        </div>

        <p style={{ fontSize: 13, color: '#5a5040', margin: 0, lineHeight: 1.5 }}>
          <strong>WASD</strong> move · <strong>Shift</strong> run · <strong>E</strong> ride bike / pick up ball / open door · <strong>click</strong> or <strong>Space</strong> shoot hoops
          <br />
          🚲 On a bike: <strong>Space</strong> bunny-hop · hit the <strong>ramp</strong> for big air · tap <strong>Space</strong> again mid-air + hold <strong>W/S</strong> to flip!
        </p>
      </div>
    </div>
  );
}

function GameCard({
  emoji,
  title,
  blurb,
  accent,
  onPlay,
}: {
  emoji: string;
  title: string;
  blurb: string;
  accent: string;
  onPlay: () => void;
}) {
  return (
    <div
      className="gcard"
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: `3px solid ${accent}`,
        borderRadius: 16,
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent, letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: '#3a4030', minHeight: 60 }}>{blurb}</div>
      <button
        onClick={onPlay}
        style={{
          marginTop: 4,
          padding: '12px 28px',
          fontSize: 16,
          fontWeight: 700,
          background: accent,
          color: 'white',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
        }}
      >
        Let's play ▶
      </button>
    </div>
  );
}
