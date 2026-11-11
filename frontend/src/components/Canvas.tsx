/** Canvas: the preview plus its overlays — view tabs, Tips, zoom. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../app/store';
import type { View } from '../app/store';
import { Editor2D } from './Editor2D';
import { ExportView } from './ExportView';
import { TipsDialog } from './TipsDialog';
import { ICONS, Icon, Segmented } from './ui';
import { View3D } from './View3D';
import { useZoom } from './viewport';

const LEVELS = [50, 100, 200, 400];

function ZoomCluster() {
  const pct = useZoom((s) => s.pct);
  const api = useZoom((s) => s.api);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  useEffect(() => {
    if (!open) return;
    const r = trigger.current!.getBoundingClientRect();
    setPos({ left: r.left, bottom: window.innerHeight - r.top + 4 });
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.target instanceof Node && trigger.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  return (
    <div className="gen-canvas-bottom">
      <div className="zoom-cluster" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => api?.zoomBy(1 / 1.25)}><Icon d={ICONS.minus} /></button>
        <button type="button" ref={trigger} aria-haspopup="true" aria-expanded={open} aria-label={`Zoom ${pct}%`} onClick={() => setOpen(!open)}>
          {pct}%
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => api?.zoomBy(1.25)}><Icon d={ICONS.plus} /></button>
        <button type="button" aria-label="Fit to canvas" onClick={() => api?.fit()}>
          <Icon d={ICONS.fit} />
          <span className="tooltip" aria-hidden="true">Fit to canvas</span>
        </button>
      </div>
      {open && (
        <div className="select-list zoom-menu" role="menu" aria-label="Zoom level" style={{ position: 'fixed', left: pos.left, bottom: pos.bottom }}>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className="select-option"
              role="menuitem"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                api?.zoomTo(l);
                setOpen(false);
              }}
            >
              {l}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const empty = useStore((s) => s.design.elements.length === 0);
  const [tips, setTips] = useState(false);
  return (
    <main className="gen-canvas" aria-label="Canvas">
      <div className="gen-canvas-stage">
        {view === '2d' && <Editor2D />}
        {view === '3d' && <View3D />}
        {view === 'export' && <ExportView />}
        {empty && view !== 'export' && (
          <p className="gen-canvas-hint empty-hint">Your card is blank — pick a template or add a shape, a word or a picture from the left</p>
        )}
      </div>
      <div className="gen-canvas-top">
        <Segmented<View>
          tabs
          label="View"
          value={view}
          options={[
            { value: '2d', label: '2D design' },
            { value: '3d', label: '3D preview' },
            { value: 'export', label: 'Export' },
          ]}
          onChange={setView}
        />
        <button type="button" className="btn-tips gen-tips" onClick={() => setTips(true)}>
          <svg className="icon icon-20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.5 15.5h5M8.5 17.8h3M10 2.2a5 5 0 0 1 3 9c-.6.5-.9 1.1-.9 1.8H7.9c0-.7-.3-1.3-.9-1.8a5 5 0 0 1 3-9Z" />
          </svg>
          Tips
        </button>
      </div>
      <ZoomCluster />
      <TipsDialog open={tips} onClose={() => setTips(false)} />
    </main>
  );
}
