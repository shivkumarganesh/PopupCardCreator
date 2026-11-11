/**
 * 2D design view: the unfolded card seen from the inside. Back wall on top,
 * floor below, centre fold between them. Drag an element sideways to move it,
 * toward you to bring it forward; drag its corner handle to resize.
 */
import { useRef } from 'react';
import { elementWidth } from '../core/build';
import { LASER, LIMITS } from '../core/types';
import type { PatternLine } from '../core/types';
import { useModel, useStore } from '../app/store';
import { regionPath, useViewport } from './viewport';

const linePath = (l: PatternLine) =>
  l.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(-y).toFixed(2)}`).join('') + (l.closed ? 'Z' : '');

export function Editor2D() {
  const model = useModel();
  const design = useStore((s) => s.design);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const updateElement = useStore((s) => s.updateElement);
  const remove = useStore((s) => s.remove);
  const ref = useRef<SVGSVGElement>(null);
  const { card } = model;
  const W = card.widthMm;
  const P = card.panelMm;
  const { vp, panHandlers } = useViewport(ref, { x: 0, y: -P, w: W, h: 2 * P });
  const px = 1 / vp.scale; // one screen pixel in mm

  const bad = new Set(model.issues.filter((i) => i.severity === 'error').map((i) => i.elementId));
  const pieces = [...model.parts.filter((p) => p.role === 'piece')].sort((a, b) => a.depth - b.depth);
  const lifted = model.parts.filter((p) => p.role === 'front' || p.role === 'bridge');
  const order = [...design.elements].sort((a, b) => a.depthMm - b.depthMm);
  const sel = design.elements.find((e) => e.id === selectedId);
  const selBox = sel ? model.footprints[sel.id]?.bbox : undefined;

  const startDrag = (e: React.PointerEvent, id: string, mode: 'move' | 'size') => {
    e.stopPropagation();
    const el = design.elements.find((x) => x.id === id);
    if (!el) return;
    select(id);
    const target = e.currentTarget as SVGElement;
    target.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    const scale = vp.scale;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      if (mode === 'move') {
        updateElement(id, {
          xMm: Math.round(Math.max(0, Math.min(W, el.xMm + dx)) * 2) / 2,
          depthMm: Math.round(Math.max(LIMITS.minDepth, Math.min(P - LIMITS.edge - 5, el.depthMm + dy)) * 2) / 2,
        });
      } else {
        // the handle sits at the top-right corner: up or right both grow the element
        const grow = Math.abs(dx) > Math.abs(dy) ? (dx * 2) / el.aspect : -dy;
        updateElement(id, { heightMm: Math.round(Math.max(LIMITS.minHeight, Math.min(P, el.heightMm + grow))) });
      }
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!sel) return;
    const step = e.shiftKey ? 5 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(sel.id);
    } else if (moves[e.key]) {
      e.preventDefault();
      const [mx, my] = moves[e.key];
      updateElement(sel.id, {
        xMm: Math.max(0, Math.min(W, sel.xMm + mx * step)),
        depthMm: Math.max(LIMITS.minDepth, Math.min(P - LIMITS.edge - 5, sel.depthMm + my * step)),
      });
    } else if (e.key === 'Escape') select(null);
  };

  const m = card.backing ? LIMITS.backingMargin : 0;
  return (
    <svg
      ref={ref}
      className="editor-svg"
      tabIndex={0}
      role="application"
      aria-label="Card design. Arrow keys move the selected element, Delete removes it."
      onKeyDown={onKey}
      {...panHandlers}
      onClick={(e) => e.target === e.currentTarget && select(null)}
    >
      <g transform={`translate(${vp.tx} ${vp.ty}) scale(${vp.scale})`}>
        {card.backing && <rect x={-m} y={-P - m} width={W + 2 * m} height={2 * P + 2 * m} fill={card.backingColor} rx={0.6} />}
        <rect className="sheet" x={0} y={-P} width={W} height={2 * P} fill={card.color} onClick={() => select(null)} />
        <text className="canvas-label" x={-6 - m} y={-P / 2} fontSize={11 * px} textAnchor="end">Back wall</text>
        <text className="canvas-label" x={-6 - m} y={P / 2} fontSize={11 * px} textAnchor="end">Floor</text>
        <text className="canvas-label" x={-6 - m} y={3.5 * px} fontSize={11 * px} textAnchor="end">Centre fold</text>

        {lifted.map((p, i) => (
          <path key={`l${i}`} className="lifted" d={regionPath(p.region)} fillRule="evenodd" />
        ))}
        {pieces.map((p) => (
          <path key={`p${p.elementId}`} d={regionPath(p.region)} fill={p.color} fillRule="evenodd" opacity={0.88} className="piece" />
        ))}

        {model.lines.map((l, i) => (
          <path
            key={i}
            d={linePath(l)}
            fill="none"
            stroke={l.kind === 'cut' ? LASER.cut : LASER.score}
            strokeWidth={1.25 * px}
            strokeDasharray={l.kind === 'valley' ? `${5 * px} ${3 * px}` : l.kind === 'mountain' ? `${8 * px} ${3 * px} ${1.5 * px} ${3 * px}` : undefined}
            pointerEvents="none"
          />
        ))}

        {order.map((el) => {
          const fp = model.footprints[el.id];
          if (!fp) return null;
          return (
            <path
              key={`h${el.id}`}
              d={regionPath(fp.region)}
              className={`hit${bad.has(el.id) ? ' hit-bad' : ''}`}
              strokeWidth={2 * px}
              onPointerDown={(e) => startDrag(e, el.id, 'move')}
            >
              <title>{el.name}</title>
            </path>
          );
        })}

        {sel && selBox && (
          <g>
            <rect
              className="sel-box"
              x={selBox.minX - 2 * px}
              y={-selBox.maxY - 2 * px}
              width={selBox.maxX - selBox.minX + 4 * px}
              height={selBox.maxY - selBox.minY + 4 * px}
              strokeWidth={2 * px}
              strokeDasharray={`${4 * px} ${3 * px}`}
            />
            <rect
              className="sel-handle"
              x={sel.xMm + elementWidth(sel) / 2 - 6 * px}
              y={-(sel.heightMm - sel.depthMm) - 6 * px}
              width={12 * px}
              height={12 * px}
              rx={2 * px}
              strokeWidth={2 * px}
              onPointerDown={(e) => startDrag(e, sel.id, 'size')}
            >
              <title>Drag to resize</title>
            </rect>
          </g>
        )}
      </g>
    </svg>
  );
}
