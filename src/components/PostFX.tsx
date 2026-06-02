import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing';
import { isTouchDevice } from '../systems/touchInput';

// Cinematic post-processing — desktop only (touch devices keep the plain
// pipeline to protect framerate). Tuned SUBTLE on purpose so the realistic,
// sunny look is enhanced, not turned into an arcade glow:
//  • N8AO  — ambient occlusion grounds objects (contact shadows in crevices,
//            under cars, where walls meet grass) so nothing looks floaty.
//  • Bloom — only genuinely bright pixels (sun glints on chrome/glass, white
//            trim in full sun) bleed light; a high threshold keeps mid-tones flat.
//  • Vignette — a gentle edge darkening that focuses the eye on the action.
const TOUCH = isTouchDevice();

export function PostFX() {
  if (TOUCH) return null;
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO halfRes aoRadius={1.1} intensity={1.25} distanceFalloff={1.0} color="#1c2230" />
      <Bloom intensity={0.42} luminanceThreshold={0.82} luminanceSmoothing={0.3} mipmapBlur />
      <Vignette offset={0.3} darkness={0.5} eskil={false} />
    </EffectComposer>
  );
}
