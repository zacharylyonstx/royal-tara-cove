import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNightStore } from '../../state/nightStore';
import { isTouchDevice } from '../../systems/touchInput';

const TOUCH = isTouchDevice();

// A flashlight cone that follows the camera. It lives in the SCENE graph (not
// parented to the camera — a light on the R3F camera isn't in the scene, so it
// would illuminate nothing) and each frame copies the camera's world position +
// look direction. Desktop-only (a moving shadow-spot would tank mobile FPS; on
// touch the DynamicLights night floor is lifted instead). Reads
// nightStore.flashlightOn for the toggle, with a faint hand-held flicker.
export function Flashlight() {
  const { camera } = useThree();
  const spotRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const spot = spotRef.current;
    if (!spot) return;
    const on = useNightStore.getState().flashlightOn;
    spot.visible = on;
    if (!on) return;
    spot.position.copy(camera.position);
    camera.getWorldDirection(dir);
    target.position.copy(camera.position).addScaledVector(dir, 12);
    const t = state.clock.elapsedTime;
    spot.intensity = 9 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 19.1) * 0.12;
  });

  if (TOUCH) return null;
  return (
    <>
      <spotLight
        ref={spotRef}
        color="#eaf2ff"
        intensity={9}
        angle={Math.PI / 8}
        penumbra={0.45}
        decay={1.3}
        distance={38}
        castShadow={false}
        target={target}
      />
      <primitive object={target} />
    </>
  );
}
