import { Canvas } from '@react-three/fiber';
import { Game } from './components/Game';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { CharacterSelect } from './ui/CharacterSelect';
import { RoomBadge } from './ui/RoomBadge';
import { ControlsHud } from './ui/ControlsHud';
import { CharacterIndicator } from './ui/CharacterIndicator';
import { InteractPrompt } from './ui/InteractPrompt';
import { CombatHud } from './ui/CombatHud';
import { Crosshair } from './ui/Crosshair';
import { DamageFlash } from './ui/DamageFlash';
import { VictoryScreen } from './ui/VictoryScreen';
import { DefeatScreen } from './ui/DefeatScreen';
import { Dialogue } from './ui/Dialogue';
import { MiniMap } from './ui/MiniMap';
import { WaveBanner } from './ui/WaveBanner';
import { EnemyArrow } from './ui/EnemyArrow';
import { ComboHud } from './ui/ComboHud';
import { PowerUpHud } from './ui/PowerUpHud';
import { FloatingNumbers } from './ui/FloatingNumbers';
import { TornadoHud } from './ui/TornadoHud';
import { StormVignette } from './ui/StormVignette';

export default function App() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 8, -100], fov: 80, near: 0.1, far: 600 }}
        shadows
        style={{ width: '100vw', height: '100vh', display: 'block' }}
      >
        <Game />
      </Canvas>
      <CharacterIndicator />
      <ControlsHud />
      <InteractPrompt />
      <CombatHud />
      <Crosshair />
      <DamageFlash />
      <Dialogue />
      <MiniMap />
      <WaveBanner />
      <EnemyArrow />
      <ComboHud />
      <PowerUpHud />
      <FloatingNumbers />
      <TornadoHud />
      <StormVignette />
      <WelcomeScreen />
      <CharacterSelect />
      <RoomBadge />
      <VictoryScreen />
      <DefeatScreen />
    </>
  );
}
