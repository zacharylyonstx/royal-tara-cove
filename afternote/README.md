# Afternote (inside Royal Tara Cove)

A copy of the finished game AFTERNOTE (its own repository lives elsewhere), served
as its own page at `/afternote/` and opened from the Royal Tara Cove game menu.

- `src/` is that game's `src/` unchanged, apart from three things: `three` is
  imported as `three-afternote` (the three.js version the game was built and
  tuned on, installed side by side with Royal Tara Cove's), the title screen has
  a link back to the menu, and `styles.css` has that link's style at the end.
- It is plain JavaScript on purpose: it is not part of the TypeScript build or
  the lint run. Its tests and tools stay in its own repository.
- `?test=1` (manual clock, audio off) and `window.render_game_to_text()` work
  here as they do there.
