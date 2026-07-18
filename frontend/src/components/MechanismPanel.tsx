import { useMemo } from 'react';
import { useCardStore } from '../state/store';
import { conflictMessages } from '../core/validate';
import type { ParallelFoldMechanism, VFoldMechanism } from '../core/types';

function Slider({
  label,
  value,
  min,
  max,
  unit = 'mm',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mech-slider">
      <span>
        {label}: <strong>{Math.round(value)} {unit}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ParallelFoldEditor({
  m,
  index,
  warning,
}: {
  m: ParallelFoldMechanism;
  index: number;
  warning?: string;
}) {
  const card = useCardStore((s) => s.card);
  const update = useCardStore((s) => s.updateMechanism);
  const remove = useCardStore((s) => s.removeMechanism);

  return (
    <div className={`mech-item${warning ? ' mech-item-conflict' : ''}`}>
      <div className="mech-item-head">
        <span>Step fold {index + 1}</span>
        <button onClick={() => remove(m.id)} title="Remove">
          ✕
        </button>
      </div>
      {warning && <p className="mech-conflict-note">⚠ {warning}</p>}
      <Slider
        label="Position"
        value={m.centreMm}
        min={m.spanMm / 2}
        max={card.heightMm - m.spanMm / 2}
        onChange={(v) => update(m.id, { centreMm: v })}
      />
      <Slider
        label="Span"
        value={m.spanMm}
        min={10}
        max={card.heightMm}
        onChange={(v) => update(m.id, { spanMm: v })}
      />
      <Slider
        label="Depth"
        value={m.depthMm}
        min={5}
        max={card.panelWidthMm}
        onChange={(v) => update(m.id, { depthMm: v })}
      />
    </div>
  );
}

function VFoldEditor({
  m,
  index,
  warning,
}: {
  m: VFoldMechanism;
  index: number;
  warning?: string;
}) {
  const card = useCardStore((s) => s.card);
  const update = useCardStore((s) => s.updateMechanism);
  const remove = useCardStore((s) => s.removeMechanism);

  return (
    <div className={`mech-item mech-item-vfold${warning ? ' mech-item-conflict' : ''}`}>
      <div className="mech-item-head">
        <span>V-fold {index + 1}</span>
        <button onClick={() => remove(m.id)} title="Remove">
          ✕
        </button>
      </div>
      {warning && <p className="mech-conflict-note">⚠ {warning}</p>}
      <Slider
        label="Position"
        value={m.centreMm}
        min={0}
        max={card.heightMm}
        onChange={(v) => update(m.id, { centreMm: v })}
      />
      <Slider
        label="Base angle"
        value={m.baseAngleDeg}
        min={10}
        max={80}
        unit="°"
        onChange={(v) => update(m.id, { baseAngleDeg: v })}
      />
      <Slider
        label="Popup angle"
        value={m.popupAngleDeg}
        min={10}
        max={85}
        unit="°"
        onChange={(v) => update(m.id, { popupAngleDeg: v })}
      />
      <Slider
        label="Arm length"
        value={m.armMm}
        min={10}
        max={Math.min(card.heightMm, card.panelWidthMm)}
        onChange={(v) => update(m.id, { armMm: v })}
      />
    </div>
  );
}

export function MechanismPanel() {
  const mechanisms = useCardStore((s) => s.mechanisms);
  const addParallelFold = useCardStore((s) => s.addParallelFold);
  const addVFold = useCardStore((s) => s.addVFold);

  const warnings = useMemo(() => conflictMessages(mechanisms), [mechanisms]);

  return (
    <div className="mech-panel">
      <div className="mech-panel-head">
        <h3>Pop-up mechanisms</h3>
      </div>
      <div className="mech-add-row">
        <button onClick={addParallelFold}>+ Step fold</button>
        <button onClick={addVFold}>+ V-fold</button>
      </div>
      {mechanisms.length === 0 && <p className="mech-empty">No mechanisms yet.</p>}
      {mechanisms.map((m, i) =>
        m.type === 'parallelFold' ? (
          <ParallelFoldEditor key={m.id} m={m} index={i} warning={warnings.get(m.id)} />
        ) : (
          <VFoldEditor key={m.id} m={m} index={i} warning={warnings.get(m.id)} />
        ),
      )}
    </div>
  );
}
