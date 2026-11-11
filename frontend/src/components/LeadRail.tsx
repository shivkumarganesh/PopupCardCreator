/** Tool rail (64px) + the panel that follows the selected tool (320px). */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Traced } from '../core/trace';
import { SHAPES } from '../app/shapes';
import { FONTS, traceCanvas, traceImage, traceShape, traceText } from '../app/sources';
import { useStore } from '../app/store';
import { TEMPLATES, blankDesign } from '../app/templates';
import type { Design } from '../core/types';
import { elementWidth } from '../core/build';
import { ICONS, Icon, SelectRow, SliderRow, SwitchRow, toast } from './ui';
import { regionPath } from './viewport';

type Tool = 'templates' | 'shapes' | 'text' | 'image' | 'draw';
const TOOLS: { id: Tool; label: string; icon: string; title: string }[] = [
  { id: 'templates', label: 'Templates', icon: ICONS.templates, title: 'Templates' },
  { id: 'shapes', label: 'Shapes', icon: ICONS.shapes, title: 'Shapes' },
  { id: 'text', label: 'Text', icon: ICONS.text, title: 'Text & emoji' },
  { id: 'image', label: 'Image', icon: ICONS.image, title: 'Your image' },
  { id: 'draw', label: 'Draw', icon: ICONS.draw, title: 'Draw a shape' },
];

/** Silhouette thumbnail in outline space. */
function Silhouette({ t, color = 'currentColor' }: { t: Traced; color?: string }) {
  const pad = 0.04;
  const size = Math.max(1, t.aspect);
  return (
    <svg viewBox={`${-(size - t.aspect) / 2 - pad} ${-1 - (size - 1) / 2 - pad} ${size + 2 * pad} ${size + 2 * pad}`}>
      <path d={regionPath(t.outline)} fill={color} fillRule="evenodd" />
    </svg>
  );
}

/** Front view of a whole scene, for template cards. */
function ScenePreview({ design }: { design: Design }) {
  const { widthMm: W, panelMm: P } = design.card;
  const els = [...design.elements].sort((a, b) => a.depthMm - b.depthMm);
  return (
    <svg viewBox={`-6 ${-P * 0.82} ${W + 12} ${P * 0.82 + 20}`}>
      <rect x={0} y={-P * 0.78} width={W} height={P * 0.78} fill={design.card.backing ? design.card.backingColor : design.card.color} rx={1.5} />
      <rect x={0} y={0} width={W} height={12} fill={design.card.color} stroke="var(--color-stroke-default)" strokeWidth={0.5} />
      {els.map((e) => (
        <path
          key={e.id}
          transform={`translate(${e.xMm - elementWidth(e) / 2} ${2 + e.depthMm * 0.1}) scale(${e.heightMm})`}
          d={regionPath(e.outline)}
          fillRule="evenodd"
          fill={e.mode === 'glued' ? e.color : design.card.color}
          stroke="var(--color-stroke-strong)"
          strokeWidth={0.4 / e.heightMm}
        />
      ))}
    </svg>
  );
}

function TemplatesPanel() {
  const load = useStore((s) => s.load);
  const built = useMemo(() => TEMPLATES.map((t) => ({ ...t, design: t.build() })), []);
  return (
    <div className="gen-rail-scroll">
      <div className="thumb-grid">
        {built.map((t) => (
          <button
            key={t.id}
            type="button"
            className="thumb"
            onClick={() => {
              load(t.build());
              toast(`Loaded “${t.name}” — everything in it can be moved, resized or replaced`);
            }}
          >
            <span className="thumb-card">
              <ScenePreview design={t.design} />
            </span>
            <span className="thumb-label">{t.name}</span>
          </button>
        ))}
        <button type="button" className="thumb" onClick={() => load(blankDesign())}>
          <span className="thumb-card">
            <ScenePreview design={blankDesign()} />
          </span>
          <span className="thumb-label">Blank card</span>
        </button>
      </div>
      <p className="field-note">Pick a scene to start from, then swap in your own shapes, words and pictures.</p>
    </div>
  );
}

