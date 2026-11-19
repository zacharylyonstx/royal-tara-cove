# Afternote (inside Royal Tara Cove)

A copy of the finished game AFTERNOTE (its own repository lives elsewhere), served
as its own page at `/afternote/` and opened from the Royal Tara Cove game menu.

- `src/` started as that game's `src/` with three differences: `three` is
  imported as `three-afternote` (the three.js version the game was built and
  tuned on, installed side by side with Royal Tara Cove's), the title screen has
  a link back to the menu, and `styles.css` has that link's style at the end.
- It is plain JavaScript on purpose: it is not part of the TypeScript build or
  the lint run.
- Its tests live here too: `npm run test:afternote` (rules, `tests/unit`) and
  `npm run test:afternote:e2e` (a real browser, `tests/e2e`; needs `npm run dev`
  running on port 5173, or starts it).
- `?test=1` (manual clock, audio off) and `window.render_game_to_text()` work
  here as they do there.

## Made easier here (2026-11-18)

Zak asked for it to be "a little easier to play… and more interactive" for the kids.
These changes live only in this copy; the game's own repository is as it was.

- **Wider timing** (`core/Constants.js` RULES): a press counts up to 0.5 s early or
  late (it was 0.24 / 0.3), up to the halfway point between two notes; letting go of
  a held note a little early still counts.
- **Helping hand** (Settings; `Conductor._assist`): *Exact key* / *Near keys*
  (default — the key next door to a glowing note plays it) / *Any key* (every key
  plays the nearest glowing note). What is built and recorded is the note that
  sounded, in the player's own timing; a press outside every window builds nothing.
- **Pace**: a new player starts on *Unhurried*; *Gentle* (two-thirds speed) is new.
- **Every key answers**: a key that builds nothing sings louder than before and the
  ember takes its colour; during the scenes between passages the keys still play.

## Every movement open (2026-11-18)

All three lighthouse movements can be started from the title in any order. A
movement played before the ones under it simply has fewer Echoes to answer.

## The Sea of Bridges (2026-11-18)

A second way to play, opened from the title (and from the lighthouse's end card).
It is free play: there is no written melody and nothing can be missed.

**What the player does.** A chart shows seven places and the ten bridges that
could join them. Choose a dotted line, a sound and a mood, and cross: every key
pressed builds a stone and plays its note; a beat left empty is a gentle current
that carries Kite on. Reaching a place wakes it, and it gives a new sound and a
new mood. Any bridge can then be crossed again to lay a second and a third part
beside the first, each played with the Echoes of the earlier ones. Any bridge can
be heard again from the chart, with each part switched on or off.

**Why it is built this way** (the research behind it, in one line each):
choice, competence and making something of your own are what keep children
playing (self-determination theory); a low floor with "wide walls" beats more
levels; open-ended play with no fail state suits this age; and no streaks,
timers or pressure to return (the UK children's code for games).

**How it is made.**

| Part | File |
| --- | --- |
| Places, bridges, sounds, moods; a crossing's chart; keeping and re-performing a score | `src/music/sea.js` |
| Free-play rule: an unplayed beat is a rest, never a miss | `src/rules/MovementRunner.js` (`chart.free`) |
| The trip: chart → crossing → arrival → listening; saving | `src/gameplay/Voyage.js` |
| The places, landmarks, docks, braided routes, far-off bridges of light | `src/world/SeaWorld.js` |
| The chart and the arrival card | `src/ui/SeaChart.js` |
| Six new sounds, one tapped voice for free play | `src/audio/AudioEngine.js` |
| Backing that follows a mood's chords and levels | `src/audio/Arranger.js` (`setPiece`, `setScene`) |
| Numbers (grid, reach, layers, offsets) | `src/core/Constants.js` (`CROSSING`) |

- A crossing is an ordinary chart with an *open* slot every half beat, played by
  the same rule engine as the lighthouse. Only the first slot waits for the player.
- What is kept for each part is its **score**: `[[slot, pitch], …]`. Loading (and
  each new part's Echoes) re-performs the score exactly on the beat, so stacked
  parts always line up. Saved under `afternote.sea.v1`, apart from the lighthouse save.
- Starting a bridge over keeps the old one until the new one is finished. Leaving
  a crossing part-way keeps nothing of it.
- Waking the seventh place and building the tenth bridge are each marked on the
  arrival card. Nothing else is counted, timed or scored.
- Test hooks: `render_game_to_text()` has a `sea` block; `__afternote.sea`
  has `open`, `build`, `add`, `listen`, `view`.

### Sending a bridge to someone (2026-11-18)

Any bridge can be sent as a link (`Send it to someone` on the chart or the arrival
card; `Copy link`, or the device's own share sheet where there is one). Whoever
opens it hears the bridge, can lay a part of their own over it and send it back.

- **The link is the bridge.** `…/afternote/#b=<code>`: the edge, which end it starts
  from, the mood, the tempo, and each part's sound and stones (`encodeBridge` /
  `decodeBridge` in `src/music/sea.js`; about 40 letters a part). No names, no
  account, no server: nothing is stored anywhere but the two browsers. The code is
  taken out of the address bar as soon as it is read.
- **The wire format is append-only.** `WIRE_EDGES`, `WIRE_MOODS`, `WIRE_SOUNDS` in
  `sea.js` give each thing its letter; add to their ends only. A rule test pins two
  codes so a reordering is caught.
- **It comes from outside, so it is checked.** Shape by a strict pattern, then every
  index, then the same `sanitizeBridge` a saved bridge goes through. Nothing from a
  link is ever shown as text; only names the game already has.
- **Where it goes** (`receiveBridge`): a bridge the player already has comes back
  *grown* in the same place (their own bridge on the chart gains the new part);
  anything else waits among the bridges **from afar** (bottom-left of the chart, up
  to 12) and wakes nothing. Nothing of the player's is ever replaced by a link.
- **From afar**: hear it; add a part (this is a real crossing, so arriving wakes the
  far place and it gives its sound and mood); send it on; set it on the chart once
  both its ends have been reached (a bridge already there changes places with it,
  so nothing is lost); or let it go (asked first).
- A link opened in the middle of a crossing waits until the chart is next shown.

**Checked:** 90 rule tests and 42 browser tests (23 for the lighthouse, 19 for the
sea: first note waits, every key and every on-screen pad builds a stone, no
misses, waking and gifts, three stacked parts, listening, leaving, starting over,
save and reload, pause and restart, the way in from the lighthouse's end card,
the last place and the last bridge, and for links: a second browser opens the
link, hears it, adds a part and sends it back and it comes home grown; swapping,
letting go, junk links refused, a link arriving mid-crossing; every control on
screen at six window sizes).
Loudness of the six new sounds and seven moods was measured from offline renders.
**Not checked:** how it sounds to a person, a real phone or tablet (including the
share sheet and copying a link there), and children actually playing it.
