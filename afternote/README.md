# Afternote (inside Royal Tara Cove)

A copy of the finished game AFTERNOTE (its own repository lives elsewhere), served
as its own page at `/afternote/` and opened from the Royal Tara Cove game menu.

- `src/` started as that game's `src/` with three differences: `three` is
  imported as `three-afternote` (the three.js version the game was built and
  tuned on, installed side by side with Royal Tara Cove's), the title screen has
  a link back to the menu, and `styles.css` has that link's style at the end.
- It is plain JavaScript on purpose: it is not part of the TypeScript build or
  the lint run.
- Its tests live here too: `npm run test:afternote` (rules, `tests/unit`),
  `npm run test:afternote:e2e` (Chrome's engine, `tests/e2e`; needs `npm run dev`
  on port 5173, or starts it) and `npm run test:afternote:cross` (the same tests on
  Safari's engine and on an emulated iPad; first time `npx playwright install webkit`).
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

**What the player does.** A map shows seven places and the ten bridges that
could join them. Choose a dotted line, a sound and a mood, and cross: every key
plays its note, and one note on each half-beat becomes a stone; a beat left empty
is a gentle current that carries Kite on. Reaching a place wakes it, and it gives
a new sound, a new mood and a new cloak for Kite. Any bridge can then be crossed
again to lay a second and a third part beside the first, each played with the
Echoes of the earlier ones. Any bridge can be heard again from the map, with each
part switched on or off, and the whole sea can be heard as one piece.

**Moods are different music, not the same music turned up or down** (`MOODS` in
`src/music/sea.js`). Each has its own key (the five keys are renamed for the notes
they play there: Tide Dance is D E F♯ A B), its own backing (soft drums in Tide
Dance, Golden Hour, Clockwork and Deep Water; a broken chord in Lullaby and
Starfall; the lighthouse's plain pulse in First Light), and its own resting chord
(Deep Water rests on a minor chord, Starfall on an open one). A sound or a mood
is heard when its chip is tapped, so it is chosen by ear.

**Things to find.** Ten cloaks for Kite (`CLOAKS`): one from each place, one for
waking every place, one for building every bridge, one for giving every bridge
three parts. A bridge with three parts wears a star on the map. These are earned
by what has been done; nothing is timed, scored, bought or lost.

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
| Six new sounds, one tapped voice for free play, a soft drum kit, the output ceiling | `src/audio/AudioEngine.js` |
| Backing that follows a mood's chords, key and groove | `src/audio/Arranger.js` (`setPiece`, `setScene`, `_groove`) |
| The names the five keys go by in the current key | `src/music/Theory.js` (`noteName`, `setNoteNames`) |
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
- A link opens in a new tab, so two tabs on one sea is ordinary: each tab takes up
  what the other saves (`storage` event, `mergeSeas`), and nothing either has is lost.
- An arrival can always be stepped past (the Skip button, Enter or Space).
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

### Second pass (2026-11-18): two code reviews, a research pass, other engines

Asked whether everything possible had been done, the honest answer was no. This
pass used what had been skipped: two independent code reviews, research on
children's music apps and on Safari audio, the tests run on Safari's engine and an
emulated iPad, a slowed-down processor, and measured audio.

Fixed (each has a test unless it needs a real device):

- A pause during the count-in no longer strands a crossing; cancelling "begin
  again" from the pause menu no longer leaves a pause with no menu; the pause
  menu can no longer be left standing over the map.
- Two tabs no longer overwrite each other's sea (see above).
- A key pressed while Kite walks out no longer uses up the first note unseen.
- The backing no longer plays a beat twice when the look-ahead lands exactly on
  it, and no longer sounds the waiting note before the key that starts it.
- Changing a setting mid-crossing no longer resets its tempo to the lighthouse's.
- Sound: on an iPhone or iPad the mute switch no longer silences the game where
  the browser allows (`navigator.audioSession`), sound comes back after the
  screen locks or another app takes it (every touch and key tries), and nothing
  is queued against a stopped clock. A soft ceiling at the output keeps a full mix
  from clipping (measured: three full parts, backing and frantic playing peaked
  0.4 dB over full scale before, 0.5 dB under after, with loudness unchanged).
- A surplus key in free play now plays its own note, short and soft (it was a
  shimmer an octave up).
- Notices ("Chime Rocks is awake", "Someone sent you a bridge") are now shown
  over any screen; they were hidden with the play HUD.
- Stray taps just after a screen appears are ignored (children keep tapping where
  the last screen's button was).
- Words are simpler, parts are numbered 1 2 3, the main buttons carry a small
  drawn sign, and after seven seconds idle the thing to do next glows.
- On touch devices every control is larger; the map's places and lines take a
  wider touch.
- A full shelf of friends' bridges no longer pushes the oldest out; the newcomer
  waits until one is let go. A saved sea is read more carefully, and one that
  cannot be read is set aside rather than overwritten.
- Drawing: a 3-part crossing went from 638 draw calls to 505, and a device that
  cannot keep 26 frames a second gets a lighter picture.

Left as it is, knowingly:

- From the original game, not the sea: a held lighthouse note fades after about
  1.2 s whatever its length (`o.dur ?? 1.2`); a very short flute note can click.
- A stone on the very last half-beat at fast tempo is never stood on (cosmetic).
- On a phone the map is small. A tablet or a computer suits it.
- Safari clears a site's storage after seven days of browser use without a
  visit. The game asks the browser to keep it (`navigator.storage.persist`), and
  adding the page to the Home Screen exempts it; a bridge's link is its backup.
- On iOS older than 16.4 the mute switch still silences the game.

**Checked:** 104 rule tests and 52 browser tests, the browser tests on Chrome's
engine, Safari's engine and an emulated iPad (the sea's 29 cover: first note
waits, pads and keys, no misses, waking and gifts, three stacked parts, listening,
leaving, starting over, save and reload, pause and restart, the way in from the
lighthouse, the last place and bridge, links end to end with a second browser,
swapping, letting go, junk links, two tabs, skipping, stray taps, cloaks, the
whole sea, every control on screen at six window sizes). The backing has its own
rule tests (each bar once at any tempo and frame rate; nothing early at the
gate). Levels of every sound, drum and mood were measured from offline renders,
and where each mood's beat falls was read back from its low band.
**Not checked:** how it sounds to a person (the drums and keys are written from
knowledge and measured, never heard), a real phone or tablet (touch feel, the
mute switch, the share sheet), and children actually playing it.