function ShapesPanel() {
  const addTraced = useStore((s) => s.addTraced);
  const traced = useMemo(() => SHAPES.map((s) => ({ s, t: traceShape(s) })), []);
  return (
    <div className="gen-rail-scroll">
      <div className="gen-rail-content">
        <div className="thumb-grid-sm">
          {traced.map(({ s, t }) => (
            <button key={s.id} type="button" className="thumb thumb-sm" onClick={() => addTraced(t, s.name)}>
              <span className="thumb-card">
                <Silhouette t={t} />
              </span>
              <span className="thumb-label">{s.name}</span>
            </button>
          ))}
        </div>
        <p className="field-note flush">Click a shape to stand it on the card. It lands in a free spot — drag it anywhere afterwards.</p>
      </div>
    </div>
  );
}

function AddPreview({ t, empty }: { t: Traced | null; empty: string }) {
  return (
    <div className="add-preview" aria-live="polite">
      {t ? <Silhouette t={t} /> : <span>{empty}</span>}
    </div>
  );
}

function TextPanel() {
  const addTraced = useStore((s) => s.addTraced);
  const [text, setText] = useState('HELLO');
  const [font, setFont] = useState<string>('sans');
  const [bar, setBar] = useState(true);
  const t = useMemo(() => traceText(text, font, bar), [text, font, bar]);
  return (
    <div className="gen-rail-scroll">
      <div className="gen-rail-content">
        <label className="textarea">
          <textarea rows={2} maxLength={24} value={text} placeholder="A word, a name, an emoji…" aria-label="Text" onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))} />
          <span className="counter">{text.length}/24</span>
        </label>
        <div className="bare-rows">
          <SelectRow label="Lettering" value={font} options={FONTS.map((f) => ({ value: f.id, label: f.name }))} onChange={setFont} />
          <SwitchRow label="Ground bar" checked={bar} onChange={setBar} />
        </div>
        <AddPreview t={t} empty="Type something to see its cut-out" />
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!t} onClick={() => t && addTraced(t, text.trim().slice(0, 18) || 'Text')}>
          Add to card
        </button>
        <p className="field-note flush">The ground bar joins the letters into one piece so nothing falls apart when cut. Emoji become silhouettes.</p>
      </div>
    </div>
  );
}

function ImagePanel() {
  const addTraced = useStore((s) => s.addTraced);
  const [img, setImg] = useState<{ el: HTMLImageElement; name: string } | null>(null);
  const [threshold, setThreshold] = useState(140);
  const [invert, setInvert] = useState(false);
  const [holes, setHoles] = useState(true);
  const [error, setError] = useState('');
  const t = useMemo(
    () => (img ? traceImage(img.el, img.el.naturalWidth, img.el.naturalHeight, { threshold, invert, holes }) : null),
    [img, threshold, invert, holes],
  );
  const onFile = (file?: File) => {
    if (!file) return;
    setError('');
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg({ el, name: file.name.replace(/\.[^.]+$/, '') });
      URL.revokeObjectURL(url);
    };
    el.onerror = () => {
      setError('That file could not be read as an image. Try a PNG, JPG or SVG.');
      URL.revokeObjectURL(url);
    };
    el.src = url;
  };
  return (
    <div className="gen-rail-scroll">
      <div className="gen-rail-content">
        <label className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          <span className="plate"><Icon d={ICONS.image} /></span>
          <strong>Click or drag an image here</strong>
          <small>PNG / JPG / SVG — a clear shape on a plain background works best</small>
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="Image to trace" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {error && (
          <div className="alert alert-error" role="alert"><Icon d={ICONS.warn} /><p>{error}</p></div>
        )}
        {img && (
          <>
            <div className="bare-rows">
              <SliderRow label="Detail" value={threshold} min={30} max={230} format={(v) => `${Math.round((v / 255) * 100)}%`} onChange={setThreshold} />
              <SwitchRow label="Invert" checked={invert} onChange={setInvert} />
              <SwitchRow label="Keep inner cut-outs" checked={holes} onChange={setHoles} />
            </div>
            <AddPreview t={t} empty="Nothing to cut at this setting — move “Detail”" />
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!t} onClick={() => t && addTraced(t, img.name.slice(0, 18) || 'Image')}>
              Add to card
            </button>
          </>
        )}
        <p className="field-note flush">The image becomes a cut-out silhouette: transparent images use their outline, photos use their dark areas.</p>
      </div>
    </div>
  );
}

