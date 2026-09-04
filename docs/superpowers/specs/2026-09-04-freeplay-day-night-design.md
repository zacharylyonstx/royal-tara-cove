# Free Play — Realistic Day/Night Cycle (design)

**Date:** 2026-09-04 · **Scope:** Free Play mode ONLY (Zak: "this is just for the
FreePlay, doesn't need to exist in any of the other game modes"). Aliens, tornado,
munchies, treehouse and Siren Head Night keep their existing sky/lighting code
untouched.

## Goal

Royal Tara Cove in Free Play should feel like a real Austin day passing at a
fast clip: a physically-plausible sky with the sun arcing overhead, drifting
lit clouds, a golden-hour sunset, twilight, a real moon with phase, stars and
the Milky Way, then dawn — and the street should look the way a real
neighborhood looks at night: street lamps pooling light on the asphalt, porch
lights and lit windows, headlights on the cars. Time must pass fast enough that
a one-hour Zoom call always contains at least two full nights.

## Time scale (decision)

**One game hour = one real minute** → a 24-minute game day (2.5 days per hour).
Zak floated both "15 min = 6 h" (a 60-min day) and "two days at least per hour"
(≤ 30-min day) and deferred to judgment; 24 min satisfies "≥ 2 days" for any
start time in a 1-h call, sunsets are watchable (the sun moves 15°/min, golden
hour lasts about a minute), and it's a rule the kids can repeat ("every minute
is an hour"). Constant lives in one place (`DAY_LENGTH_REAL_SEC`).

Astronomy: latitude 30.3° N (Austin), solar declination +20° (late May) → sun
rises ≈ 6:30, sets ≈ 19:40, noon elevation ≈ 80°. Compass: the street stick runs
north into −Z, so east = +X, south = +Z. The sun rises over the boulevard side
(+X), crosses the southern sky (over the 10600 backyard) and sets behind the
west lots. Moon: waxing gibbous (fixed), declination −8°, hour-angle offset
≈ 150° from the sun so it rises mid-afternoon, is up most of the night and is a
faint daytime moon in the afternoon (real and pretty).

Free Play starts at **8:00 AM** game time on a fresh session. The clock is
saved to localStorage (`sky.v1`: dayFraction + wall time) so a reload within 2 h
resumes where it left off (advanced by the elapsed time).

## Architecture (all new code gated on `gameMode === 'freeplay'`)

```
world/dayNight.ts        pure math: DAY_LENGTH_REAL_SEC, sun/moon dirs from
                         dayFraction, sky palette (zenith/horizon/sun/ambient/
                         fog colours + intensities), legacy timeOfDay mapping,
                         clock label ("7:42 PM"), lamp/window schedules
state/skyStore.ts        zustand: dayFraction, netTarget, paused; DEV __sky
                         (setHour(h), setSpeed(x))
systems/DayNightController.tsx   advances the clock from wall time (host /
                         solo) or eases toward the host's value (guest);
                         mirrors legacy combatStore.timeOfDay for Fireflies/
                         SunMotes/env; persists to localStorage
components/sky/SkyDome.tsx       ONE ShaderMaterial on a camera-centred
                         BackSide sphere: Rayleigh+Mie day scattering, sun disc,
                         moon disc shaded by the sun (real phase), procedural
                         stars + twinkle + Milky Way band, FBM cloud shell lit
                         by the sun (silver lining, sunset undersides), horizon
                         haze matched to the scene fog
components/sky/SkyLighting.tsx   sun/moon directional light (single shadow
                         caster, crossfades at twilight), hemisphere + ambient
                         driven by the palette, scene fog colour/range, and
                         scene.environmentIntensity; IBL Environment re-rendered
                         on a quantised time bucket so glass/car reflections
                         track the sky
components/sky/StreetLamps.tsx + world/streetLamps.ts
                         lamp positions (property-line curb spots on the
                         stick, two on the bulb, plaza/pond/school acorn
                         posts); procedural cobra-head / acorn posts with
                         emissive lens, additive ground light pool + head
                         glow on EVERY lamp, and a small pool of real
                         pointLights (6 desktop / 3 touch) re-assigned each
                         frame to the nearest lamps (fixed light count → no
                         shader recompiles); thin pole colliders
components/sky/NightWindows.tsx  drives the 6 shared window-glass materials
                         (mat.glassFor buckets) through a lights-on schedule
                         (dusk on, staggered bedtimes, one bucket stays lit,
                         two never light) — emissiveMap swaps to the warm
                         room texture; also drives the shared lamp-lens
                         material used by coach lights / hero porch lights /
                         string lights, plus a real porch pointLight at 10600
components/sky/VehicleLights.tsx headlight + taillight emissives on driven
                         cars/bikes, and a forward spotLight for the LOCAL
                         driver at night
ui/DayClock.tsx          small HUD pill "🌇 7:42 PM" (Free Play only)
```

Game.tsx: `FreeplayModeSystems` mounts all of the above. The existing
`DynamicSky`, `DynamicLights`, `SceneFog`, `Stars` and drei `SkyClouds` return
null in freeplay (they keep their code paths for the other modes).

Net: `WorldStateMsg.clock?: number` (host's dayFraction, freeplay only, sent in
the existing 10 Hz snapshot). Guests ease toward it (snap if > 0.02 apart).
Phase value, not an absolute clock → immune to machine clock skew.

## Lighting targets (tuned live, these are the starting points)

| state            | sun/moon dir light      | hemi | ambient | fog (near/far) | env |
|------------------|-------------------------|------|---------|----------------|-----|
| noon             | 1.6 #fff3e0             | 0.95 | 0.45    | 70 / 330       | .62 |
| golden hour (5°) | 1.0 #ffb070             | 0.55 | 0.32    | 60 / 260       | .40 |
| civil dusk (−4°) | 0.15 #ff8a5a → moon     | 0.25 | 0.20    | 45 / 220       | .12 |
| night (moon up)  | 0.28 #8fa8ff (moon)     | 0.14 | 0.12    | 40 / 210       | .06 |

Night stays *playable* (kids must see where they walk): street lamps carry the
street, porch/window light carries the yards, moonlight + a blue ambient floor
carries the greenbelt. PostFX bloom threshold drops slightly at night so lamps
and windows bloom.

## Performance

- Sky shader: 5 FBM octaves desktop / 3 touch; Milky Way + twinkle desktop
  only. One draw call, depthWrite off, drawn first.
- Lamp lights: fixed pool (6/3) → constant light count. Light pools/glows are
  additive quads (no lights).
- Environment IBL re-renders at most every 30 s of real time (key bucket).
- No per-frame React re-renders: everything mutates refs/uniforms in useFrame;
  the HUD clock updates once per real second.

## Out of scope / kept

Other modes' skies, audio changes, weather (rain) in Free Play, NPC schedules.
Meshy assets not needed — lamps/moon/clouds are procedural (a static mesh can't
carry a moving sky, and lamp posts are trivial geometry).

## Verification

`npm run build` + `npm run lint` clean, then a headed Playwright walkthrough of
Free Play (enter via the real card → claim DAD): drive `__sky.setHour()` through
06:00 / 09:00 / 12:00 / 17:00 / 19:30 / 20:15 / 23:00 / 03:00 and screenshot the
street from the cul-de-sac, the stick, the boulevard and inside 10600, plus a
2-tab P2P check that a guest's clock follows the host. Confirm the other five
modes boot with their old skies. Then push to main (Netlify auto-deploy) and
confirm the live bundle hash.

## Status (2026-09-04)

SHIPPED as designed, with these tuning decisions made during the live
walkthrough (all verified by screenshot in headed Playwright):

- **Colour space:** palette hex values are decoded sRGB → linear before they
  reach lights/fog/uniforms (`hex()` in dayNight.ts); the shader's constants
  are linear. Without this the night sky rendered as grey fog.
- **Day sky = hybrid:** the Preetham/three.js scattering model (ACES tone-mapped
  at 0.62 exposure) owns sunrise/sunset; above ~16° sun elevation it
  cross-fades to a designed zenith→horizon gradient from the palette plus a
  warm sun halo, because the raw model reads grey/white at high sun.
- **Clock:** solar noon at 1:00 PM (daylight-saving), sunrise ≈ 6:10 AM,
  sunset ≈ 7:50 PM; Free Play starts at 8:00 AM.
- **Lamps come on** at sun elevation < 3.5° (a real dusk-on feel); window
  schedule per glass bucket in `windowLightAmount`.
- DEV levers: `__sky.getState().setHour(h)`, `__sky.setState({ speed, cloudOverride })`.
- Verified: P2P guest clock follows host (2-tab), other five modes boot with
  their original sky code and no dome, sky shader adds no measurable frame
  time (A/B with the dome hidden).
