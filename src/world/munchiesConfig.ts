// Tuning constants for Midnight Munchies. Single source so a designer can
// tweak speeds/scoring without hunting through the codebase.

export const MAX_LEVEL = 3;
export const STARTING_LIVES = 3;

// Movement
export const MUNCHIES_PLAYER_SPEED = 4.2;            // m/s
export const SLEEPWALKER_BASE_SPEED = 2.4;           // m/s on level 1
export const SLEEPWALKER_SPEED_PER_LEVEL = 0.35;     // added per level
export const POWERED_SPEED_MULT = 0.5;               // multiplier while powered

// Timers (seconds)
export const POWERED_DURATION_S = 8.0;
export const TUCK_RESPAWN_S = 5.0;
export const CAUGHT_CINEMATIC_S = 2.5;
export const INTRO_AUTO_DISMISS_S = 6.0;             // dismisses if no input
export const LEVEL_CLEAR_BANNER_S = 2.0;

// Pickups
export const PELLET_PICKUP_RADIUS = 0.45;
export const MILK_PICKUP_RADIUS = 0.55;
export const BONUS_PICKUP_RADIUS = 0.6;
export const BONUS_DESPAWN_S = 8.0;
export const BONUS_FIRST_SPAWN_FRAC = 0.70;          // remaining pellets / total
export const BONUS_SECOND_SPAWN_FRAC = 0.30;

// Catch detection
export const CATCH_RADIUS = 0.6;

// Spawn
export const PLAYER_SPAWN: [number, number] = [-5.0, -3.0];   // great room couch area

// Scoring
export const COOKIE_POINTS = 10;
export const MILK_POINTS = 50;
export const BONUS_POINTS = 500;
export const TUCK_POINTS_BASE = 200;
export const TUCK_POINTS_COMBO_MULT = 2;             // doubles per tuck-in within a single powered window
