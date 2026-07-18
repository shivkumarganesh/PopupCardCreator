import type { CardParams, FlatPattern, Mechanism, PatternLine } from './types';
import { SCORE_INSET_MM } from './types';

type Interval = [number, number];

/** Subtract a set of intervals from a base interval, returning the gaps. */
function subtractIntervals(base: Interval, holes: Interval[]): Interval[] {
  const sorted = holes
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as Interval)
    .filter(([a, b]) => b > base[0] && a < base[1])
    .sort((x, y) => x[0] - y[0]);

  const segments: Interval[] = [];
  let cursor = base[0];
  for (const [a, b] of sorted) {
    if (a > cursor) segments.push([cursor, Math.min(a, base[1])]);
    cursor = Math.max(cursor, b);
    if (cursor >= base[1]) break;
  }
  if (cursor < base[1]) segments.push([cursor, base[1]]);
  return segments;
}

/**
 * Add one parallel/box fold's lines to the pattern, and return the gutter
 * interval it occupies (so the base gutter valley can be split around it).
 *
 * Flat-sheet crease pattern of the symmetric single-slit step:
 *   - two slit cuts (perpendicular to the gutter) free the strip;
 *   - the gutter segment inside the strip reverses to a mountain crease;
 *   - the two base creases (parallel to the gutter) are valley folds that
 *     let the popup panels hinge back down.
 */
function addParallelFold(
  lines: PatternLine[],
  gutterX: number,
  m: Extract<Mechanism, { type: 'parallelFold' }>,
): Interval {
  const y0 = m.centreMm - m.spanMm / 2;
  const y1 = m.centreMm + m.spanMm / 2;
  const left = gutterX - m.depthMm;
  const right = gutterX + m.depthMm;

  // Slits (cut) crossing the gutter at each end of the strip.
  lines.push({ kind: 'cut', closed: false, points: [{ x: left, y: y0 }, { x: right, y: y0 }] });
  lines.push({ kind: 'cut', closed: false, points: [{ x: left, y: y1 }, { x: right, y: y1 }] });

  // Base creases (valley) parallel to the gutter, inset off the slits.
  const iy0 = y0 + SCORE_INSET_MM;
  const iy1 = y1 - SCORE_INSET_MM;
  lines.push({ kind: 'valley', closed: false, points: [{ x: left, y: iy0 }, { x: left, y: iy1 }] });
  lines.push({ kind: 'valley', closed: false, points: [{ x: right, y: iy0 }, { x: right, y: iy1 }] });

  // Reversed gutter crease (mountain) inside the strip.
  lines.push({ kind: 'mountain', closed: false, points: [{ x: gutterX, y: iy0 }, { x: gutterX, y: iy1 }] });

  return [y0, y1];
}

/**
 * Build the flat pattern for the base card plus its mechanisms: the outer
 * boundary cut, each mechanism's cut/score lines, and the gutter valley
 * split into the segments the mechanisms leave free.
 */
export function buildCardPattern(
  card: CardParams,
  mechanisms: Mechanism[] = [],
): FlatPattern {
  const width = card.panelWidthMm * 2;
  const height = card.heightMm;
  const gutterX = card.panelWidthMm;
  const lines: PatternLine[] = [];

  lines.push({
    kind: 'cut',
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
  });

  const occupied: Interval[] = [];
  for (const m of mechanisms) {
    if (m.type === 'parallelFold') {
      occupied.push(addParallelFold(lines, gutterX, m));
    }
  }

  // Gutter valley, inset at the sheet edges and split around each mechanism.
  const segments = subtractIntervals([SCORE_INSET_MM, height - SCORE_INSET_MM], occupied);
  for (const [a, b] of segments) {
    if (b - a > 1e-6) {
      lines.push({ kind: 'valley', closed: false, points: [{ x: gutterX, y: a }, { x: gutterX, y: b }] });
    }
  }

  return { widthMm: width, heightMm: height, lines };
}
