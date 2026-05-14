import { Canvas } from '@react-three/fiber';
import { Game } from './components/Game';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { ControlsHud } from './ui/ControlsHud';
import { CharacterIndicator } from './ui/CharacterIndicator';
import { InteractPrompt } from './ui/InteractPrompt';

export default function App() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 8, -100], fov: 55, near: 0.1, far: 600 }}
        shadows
        style={{ width: '100vw', height: '100vh', display: 'block' }}
      >
        <Game />
      </Canvas>
      <CharacterIndicator />
      <ControlsHud />
      <InteractPrompt />
      <WelcomeScreen />
    </>
  );
}
