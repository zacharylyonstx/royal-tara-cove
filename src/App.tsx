import { Canvas } from '@react-three/fiber';
import { Game } from './components/Game';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { ControlsHud } from './ui/ControlsHud';
import { CharacterIndicator } from './ui/CharacterIndicator';

export default function App() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 7, 30], fov: 55 }}
        shadows
        style={{ width: '100vw', height: '100vh', display: 'block' }}
      >
        <Game />
      </Canvas>
      <CharacterIndicator />
      <ControlsHud />
      <WelcomeScreen />
    </>
  );
}
