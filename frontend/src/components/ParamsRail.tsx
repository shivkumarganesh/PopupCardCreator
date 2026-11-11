/** Parameters rail: unit toggle + reset, property cards, export pinned at the bottom. */
import { useEffect, useRef, useState } from 'react';
import { elementWidth } from '../core/build';
import { LIMITS } from '../core/types';
import type { BuildMode } from '../core/types';
import { download, embedded, laserFile, printTemplate, registerExportHook } from '../app/exporter';
import { CARD_PRESETS, DEFAULT_CARD, fmtLen, useModel, useStore } from '../app/store';
import { ICONS, Icon, LengthField, PropCard, Row, Segmented, SelectRow, SliderRow, SwatchRow, SwitchRow, toast } from './ui';

function Issues() {
  const model = useModel();
  const select = useStore((s) => s.select);
  if (!model.issues.length) return null;
  return (
    <div className="issue-list" role="status">
      {model.issues.slice(0, 4).map((i, k) => (
        <button
          key={k}
          type="button"
          className={`alert ${i.severity === 'error' ? 'alert-error' : 'alert-warning'}`}
          onClick={() => i.elementId && select(i.elementId)}
        >
          <Icon d={ICONS.warn} />
          <p>
            <strong>{i.message}</strong> {i.fix}
          </p>
        </button>
      ))}
      {model.issues.length > 4 && <p className="field-note flush">…and {model.issues.length - 4} more.</p>}
    </div>
  );
}

function CardCard() {
  const card = useStore((s) => s.design.card);
  const setCard = useStore((s) => s.setCard);
  const preset = CARD_PRESETS.find((p) => p.widthMm === card.widthMm && p.panelMm === card.panelMm)?.id ?? 'custom';
  return (
    <PropCard title="Card">
      <SelectRow
        label="Size"
        value={preset}
        options={[...CARD_PRESETS.map((p) => ({ value: p.id as string, label: p.name })), ...(preset === 'custom' ? [{ value: 'custom', label: 'Custom' }] : [])]}
        onChange={(id) => {
          const p = CARD_PRESETS.find((x) => x.id === id);
          if (p) setCard({ widthMm: p.widthMm, panelMm: p.panelMm });
        }}
      />
      <LengthField label="Width" value={card.widthMm} min={80} max={400} onChange={(v) => setCard({ widthMm: v })} />
      <LengthField label="Panel depth" value={card.panelMm} min={60} max={300} onChange={(v) => setCard({ panelMm: v })} />
      <p className="field-note">The sheet is the width × twice the panel depth, folded once across the middle.</p>
      <SwatchRow label="Paper colour" value={card.color} onChange={(v) => setCard({ color: v })} />
      <SwitchRow label="Backing cover" checked={card.backing} onChange={(v) => setCard({ backing: v })} />
      {card.backing && <SwatchRow label="Cover colour" value={card.backingColor} onChange={(v) => setCard({ backingColor: v })} />}
    </PropCard>
  );
}

function ElementCard() {
  const id = useStore((s) => s.selectedId);
  const el = useStore((s) => s.design.elements.find((e) => e.id === id));
  const card = useStore((s) => s.design.card);
  const update = useStore((s) => s.updateElement);
  const duplicate = useStore((s) => s.duplicate);
  const remove = useStore((s) => s.remove);
  const model = useModel();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [id]);
  if (!el) return null;
  const bad = model.issues.some((i) => i.elementId === el.id && i.severity === 'error');
  const w = elementWidth(el);
  return (
    <PropCard title={`Selected · ${el.name}`}>
      <Row label="Build">
        <Segmented<BuildMode>
          label="Build"
          value={el.mode}
          options={[
            { value: 'glued', label: 'Glue-on' },
            { value: 'fused', label: 'One sheet' },
          ]}
          onChange={(mode) => update(el.id, { mode })}
        />
      </Row>
      <p className="field-note">
        {el.mode === 'glued'
          ? 'A separate piece in its own colour, glued to a small tab cut from the card. Pieces may overlap.'
          : 'Cut from the card itself and folded up — no glue. Needs its own patch of paper.'}
      </p>
      <LengthField label="Height" value={el.heightMm} min={LIMITS.minHeight} max={card.panelMm} invalid={bad} onChange={(v) => update(el.id, { heightMm: v })} />
      <LengthField label="Position" value={el.xMm} min={0} max={card.widthMm} onChange={(v) => update(el.id, { xMm: v })} />
      <LengthField label="Distance from wall" value={el.depthMm} min={LIMITS.minDepth} max={card.panelMm - LIMITS.edge - 5} invalid={bad} onChange={(v) => update(el.id, { depthMm: v })} />
      <SliderRow
        label="Support position"
        value={Math.round(el.supportOffset * 100)}
        min={-100}
        max={100}
        step={5}
        format={(v) => (v === 0 ? 'Centre' : `${v > 0 ? '+' : ''}${v}%`)}
        onChange={(v) => update(el.id, { supportOffset: v / 100 })}
      />
      <LengthField label="Support width" value={el.supportWidthMm} min={LIMITS.minSupport} max={Math.max(LIMITS.minSupport, Math.min(40, w))} onChange={(v) => update(el.id, { supportWidthMm: v })} />
      {el.mode === 'glued' && <SwitchRow label="Low tab" checked={!!el.lowTab} onChange={(v) => update(el.id, { lowTab: v })} />}
      {el.mode === 'glued' && el.lowTab && <p className="field-note">The strut runs 8 mm above the floor, under the pieces behind it.</p>}
      {el.mode === 'glued' && <SwatchRow label="Paper colour" value={el.color} onChange={(v) => update(el.id, { color: v })} />}
      <div className="card-actions">
        <button type="button" className="btn btn-secondary" onClick={() => duplicate(el.id)}>
          <Icon d={ICONS.copy} />
          Duplicate
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (confirm) remove(el.id);
            else setConfirm(true);
          }}
          onBlur={() => setConfirm(false)}
        >
          <Icon d={ICONS.trash} />
          {confirm ? 'Confirm' : 'Remove'}
        </button>
      </div>
    </PropCard>
  );
}

