import { useCardStore } from '../state/store';

/** Standard folded-card sizes (folded width × height, mm). */
const PRESETS: { label: string; panelWidthMm: number; heightMm: number }[] = [
  { label: 'A6 portrait', panelWidthMm: 105, heightMm: 148 },
  { label: 'A5 portrait', panelWidthMm: 148, heightMm: 210 },
  { label: 'Square 130', panelWidthMm: 130, heightMm: 130 },
  { label: 'US A2', panelWidthMm: 111, heightMm: 146 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Card dimension controls. `panelWidthMm` is one panel (gutter → outer edge),
 * i.e. the folded-card width; the flat sheet the laser cuts is twice as wide.
 */
export function CardControls() {
  const card = useCardStore((s) => s.card);
  const setCard = useCardStore((s) => s.setCard);

  const matchesPreset = (p: (typeof PRESETS)[number]) =>
    p.panelWidthMm === card.panelWidthMm && p.heightMm === card.heightMm;
  const activePreset = PRESETS.find(matchesPreset)?.label ?? '';

  return (
    <div className="card-control">
      <h3>Card dimensions</h3>

      <div className="card-control-row">
        <label>
          Width (folded)
          <span className="unit-input">
            <input
              type="number"
              min={40}
              max={400}
              value={card.panelWidthMm}
              onChange={(e) =>
                setCard({ panelWidthMm: clamp(Number(e.target.value) || 0, 40, 400) })
              }
            />
            mm
          </span>
        </label>
        <label>
          Height
          <span className="unit-input">
            <input
              type="number"
              min={40}
              max={500}
              value={card.heightMm}
              onChange={(e) =>
                setCard({ heightMm: clamp(Number(e.target.value) || 0, 40, 500) })
              }
            />
            mm
          </span>
        </label>
      </div>

      <label className="card-control-preset">
        Preset
        <select
          value={activePreset}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.label === e.target.value);
            if (p) setCard({ panelWidthMm: p.panelWidthMm, heightMm: p.heightMm });
          }}
        >
          <option value="">Custom…</option>
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label} ({p.panelWidthMm}×{p.heightMm})
            </option>
          ))}
        </select>
      </label>

      <p className="card-control-note">
        Flat sheet: {card.panelWidthMm * 2} × {card.heightMm} mm
      </p>
    </div>
  );
}
