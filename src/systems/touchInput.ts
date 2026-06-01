// Shared virtual-input state for the on-screen touch controls (TouchControls).
// A plain mutable singleton — NOT a zustand store — so the touch overlay can
// write to it and PlayerController can read it in the useFrame hot path without
// triggering any React re-renders. PlayerController folds these values into the
// same key map + edge refs the keyboard drives, so touch works across every
// movement path (walk / munchies / treehouse / bike) with no extra plumbing.
export const touchInput = {
  /** True while the joystick is being dragged. */
  active: false,
  /** Joystick vector, each component in [-1, 1]. +x = screen right, +y = down. */
  moveX: 0,
  moveY: 0,
  /** Edge-triggered button taps; consumed (set false) by PlayerController. */
  jumpQueued: false,
  actionQueued: false,
};

/** Push the stick past this fraction of its travel to run. */
export const TOUCH_RUN_THRESHOLD = 0.92;
/** Axis deadzone before a direction key is considered pressed. */
export const TOUCH_DIR_THRESHOLD = 0.35;

/** True on primarily-touch devices (iPad/phone). Used to show the on-screen
 *  controls and hide the keyboard-only hint legend. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return coarse || 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
}
