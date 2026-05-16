import * as THREE from 'three';

// Singleton HTMLVideoElement + Three.js VideoTexture for the hero house projector.
// One instance shared across the whole app: the screen mesh, the audio
// controller, and any future consumers all read from the same playback state.
//
// The element is NOT mounted in the DOM. VideoTexture reads frames from a
// detached <video> just fine, and detaching keeps the element invisible to
// any browser UI (no PiP / context menu surprises).
//
// Autoplay rules:
//   - muted + autoplay + playsInline → allowed by every modern browser
//   - sound requires a user gesture → unmuted by unmuteProjector(), called
//     from audio.ts::unlockAudio() on the player's first interaction

const VIDEO_URL = '/luke.mov';

let videoEl: HTMLVideoElement | null = null;
let texture: THREE.VideoTexture | null = null;

function ensure(): { video: HTMLVideoElement; texture: THREE.VideoTexture } {
  if (videoEl && texture) return { video: videoEl, texture };
  const v = document.createElement('video');
  v.src = VIDEO_URL;
  v.loop = true;
  v.muted = true;
  v.autoplay = true;
  v.playsInline = true;
  v.crossOrigin = 'anonymous';
  v.volume = 0;
  // Fire-and-forget; browsers reject the Promise if autoplay is blocked
  // even with muted=true (rare). The first unmuteProjector() call retries.
  v.play().catch(() => {});

  const t = new THREE.VideoTexture(v);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;

  videoEl = v;
  texture = t;
  return { video: v, texture: t };
}

export function getProjectorVideo(): HTMLVideoElement {
  return ensure().video;
}

export function getProjectorTexture(): THREE.VideoTexture {
  return ensure().texture;
}

/** Called from a user-gesture handler. Lets the video produce audio. */
export function unmuteProjector(): void {
  const { video } = ensure();
  video.muted = false;
  // Volume stays where the controller set it; if it's currently 0, audio
  // stays inaudible until the controller raises it (e.g. player walks in).
  // Retry play() in case autoplay was blocked at construction.
  video.play().catch(() => {});
}
