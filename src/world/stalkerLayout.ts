/**
 * Siren Head after dark (Free Play) — tuning + layout. Pure data.
 * World frame: cul-de-sac bulb at the origin, the street stick runs north
 * into −Z to the boulevard at ≈ −183.
 */

/** He is out while the sun is below this elevation (≈ 8:05 PM → 5:55 AM). */
export const STALKER_ACTIVE_BELOW_EL = -7;

/** Where he walks in from (and back out to) — the dark end of the street. */
export const STALKER_ARRIVAL = { x: 0, z: -168 };

/** Where he roams: the whole street, bulb to boulevard. */
export const STALKER_BOUNDS = { minX: -22, maxX: 22, minZ: -172, maxZ: 8 };

export const STALKER_PATROL_SPEED = 2.0;   // slow, deliberate lurch
export const STALKER_CHASE_SPEED = 6.8;    // walk 5.5 can't escape; run 10 can
export const STALKER_LUNGE_MULT = 1.25;    // close-range pounce
export const STALKER_DETECT_RADIUS = 20;
export const STALKER_RUN_NOISE = 7;        // running is loud
export const STALKER_CATCH_RADIUS = 2.3;
export const STALKER_WINDUP_RANGE = 3.8;   // raises the claw here
export const STALKER_ALERT_PAUSE = 1.0;    // dread beat before he commits
export const STALKER_LOS_BREAK = 3.0;      // gives up after this long without seeing you
export const STALKER_FIRST_HUNT_DELAY = 20; // he arrives in peace… for a bit
export const STALKER_COOLDOWN_MIN = 20;    // after a swat: leave the family alone a while
export const STALKER_COOLDOWN_MAX = 40;
export const STALKER_FAIL_COOLDOWN = 10;   // after losing you
export const STALKER_IMMUNE_SECS = 15;     // a swatted kid can't be re-swatted right away
export const STALKER_LISTEN_MIN = 2;       // "listening" pauses between waypoints
export const STALKER_LISTEN_MAX = 4.5;

/** Toss (tornado-style yeet, but you land on your feet and keep playing). */
export const STALKER_TOSS_DURATION = 3.4;
export const STALKER_TOSS_PEAK = 22;
export const STALKER_TOSS_DIST = 46;
export const STALKER_TOSS_MIN_DIST = 10;

/** Audio reach (metres). */
export const STALKER_HEAR_RADIUS = 55;
export const STALKER_HEARTBEAT_RADIUS = 16;
export const STALKER_THUD_RADIUS = 30;
export const STALKER_LAMP_FLICKER_RADIUS = 22;
