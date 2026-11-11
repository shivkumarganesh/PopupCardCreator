/** Controls built on the Atomm generator stylesheet (atomm.css). */
import { useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { MM_PER_IN, useStore } from '../app/store';

export const Icon = ({ d, size = 16, className = 'icon' }: { d: string; size?: number; className?: string }) => (
  <svg className={className} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <path d={d} />
  </svg>
);

export const ICONS = {
  chevron: 'm4 6 4 4 4-4',
  collapse: 'M3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3ZM6 3v10',
  templates: 'M3.5 2.5h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM10 2.5h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM3.5 9h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM10 9h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z',
  shapes: 'M8 2l1.9 3.9 4.1.6-3 3 .7 4.2L8 11.7 4.3 13.7 5 9.5l-3-3 4.1-.6Z',
  text: 'M3 4V3h10v1M8 3v10M6 13h4',
  image: 'M8 11V3M5 6l3-3 3 3M3 11v2h10v-2',
  draw: 'M3 13l1-3.5 7-7 2.5 2.5-7 7ZM9.5 4l2.5 2.5',
  reset: 'M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3',
  undo: 'M6 4 3 7l3 3M3 7h6a4 4 0 0 1 0 8H7',
  redo: 'M10 4l3 3-3 3M13 7H7a4 4 0 0 0 0 8h2',
  minus: 'M4 8h8',
  plus: 'M8 4v8M4 8h8',
  fit: 'M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4',
  close: 'm4 4 8 8M12 4l-8 8',
  check: 'm3.5 8.5 3 3 6-7',
  play: 'M5 3.5v9l7-4.5Z',
  warn: 'M8 2.5 14 13H2ZM8 6.5v3M8 11.3h.01',
  up: 'm4 10 4-4 4 4',
  down: 'm4 6 4 4 4-4',
  copy: 'M5.5 5.5h7v7h-7ZM3.5 10.5v-7h7',
  trash: 'M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.5 9h6l.5-9',
  print: 'M4.5 6V2.5h7V6M4.5 11.5h-2V6h11v5.5h-2M4.5 9.5h7v4h-7Z',
} as const;

export function PropCard({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="prop-card" aria-labelledby={`${id}-t`}>
      <button
        type="button"
        className="prop-card-header"
        id={`${id}-t`}
        aria-expanded={open}
        aria-controls={`${id}-b`}
        onClick={() => setOpen(!open)}
      >
        {title}
        <Icon d={ICONS.chevron} />
      </button>
      <div className="prop-card-body" id={`${id}-b`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field-row">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="field-label">{label}</span>}
      {children}
    </div>
  );
}

interface NumberProps {
  label: string;
  /** Value in mm. */
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (mm: number) => void;
  invalid?: boolean;
}

/** Length field: value at the start, unit pinned to the end, drag sideways to change. */
export function LengthField({ label, value, min, max, step = 1, onChange, invalid }: NumberProps) {
  const id = useId();
  const unit = useStore((s) => s.unit);
  const [text, setText] = useState<string | null>(null);
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const k = unit === 'mm' ? 1 : MM_PER_IN;
  const shown = unit === 'mm' ? `${Math.round(value * 10) / 10}` : (value / k).toFixed(2);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(v)) onChange(clamp(v * k));
    setText(null);
  };
  return (
    <Row label={label} htmlFor={id}>
      <span className="input-number">
        <input
          id={id}
          data-drag
          inputMode="decimal"
          aria-invalid={invalid || undefined}
          value={text ?? shown}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => text !== null && commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setText(null);
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(clamp(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
            }
          }}
          onPointerDown={(e) => {
            if (document.activeElement === e.currentTarget) return;
            drag.current = { x: e.clientX, v: value, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = (e.clientX - d.x) * (document.dir === 'rtl' ? -1 : 1);
            if (!d.moved && Math.abs(dx) < 3) return;
            d.moved = true;
            const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            onChange(clamp(Math.round((d.v + dx * 0.5 * step * mult) / (step * 0.1)) * step * 0.1));
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (d?.moved) {
              e.preventDefault();
              e.currentTarget.blur();
            } else e.currentTarget.select();
          }}
        />
        <span className="unit">{unit === 'mm' ? 'mm' : 'in'}</span>
      </span>
    </Row>
  );
}

export function SliderRow(p: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const fill = `${((p.value - p.min) / (p.max - p.min)) * 100}%`;
  return (
    <Row label={p.label} htmlFor={id}>
      <div className="control">
        <input
          id={id}
          className="slider"
          type="range"
          min={p.min}
          max={p.max}
          step={p.step ?? 1}
          value={p.value}
          style={{ '--fill': fill } as CSSProperties}
          onChange={(e) => p.onChange(Number(e.target.value))}
        />
        <span className="value">{p.format(p.value)}</span>
      </div>
    </Row>
  );
}

export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <span className="switch">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" aria-hidden="true" />
        <span className="knob" aria-hidden="true" />
      </span>
    </Row>
  );
}

export function SwatchRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <label className="swatch">
        <input type="color" id={id} value={value} onChange={(e) => onChange(e.target.value)} />
        <i style={{ background: value }} />
      </label>
    </Row>
  );
}

export function Segmented<T extends string>(p: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  tabs?: boolean;
}) {
  return (
    <div className={`segmented${p.tabs ? ' segmented-tabs' : ''}`} role="group" aria-label={p.label}>
      {p.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={p.value === o.value} onClick={() => p.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SelectRow<T extends string>(p: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <Row label={p.label} htmlFor={id}>
      <span className="select-field">
        <select className="select" id={id} value={p.value} onChange={(e) => p.onChange(e.target.value as T)}>
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon d={ICONS.chevron} />
      </span>
    </Row>
  );
}

/** One-line status message on the dark plate, bottom centre. */
let toastTimer = 0;
export function toast(message: string) {
  let el = document.querySelector<HTMLDivElement>('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.dataset.show = '';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => delete el.dataset.show, 2600);
}