function LayersCard() {
  const elements = useStore((s) => s.design.elements);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const unit = useStore((s) => s.unit);
  const model = useModel();
  const bad = new Set(model.issues.filter((i) => i.severity === 'error').map((i) => i.elementId));
  const sorted = [...elements].sort((a, b) => b.depthMm - a.depthMm);
  return (
    <PropCard title={`On the card · ${elements.length}`}>
      {sorted.length === 0 && <p className="field-note pad-top">Nothing yet. Add a shape, some text or your own picture from the left.</p>}
      <ul className="layer-list">
        {sorted.map((e) => (
          <li key={e.id}>
            <button type="button" className="layer" aria-pressed={e.id === selectedId} onClick={() => select(e.id)}>
              <i className="layer-dot" style={{ background: e.mode === 'glued' ? e.color : 'var(--color-bg-default)' }} aria-hidden="true" />
              <span className="layer-name">{e.name}</span>
              {bad.has(e.id) && <span className="tag tag-bad">Fix</span>}
              <span className="layer-meta">{fmtLen(e.depthMm, unit)} {unit} out</span>
            </button>
          </li>
        ))}
      </ul>
    </PropCard>
  );
}

function PreviewCard() {
  const openDeg = useStore((s) => s.openDeg);
  const setOpenDeg = useStore((s) => s.setOpenDeg);
  const play = useStore((s) => s.play);
  return (
    <PropCard title="Preview">
      <SliderRow label="Opening" value={Math.round(openDeg)} min={0} max={180} format={(v) => `${v}°`} onChange={setOpenDeg} />
      <div className="card-actions">
        <button type="button" className="btn btn-secondary" onClick={play}>
          <Icon d={ICONS.play} />
          Play opening
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpenDeg(180)}>
          Lay flat
        </button>
      </div>
    </PropCard>
  );
}

/** The platform's Export button renders into the slot; standalone we provide a download. */
function ExportSlot() {
  const slot = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(!embedded);
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      if (registerExportHook() || ++tries > 20) window.clearInterval(timer);
    }, 250);
    // inside the platform, only fall back if the SDK never fills the slot
    const late = window.setTimeout(() => {
      if (embedded && slot.current && slot.current.childElementCount === 0) setFallback(true);
    }, 4000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(late);
    };
  }, []);
  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed');
    }
  };
  return (
    <div className="gen-rail-footer">
      <button type="button" className="btn btn-secondary btn-block" onClick={() => run(printTemplate)}>
        <Icon d={ICONS.print} />
        Print template for scissors
      </button>
      {/* React never renders children here, so the SDK can own this node */}
      <div data-atomm-export-button ref={slot} hidden={fallback} />
      {fallback && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => run(() => { download(laserFile()); toast('Saved popup-card.svg — red lines cut, blue lines score'); })}>
          Export SVG
        </button>
      )}
    </div>
  );
}

export function ParamsRail() {
  const unit = useStore((s) => s.unit);
  const setUnit = useStore((s) => s.setUnit);
  const setCard = useStore((s) => s.setCard);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  return (
    <aside className="gen-rail gen-rail-params" aria-label="Parameters">
      <div className="gen-params-header">
        <Segmented label="Units" value={unit} options={[{ value: 'mm', label: 'mm' }, { value: 'in', label: 'inch' }]} onChange={setUnit} />
        <div className="header-actions">
          <button type="button" className="btn-icon" aria-label="Undo" disabled={!canUndo} onClick={undo}><Icon d={ICONS.undo} /></button>
          <button type="button" className="btn-icon" aria-label="Redo" disabled={!canRedo} onClick={redo}><Icon d={ICONS.redo} /></button>
          <button type="button" className="btn btn-secondary" onClick={() => setCard(DEFAULT_CARD)}>
            <Icon d={ICONS.reset} />
            Reset
          </button>
        </div>
      </div>
      <div className="gen-rail-scroll">
        <div className="gen-params-content">
          <Issues />
          <ElementCard />
          <LayersCard />
          <CardCard />
          <PreviewCard />
        </div>
      </div>
      <ExportSlot />
    </aside>
  );
}
