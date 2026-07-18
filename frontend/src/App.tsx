import { Scene } from './components/three/Scene';
import { FlatPatternView } from './components/FlatPatternView';
import { CardControls } from './components/CardControls';
import { MechanismPanel } from './components/MechanismPanel';
import { useCardStore } from './state/store';
import './App.css';

export default function App() {
  const openAngleDeg = useCardStore((s) => s.openAngleDeg);
  const setOpenAngleDeg = useCardStore((s) => s.setOpenAngleDeg);

  return (
    <div className="app">
      <div className="pane pane-3d">
        <Scene />
        <div className="left-panels">
          <CardControls />
          <MechanismPanel />
        </div>
        <div className="angle-control">
          <label htmlFor="open-angle">
            Opening angle: <strong>{openAngleDeg}°</strong>
          </label>
          <input
            id="open-angle"
            type="range"
            min={0}
            max={180}
            step={1}
            value={openAngleDeg}
            onChange={(e) => setOpenAngleDeg(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="pane pane-2d">
        <FlatPatternView />
      </div>
    </div>
  );
}
