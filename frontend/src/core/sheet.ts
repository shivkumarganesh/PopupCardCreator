/**
 * CardModel → cutting sheets → files. Export space: millimetres, y down, 1:1.
 * The card, its backing cover and the glue-on pieces are laid out side by side
 * as separate groups so each can go on its own paper.
 */
import { bbox } from './geom';
import { LASER, LIMITS } from './types';
import type { CardModel, LineKind, PatternLine, Pt } from './types';

export interface SheetGroup {
  id: string;
  label: string;
  /** Suggested paper colour (preview only — never written into the laser file). */
  paper: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lines in group-local export space. */
  lines: PatternLine[];
}

export interface SheetDoc {
  widthMm: number;
  heightMm: number;
  groups: SheetGroup[];
}

const GAP = 12;

export function layoutSheets(model: CardModel): SheetDoc {
  const { card } = model;
  const W = card.widthMm;
  const P = card.panelMm;
  const groups: SheetGroup[] = [];
  let x = 0;

  const flip = (l: PatternLine, dx: number, top: number): PatternLine => ({
    ...l,
    points: l.points.map(([px, py]): Pt => [px + dx, top - py]),
  });

  groups.push({
    id: 'card',
    label: 'Pop-up sheet',
    paper: card.color,
    x,
    y: 0,
    w: W,
    h: 2 * P,
    lines: model.lines.map((l) => flip(l, 0, P)),
  });
  x += W + GAP;

  if (card.backing) {
    const m = LIMITS.backingMargin;
    const bw = W + 2 * m;
    const bh = 2 * P + 2 * m;
    groups.push({
      id: 'backing',
      label: 'Backing cover',
      paper: card.backingColor,
      x,
      y: 0,
      w: bw,
      h: bh,
      lines: [
        { kind: 'cut', closed: true, points: [[0, 0], [bw, 0], [bw, bh], [0, bh]] },
        { kind: 'valley', closed: false, points: [[0, bh / 2], [bw, bh / 2]] },
      ],
    });
    x += bw + GAP;
  }

  // Glue-on pieces: one group per paper colour, shelf-packed, stacked in columns beside the card.
  const byColor = new Map<string, typeof model.pieces>();
  for (const p of model.pieces) byColor.set(p.color, [...(byColor.get(p.color) ?? []), p]);
  const colH = 2 * P;
  let colX = x;
  let colY = 0;
  let colW = 0;
  for (const [color, list] of byColor) {
    const items = list
      .map((p) => ({ p, b: bbox(p.region) }))
      .sort((a, b) => b.b.maxY - b.b.minY - (a.b.maxY - a.b.minY));
    const maxW = Math.max(W, ...items.map((i) => i.b.maxX - i.b.minX));
    const lines: PatternLine[] = [];
    let cx = 0;
    let cy = 0;
    let rowH = 0;
    let usedW = 0;
    for (const { p, b } of items) {
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      if (cx > 0 && cx + w > maxW) {
        cx = 0;
        cy += rowH + 4;
        rowH = 0;
      }
      for (const poly of p.region)
        for (const ring of poly)
          lines.push({
            kind: 'cut',
            closed: true,
            elementId: p.elementId,
            points: ring.map(([px, py]): Pt => [px - b.minX + cx, b.maxY - py + cy]),
          });
      cx += w + 4;
      usedW = Math.max(usedW, cx - 4);
      rowH = Math.max(rowH, h);
    }
    const gh = cy + rowH;
    if (colY > 0 && colY + gh > colH) {
      colX += colW + GAP;
      colY = 0;
      colW = 0;
    }
    groups.push({ id: `pieces-${color.replace('#', '')}`, label: 'Glue-on pieces', paper: color, x: colX, y: colY, w: usedW, h: gh, lines });
    colY += gh + GAP;
    colW = Math.max(colW, usedW);
  }

  return {
    widthMm: Math.max(...groups.map((g) => g.x + g.w)),
    heightMm: Math.max(...groups.map((g) => g.y + g.h)),
    groups,
  };
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

export function linePath(l: PatternLine, dx = 0, dy = 0): string {
  return (
    l.points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x + dx)} ${n(y + dy)}`).join('') + (l.closed ? 'Z' : '')
  );
}

const ORDER: LineKind[] = ['valley', 'mountain', 'cut'];

/**
 * Laser file. Stroke colour carries the processing intent (Atomm colour spec):
 * #FE0002 = cut, #2366FF = score line. Scores are emitted before cuts so the
 * sheet is still held flat while it is scored.
 */
export function toLaserSvg(doc: SheetDoc): string {
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(doc.widthMm)}mm" height="${n(doc.heightMm)}mm" viewBox="0 0 ${n(doc.widthMm)} ${n(doc.heightMm)}">`,
  ];
  for (const g of doc.groups) {
    out.push(`<g id="${g.id}">`);
    for (const kind of ORDER)
      for (const l of g.lines)
        if (l.kind === kind)
          out.push(
            `<path d="${linePath(l, g.x, g.y)}" fill="none" stroke="${kind === 'cut' ? LASER.cut : LASER.score}" stroke-width="${LASER.strokeMm}" data-line="${kind}"/>`,
          );
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('\n');
}

/**
 * Print-and-cut template for scissors and a craft knife: one page per sheet,
 * black lines, 1:1. Solid = cut, dashed = valley fold, dash-dot = mountain fold.
 */
export function toPrintHtml(doc: SheetDoc, title = 'Pop-up card template'): string {
  const dash: Record<LineKind, string> = { cut: '', valley: '2.5 1.8', mountain: '5 1.5 0.8 1.5' };
  const pages = doc.groups.map((g) => {
    const m = 4;
    const paths = g.lines
      .map(
        (l) =>
          `<path d="${linePath(l, m, m)}" fill="none" stroke="#000" stroke-width="${l.kind === 'cut' ? 0.3 : 0.2}"${dash[l.kind] ? ` stroke-dasharray="${dash[l.kind]}"` : ''}/>`,
      )
      .join('');
    return `<section><h1>${g.label} — ${n(g.w)} × ${n(g.h)} mm</h1>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.w + 2 * m)}mm" height="${n(g.h + 2 * m)}mm" viewBox="0 0 ${n(g.w + 2 * m)} ${n(g.h + 2 * m)}">${paths}</svg></section>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
@page{margin:8mm}
body{margin:0;font:9pt/1.3 system-ui,sans-serif;color:#000}
section{break-after:page;page-break-after:always}
section:last-of-type{break-after:auto;page-break-after:auto}
h1{font-size:9pt;font-weight:600;margin:0 0 2mm}
p{margin:0 0 3mm}
svg{display:block}
</style></head><body>
<p><b>${title}</b> — print at 100% (“actual size”, no scaling). Solid line: cut. Dashed: valley fold (fold toward you). Dash-dot: mountain fold (fold away). Cut the two long sides of every tab, then fold.</p>
${pages.join('\n')}
</body></html>`;
}
