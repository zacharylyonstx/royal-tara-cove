# Free Play — Siren Head After Dark (design)

**Date:** 2026-09-07 · **Scope:** Free Play only. Siren Head Night (the lantern
mode) is untouched; this reuses its model, AI patterns, audio and net messages.

## Research recap (Trevor Henderson canon → what we keep)

- **Look:** ~12 m, emaciated near-skeletal humanoid, mummified skin the colour
  of rusted metal, arms as long as legs ending in huge bony hands, no head —
  two rusted air-raid sirens back-to-back on a neck pole. Ours already exists
  procedurally (`components/horror/SirenHead.tsx`): hunched, asymmetric,
  claw hands, owl-swivel horns, pulsing red throat glow, stop-motion lurch.
- **Sound:** the sirens play air-raid wails, garbled radio/emergency-broadcast
  static and mimicked voices to lure people; his own movement is near-silent.
  We have: a detuned wailing siren loop with a slow sweep, radio static bursts,
  a lock-on whoop, an "it sees you" stinger, a horror bed with a chase layer,
  heartbeat, comedic BONK. New: a low ground-thud on each step when close.
- **Behaviour:** stands still among trees, lurks, then moves impossibly fast
  when it commits. Ours: slow patrol with "listening" pauses, a dread beat
  when he spots you, then a lunge.
- **The kids' anthem:** Horror Skunx — "Run Away". The mode's whole loop is
  literally "run away… get inside".
- **Kid-safety (kept from Siren Head Night):** no face, teeth or gore; caught =
  a giant comedic swat that launches you across the block, never death; you
  always land safely and keep playing.

Sources: Trevor Henderson wiki entries (Villains Wiki, Trevor Henderson Wiki),
Siren Head sound-design references, the Horror Skunx song.

## What the kids experience

1. It's Free Play. Dusk falls (the day/night cycle). About 8 PM game time a long
   distant siren wail rolls down the street. A toast: **"🚨 Siren Head is out
   there… get inside a house!"** The street lamps near him flicker.
2. He walks in from the dark end of the street, slowly, red glow first. He
   roams the whole neighbourhood all night (about 10 real minutes), pausing
   to "listen", sometimes drifting toward wherever the family is.
3. If you're **outdoors** and he sees you, he stops, horns snap to you (dread
   beat + whoop), then lunges. Walking can't outrun him; **running can**, and
   any house, the playhouse, the school or the shops is total safety. Inside
   = invisible to him and he can't enter.
4. If he catches you: **BONK** + a tornado-style yeet. First-person tumble,
   whoosh, a comedic scream, thrown ~45 m across the block, land on your feet,
   still alive, still playing. Cars: the driver gets swatted out of the car.
5. He then loses interest for a while (20–40 s) — "every once in a while", not
   a relentless hunt. Dawn (about 6 AM): he turns and walks back into the dark
   and is gone. Toast: **"☀️ Siren Head went back into the woods."**

## Architecture

```
state/nightStore.ts      + stalkerActive (synced), stalkerSince (local)
world/indoors.ts         isIndoors(x, z): every house footprint (lots +
                         houseTransform), 10600 playhouse, school, shop wings
world/stalkerLayout.ts   STALKER_BOUNDS (whole street), arrival point, tuning
systems/StalkerController.tsx  (Free Play only)
   host sim: activate/deactivate from the sun elevation; arrive → roam →
   (alerted → chase → swat) → roam; leave at dawn. Mirrors
   SirenHeadController's detection (radius + running noise + LOS through
   tall colliders) but: indoors = undetectable + uncatchable; global hunt
   cooldown after every swat/failed chase; victim dismounts vehicles;
   swat = bumpSirenSwing + bonk + startRagdoll (local) / sirenCaught (net).
   local pass (all clients): siren loop volume by proximity, horror bed +
   chase layer, static bursts, heartbeat, per-step ground thud + shake,
   music ducking, toasts.
systems/RagdollController.tsx  + freeplay branch: same tumble cinematic as
   night, bigger (3.4 s, peak 22 m, 46 m), whoosh + scream, landing point
   validated against colliders and the drivable region
components/horror/SirenHead.tsx  render gate: night OR (freeplay && active)
components/sky/StreetLamps.tsx   lamps within ~22 m of him flicker
ui/StalkerToast.tsx              arrival / swatted / dawn toasts
systems/CameraRig.tsx            honor the local swat cinematic in freeplay
systems/PlayerController.tsx     skip input/physics while my ragdoll is active
                                 (freeplay); publish localRunning in freeplay
systems/NetSyncController.tsx + net/room.ts   night snapshot also sent in
   freeplay while active; carries stalkerActive; sirenCaught works as-is
systems/MusicController.tsx      duck the neighbourhood music while he's out
```

Host-authoritative like everything else; guests render from the snapshot and
run their own local audio/toss.

## Tuning (start values, tuned in the live walkthrough)

| thing | value |
|---|---|
| active window | sun elevation < −7° (≈ 8:05 PM → 5:55 AM) |
| arrival | walks in from (0, −168); first hunt allowed 20 s after arrival |
| patrol speed / chase speed | 2.0 m/s / 6.8 m/s (walk 5.5, run 10) |
| detect radius | 20 m (+7 running), LOS through tall colliders only |
| dread beat | 1.0 s, then chase; give up after 3 s without LOS or target indoors |
| catch radius | 2.3 m; swat cooldown 20–40 s; victim immune 15 s |
| toss | 3.4 s, peak 22 m, 46 m away from him, landing validated |
| audio reach | siren loop audible from ~55 m, heartbeat inside 16 m, thud inside 30 m |

## Verification

Build + lint clean. Headed Playwright: enter Free Play, `__sky.setHour(21)`,
confirm he appears at the street end and walks in (screenshots from the bulb
and the stick), force a catch (stand outdoors in his path with isHost true),
confirm the toss arc peaks ~22 m and lands on a free spot, confirm indoors is
safe (stand in 10600, he ignores you), confirm dawn removes him, other modes
and Siren Head Night still boot, 2-tab guest sees him and gets tossed.

## Status (2026-09-07)

SHIPPED. Verified in headed Playwright (isolated dev room via `?room=`):
arrival at 9 PM from (0, −168) walking in at 2 m/s; alert → chase → swat on an
outdoor player; toss peaks 22 m and lands ~45 m away on a free street spot;
indoors (10600 great room) is ignored; guest (2-tab) sees him, gets swatted and
tossed on its own client; dawn at 6:30 walks him out and clears the flag;
Siren Head Night, Aliens and Tornado boot unchanged. Added along the way: a
far-visible pulsing red beacon in each horn, per-step ground thud + shake,
lamp flicker near him, and a DEV-only `?room=` suffix so automated playtests
never join the kids' live Free Play room.
