/** Export view: exactly what the file contains, sheet by sheet, at true proportions. */
import { useMemo, useRef } from 'react';
import { layoutSheets, linePath } from '../core/sheet';
import { LASER } from '../core/types';
import { fmtLen, useModel, useStore } from '../app/store';
import { useViewport } from './viewport';

export function ExportView() {
  const model = useModel();
  const unit = useStore((s) => s.unit);
  const doc = useMemo(() => layoutSheets(model), [model]);
  const ref = useRef<SVGSVGElement>(null);
  const { vp, panHandlers } = useViewport(ref, { x: 0, y: 0, w: doc.widthMm, h: doc.heightMm + 8 });
  const px = 1 / vp.scale;
  return (
    <svg ref={ref} className="editor-svg" role="img" aria-label="Sheets as they will be exported" {...panHandlers}>
      <g transform={`translate(${vp.tx} ${vp.ty}) scale(${vp.scale})`}>
        {doc.groups.map((g) => (
          <g key={g.id} transform={`translate(${g.x} ${g.y})`}>
            <rect className="sheet" width={g.w} height={g.h} fill={g.paper} fillOpacity={g.id.startsWith('pieces') ? 0.35 : 1} />
            {g.lines.map((l, i) => (
              <path
                key={i}
                d={linePath(l)}
                fill="none"
                stroke={l.kind === 'cut' ? LASER.cut : LASER.score}
                strokeWidth={1.25 * px}
              />
            ))}
            <text className="canvas-label" x={0} y={g.h + 13 * px} fontSize={11 * px}>
              {g.id.startsWith('pieces') ? '' : `${g.label} · `}
              {fmtLen(g.w, unit)} × {fmtLen(g.h, unit)} {unit === 'mm' ? 'mm' : 'in'}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