function DrawPanel() {
  const addTraced = useStore((s) => s.addTraced);
  const ref = useRef<HTMLCanvasElement>(null);
  const [brush, setBrush] = useState(22);
  const [t, setT] = useState<Traced | null>(null);
  const last = useRef<[number, number] | null>(null);
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setT(null);
  };
  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height];
  };
  const stroke = (a: [number, number], b: [number, number]) => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = brush * 2;
    ctx.strokeStyle = '#292a2d';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  return (
    <div className="gen-rail-scroll">
      <div className="gen-rail-content">
        <canvas
          ref={ref}
          className="draw-pad"
          width={576}
          height={576}
          aria-label="Drawing pad"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            last.current = pos(e);
            stroke(last.current, last.current);
          }}
          onPointerMove={(e) => {
            if (!last.current) return;
            const p = pos(e);
            stroke(last.current, p);
            last.current = p;
          }}
          onPointerUp={() => {
            last.current = null;
            setT(traceCanvas(ref.current!));
          }}
        />
        <div className="bare-rows">
          <SliderRow label="Brush" value={brush} min={8} max={48} format={(v) => `${v}`} onChange={setBrush} />
        </div>
        <div className="btn-pair">
          <button type="button" className="btn btn-secondary" onClick={clear}>Clear</button>
          <button type="button" className="btn btn-primary" disabled={!t} onClick={() => { if (t) { addTraced(t, 'Drawing'); clear(); } }}>
            Add to card
          </button>
        </div>
        <p className="field-note flush">Draw with a fat brush — whatever you paint becomes one solid cut-out. Keep strokes touching so it stays in one piece.</p>
      </div>
    </div>
  );
}

export function LeadRail() {
  const [tool, setTool] = useState<Tool>('templates');
  const [open, setOpen] = useState(true);
  const current = TOOLS.find((t) => t.id === tool)!;
  // on a narrow region the panel starts closed so the canvas is seen first
  useEffect(() => {
    if (window.innerWidth < 960) setOpen(false);
  }, []);
  return (
    <>
      <nav className="gen-rail gen-rail-tools" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="rail-item"
            aria-pressed={open && tool === t.id}
            onClick={() => {
              if (tool === t.id) setOpen(!open);
              else {
                setTool(t.id);
                setOpen(true);
              }
            }}
          >
            <span className="plate"><Icon d={t.icon} /></span>
            {t.label}
          </button>
        ))}
      </nav>
      {open && (
        <aside className="gen-rail gen-rail-lead" aria-label={current.title}>
          <div className="gen-rail-header">
            <span className="gen-rail-title">{current.title}</span>
            <button type="button" className="btn-plate" aria-label="Collapse panel" onClick={() => setOpen(false)}>
              <Icon d={ICONS.collapse} />
            </button>
          </div>
          {tool === 'templates' && <TemplatesPanel />}
          {tool === 'shapes' && <ShapesPanel />}
          {tool === 'text' && <TextPanel />}
          {tool === 'image' && <ImagePanel />}
          {tool === 'draw' && <DrawPanel />}
        </aside>
      )}
    </>
  );
}
