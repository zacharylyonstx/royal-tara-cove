import { EffectComposer, N8AO, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { isTouchDevice } from '../systems/touchInput';
import { useGameStore } from '../state/gameStore';

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
  const horror = useGameStore((s) => s.gameMode) === 'night';
  if (TOUCH) return null;
  // Night: deeper crevice AO + a heavy vignette + light film grain crush the
  // frame into a tense, focused look; the high bloom threshold lets only the
  // flashlight/lanterns/siren glow bleed. (Build as an array so the optional
  // grain effect is a clean conditional child.)
  const effects = [
    <N8AO key="ao" halfRes aoRadius={1.1} intensity={horror ? 2.1 : 1.25} distanceFalloff={1.0} color="#0c1018" />,
    <Bloom key="bloom" intensity={horror ? 0.5 : 0.42} luminanceThreshold={horror ? 0.7 : 0.82} luminanceSmoothing={0.3} mipmapBlur />,
    <Vignette key="vig" offset={horror ? 0.18 : 0.3} darkness={horror ? 0.82 : 0.5} eskil={false} />,
  ];
  if (horror) effects.push(<Noise key="noise" opacity={0.05} premultiply />);
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  );
}
