# Royal Tara Cove

A browser-based 3D neighborhood game built for **Penny (8)** and **Luke (6)**, set in
a stylized recreation of the family's old street in Avery Ranch, Austin, TX.

Designed to be played together over a Zoom screen-share: Dad runs the game, the
kids direct him through the neighborhood and pick which character to play as
(`1` / `2` / `3`).

> This started as a small one-hour weekend project and is intentionally
> structured to grow — single-player today, but the architecture is set up so
> we can add multiplayer, voice chat, persistent state, mini-games, and more
> over time.

## Run it

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5173/ (or whatever port Vite reports).

## Controls

| Key | Action |
| --- | ------ |
| `1` / `2` / `3` | Switch active character (Dad / Penny / Luke) |
| `W A S D` or arrow keys | Walk |
| `Shift` (held) | Run |
| `Space` | Jump |
| Mouse drag | Orbit camera around the active character |
| Scroll | Zoom in/out |

## How the world is built

Houses are **data-driven**. Each address on the cove is a single entry in
[`src/world/houses.ts`](src/world/houses.ts) — story count, exterior color,
stone accent, roof color, garage side, door color. Tweak any field and the
geometry rebuilds. That's the whole point: as we remember more about each real
house, we update the config and the game gets more accurate.

Layout: 10 houses ringed around a cul-de-sac bulb at math angles
315°, 345°, 15°, 45°, 75°, 105°, 135°, 165°, 195°, 225° (60° gap centered on
south for the entry road). [`streetLayout.ts`](src/world/streetLayout.ts)
defines all the radii, gap angles, and helper functions.

### Currently modeled

| Address | Stories | Verified? |
| ------- | ------- | --------- |
| 10601 | 2 | ✅ verified (3BR/2.5BA, 2297 sqft) |
| 10605 | 1 | ✅ verified (1697 sqft, 2004, brick + Hardiplank) |
| 10609 | 1 | inferred |
| 10613 | 2 | inferred |
| 10617 | 1 | inferred |
| 10621 | 2 | inferred |
| 10625 | 1 | ✅ verified (1594 sqft, 2005, frame + stone) |
| 10629 | 2 | inferred |
| 10633 | 1 | partial (1786 sqft) |
| 10637 | 2 | partial |

The "inferred" houses use plausible Avery Ranch tract defaults. **Correct any
of them as we remember more** — change one line in `houses.ts` and the
neighborhood updates.

## Project structure

```
src/
├── App.tsx                      # Top-level <Canvas> + UI overlays
├── main.tsx                     # React entry
├── index.css                    # Global styles
├── types.ts                     # Shared types (HouseConfig, CharacterDef, …)
├── world/
│   ├── streetLayout.ts          # Cul-de-sac geometry constants + helpers
│   ├── houses.ts                # 🏡  House configs (edit me to tweak the cove)
│   └── characters.ts            # Dad / Penny / Luke definitions
├── state/
│   └── gameStore.ts             # Zustand store (active char, positions, yaws)
├── components/
│   ├── Game.tsx                 # 3D scene composition
│   ├── Street.tsx               # Cul-de-sac pavement, sidewalks, entry road
│   ├── House.tsx                # Walls (with cutouts), roof, doors, windows
│   ├── Yard.tsx                 # Front lawn, driveway, walkway, backyard, fences
│   ├── Roof.tsx                 # Gable roof via extruded triangle
│   ├── Fence.tsx
│   ├── Gate.tsx
│   ├── Tree.tsx
│   ├── Mailbox.tsx
│   └── Character.tsx            # Player avatar mesh
├── systems/
│   ├── PlayerController.tsx     # Keyboard input → position/yaw mutations
│   └── CameraRig.tsx            # OrbitControls follow camera
└── ui/
    ├── WelcomeScreen.tsx        # Modal greeting Penny + Luke
    ├── ControlsHud.tsx          # Bottom-left controls hint
    └── CharacterIndicator.tsx   # Top-right "Playing as …" badge
```

## Roadmap

Things to add as the game grows. Loosely ordered by what would be most fun for
the kids next:

### Near-term
- **Better house fidelity.** Walk the street on Google Street View and correct
  the colors / story counts in `houses.ts` for each address.
- **Furnished interiors.** A couch, a bed, a TV — start with a single shared
  interior template, then per-house variations.
- **Animations.** Idle bob, walking arm-swing, jump anticipation. A simple
  `useFrame` hook on each character does the trick.
- **Real collision.** Walls block the player, with door triggers. Right now you
  can walk through walls — fine for v1 but eventually we want it to feel solid.
- **Animated doors + gates.** Press `E` near a door to open it (currently
  doors are just slightly ajar visually).

### Mid-term
- **Multiplayer.** Two paths:
  1. WebRTC peer-to-peer via something like PeerJS — each kid runs the game on
     their own browser tab and they connect. Lowest infra.
  2. Tiny WebSocket server (Node + `ws`) for authoritative state. Slightly more
     work but enables persistence and more players.
- **Voice chat.** Once multiplayer exists, integrate WebRTC audio so we can
  talk through the game instead of relying on Zoom.
- **Avatars.** Let each kid pick a hat, shirt color, hair, etc.
- **Mini-games inside houses.** Hide-and-seek, treasure hunts, drawing on a
  shared chalkboard.

### Long-term
- **Persistent world state.** Backend (Supabase or similar) so changes the
  kids make to the world (flowers planted, items placed) stick between
  sessions.
- **Mobile/tablet support.** Touch controls (virtual joystick).
- **Vehicle / bike.** Roblox-style — pick up a bike from the driveway and
  ride around the cove.
- **Day/night cycle and weather.** Sunset, rain, snow.
- **Neighbors.** NPC characters that wave, greet by name, give little quests.
- **Expand the map.** Connect the cove to the rest of Avery Ranch — the lake,
  the playground, the trail.

## Stack

- **Vite 8** — dev server + build
- **React 19** — UI + 3D scene composition
- **TypeScript** — type safety
- **Three.js 0.184** — WebGL rendering
- **@react-three/fiber 9** — Three.js as React components
- **@react-three/drei 10** — Sky, OrbitControls, Text helpers
- **Zustand** — minimal global state for active character + UI flags
