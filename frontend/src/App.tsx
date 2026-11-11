import { useEffect } from 'react';
import { useStore } from './app/store';
import { TEMPLATES } from './app/templates';
import { Canvas } from './components/Canvas';
import { LeadRail } from './components/LeadRail';
import { ParamsRail } from './components/ParamsRail';

let seeded = false;

export default function App() {
  // First visit: start from a finished scene rather than a blank sheet.
  useEffect(() => {
    if (seeded) return;
    seeded = true;
    let fresh = true;
    try {
      fresh = !localStorage.getItem('popup-card-design-v1');
    } catch {
      /* storage unavailable */
    }
    if (fresh && useStore.getState().design.elements.length === 0) {
      useStore.setState({ design: TEMPLATES[0].build() });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (e.shiftKey) useStore.getState().redo();
      else useStore.getState().undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="gen-app">
      <div className="gen-body">
        <LeadRail />
        <Canvas />
        <ParamsRail />
      </div>
    </div>
  );
}
