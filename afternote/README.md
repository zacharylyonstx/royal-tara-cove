# Afternote (inside Royal Tara Cove)

A copy of the finished game AFTERNOTE (its own repository lives elsewhere), served
as its own page at `/afternote/` and opened from the Royal Tara Cove game menu.

- `src/` started as that game's `src/` with three differences: `three` is
  imported as `three-afternote` (the three.js version the game was built and
  tuned on, installed side by side with Royal Tara Cove's), the title screen has
  a link back to the menu, and `styles.css` has that link's style at the end.
- It is plain JavaScript on purpose: it is not part of the TypeScript build or
  the lint run. Its tests and tools stay in its own repository.
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

Checked against the original's own tests run on this copy: 65 rule tests and 22
browser tests pass.
