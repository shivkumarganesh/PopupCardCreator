import { useCardStore } from '../state/store';
import type { ParallelFoldMechanism } from '../core/types';

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mech-slider">
      <span>
        {label}: <strong>{Math.round(value)} mm</strong>
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

function ParallelFoldEditor({ m, index }: { m: ParallelFoldMechanism; index: number }) {
  const card = useCardStore((s) => s.card);
  const update = useCardStore((s) => s.updateMechanism);
  const remove = useCardStore((s) => s.removeMechanism);

  return (
    <div className="mech-item">
      <div className="mech-item-head">
        <span>Step fold {index + 1}</span>
        <button onClick={() => remove(m.id)} title="Remove">
          ✕
        </button>
      </div>
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

export function MechanismPanel() {
  const mechanisms = useCardStore((s) => s.mechanisms);
  const addParallelFold = useCardStore((s) => s.addParallelFold);

  return (
    <div className="mech-panel">
      <div className="mech-panel-head">
        <h3>Pop-up mechanisms</h3>
        <button onClick={addParallelFold}>+ Step fold</button>
      </div>
      {mechanisms.length === 0 && <p className="mech-empty">No mechanisms yet.</p>}
      {mechanisms.map((m, i) =>
        m.type === 'parallelFold' ? (
          <ParallelFoldEditor key={m.id} m={m} index={i} />
        ) : null,
      )}
    </div>
  );
}
