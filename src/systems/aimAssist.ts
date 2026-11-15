// Camera aim-assist hand-off (Alien Invasion). CombatController decides where
// the hero ought to be looking while the trigger is held; CameraRig — which
// owns the look direction — eases the view there. A plain mutable singleton,
// read and written in the frame loop (no React re-renders).
//
// (The old "passive aim assist" turned the BODY yaw, which the camera then
// overwrote on the very next line of the frame — so it never did anything.)
export const aimAssist = {
  active: false,
  /** Yaw to ease toward (same convention as the camera: 0 faces −Z). */
  yaw: 0,
  /** Fraction of the gap closed per second (0 = leave the player alone). */
  rate: 0,
};
