import type { CardParams, FlatPattern, Mechanism, PatternLine, Point2, VFoldMechanism } from './types';
import { SCORE_INSET_MM, vFoldSectorAngles } from './types';

type Interval = [number, number];

/** Shorten a segment by `inset` at each end so scores stop short of cuts. */
function insetSeg(a: Point2, b: Point2, inset: number): Point2[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 2 * inset) return [a, b];
  const ux = dx / len;
  const uy = dy / len;
  return [
    { x: a.x + ux * inset, y: a.y + uy * inset },
    { x: b.x - ux * inset, y: b.y - uy * inset },
  ];
}

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

interface PatchGeom {
  lines: PatternLine[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * The unfolded flat piece for a V-fold, in local coordinates with the vertex
 * at the origin and the central crease running up +y.
 *
 *   - closed cut outline around the two wings and their glue tabs;
 *   - central mountain crease (the ridge of the V);
 *   - two valley attachment creases where the tabs fold under to glue.
 */
function vFoldPatchLocal(m: VFoldMechanism): PatchGeom {
  const h = m.armMm;
  const tabW = m.tabMm;
  const { bL, bR } = vFoldSectorAngles(m);
  const BL = (bL * Math.PI) / 180;
  const BR = (bR * Math.PI) / 180;
  const sBL = Math.sin(BL);
  const cBL = Math.cos(BL);
  const sBR = Math.sin(BR);
  const cBR = Math.cos(BR);

  const V: Point2 = { x: 0, y: 0 };
  const Pc: Point2 = { x: 0, y: h }; // top of central crease
  // Left wing opens by B_L, right wing by B_R (asymmetric patch).
  const PaR: Point2 = { x: h * sBR, y: h * cBR };
  const PaL: Point2 = { x: -h * sBL, y: h * cBL };
  // Outward normals of the attachment creases (away from the central crease).
  const nR: Point2 = { x: cBR, y: -sBR };
  const nL: Point2 = { x: -cBL, y: -sBL };
  const PaRt: Point2 = { x: PaR.x + tabW * nR.x, y: PaR.y + tabW * nR.y };
  const Vrt: Point2 = { x: V.x + tabW * nR.x, y: V.y + tabW * nR.y };
  const PaLt: Point2 = { x: PaL.x + tabW * nL.x, y: PaL.y + tabW * nL.y };
  const Vlt: Point2 = { x: V.x + tabW * nL.x, y: V.y + tabW * nL.y };

  const outline = [Pc, PaR, PaRt, Vrt, V, Vlt, PaLt, PaL];
  const lines: PatternLine[] = [
    { kind: 'cut', closed: true, points: outline },
    { kind: 'mountain', closed: false, points: insetSeg(V, Pc, SCORE_INSET_MM) },
    { kind: 'valley', closed: false, points: insetSeg(V, PaR, SCORE_INSET_MM) },
    { kind: 'valley', closed: false, points: insetSeg(V, PaL, SCORE_INSET_MM) },
  ];

  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  return {
    lines,
    bbox: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

/** Half-width of a cut V-fold beak at its slit end (mm). */
export function beakHalfWidth(m: VFoldMechanism): number {
  return m.armMm * Math.tan((m.spreadAngleDeg * Math.PI) / 180);
}

/**
 * Add a cut ("beak") V-fold's lines to the pattern, drawn on the card itself,
 * and return the gutter interval it occupies (apex → slit).
 *
 * Crease pattern (a triangular relative of the step fold):
 *   - one slit cut across the gutter at the wide end;
 *   - two valley attachment creases from the slit ends to the apex;
 *   - the gutter reverses to a mountain ridge between apex and slit.
 */
function addCutVFold(
  lines: PatternLine[],
  gutterX: number,
  m: VFoldMechanism,
): Interval {
  const yApex = m.centreMm;
  const ySlit = m.centreMm + (m.flipped ? -m.armMm : m.armMm);
  const d = beakHalfWidth(m);

  lines.push({
    kind: 'cut',
    closed: false,
    points: [{ x: gutterX - d, y: ySlit }, { x: gutterX + d, y: ySlit }],
  });
  lines.push({ kind: 'valley', closed: false, points: insetSeg({ x: gutterX - d, y: ySlit }, { x: gutterX, y: yApex }, SCORE_INSET_MM) });
  lines.push({ kind: 'valley', closed: false, points: insetSeg({ x: gutterX + d, y: ySlit }, { x: gutterX, y: yApex }, SCORE_INSET_MM) });
  lines.push({ kind: 'mountain', closed: false, points: insetSeg({ x: gutterX, y: yApex }, { x: gutterX, y: ySlit }, SCORE_INSET_MM) });

  return [yApex, ySlit];
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Direction-independent key for a line, so coincident lines can be merged. */
function lineKey(line: PatternLine): string {
  const pts = line.points.map((p) => `${round3(p.x)},${round3(p.y)}`);
  const fwd = pts.join(' ');
  const rev = [...pts].reverse().join(' ');
  const body = line.closed ? fwd : fwd < rev ? fwd : rev;
  return `${line.kind}|${line.closed ? 'C' : 'O'}|${body}`;
}

/**
 * Drop coincident duplicate lines. Adjacent step folds legitimately share a
 * slit cut; emitting it once avoids a double-burn without losing geometry.
 */
function dedupeLines(lines: PatternLine[]): PatternLine[] {
  const seen = new Set<string>();
  const out: PatternLine[] = [];
  for (const line of lines) {
    const key = lineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
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
    } else if (m.type === 'vFold' && m.mount === 'cut') {
      occupied.push(addCutVFold(lines, gutterX, m));
    }
  }

  // Gutter valley, inset at the sheet edges and split around each mechanism.
  const segments = subtractIntervals([SCORE_INSET_MM, height - SCORE_INSET_MM], occupied);
  for (const [a, b] of segments) {
    if (b - a > 1e-6) {
      lines.push({ kind: 'valley', closed: false, points: [{ x: gutterX, y: a }, { x: gutterX, y: b }] });
    }
  }

  // Glued V-folds are separate pieces: lay each patch out in a row below the
  // card so it can be cut from the same sheet. (Cut V-folds live on the card.)
  const vfolds = mechanisms.filter(
    (m): m is VFoldMechanism => m.type === 'vFold' && m.mount === 'glued',
  );
  let sheetWidth = width;
  let sheetHeight = height;
  if (vfolds.length > 0) {
    const gap = 10;
    let cursorX = gap;
    let bottom = height + gap;
    for (const m of vfolds) {
      const { lines: patch, bbox } = vFoldPatchLocal(m);
      const originX = cursorX - bbox.minX;
      const originY = height + gap - bbox.minY;
      for (const line of patch) {
        lines.push({
          ...line,
          points: line.points.map((p) => ({ x: originX + p.x, y: originY + p.y })),
        });
      }
      cursorX = originX + bbox.maxX + gap;
      bottom = Math.max(bottom, originY + bbox.maxY);
    }
    sheetWidth = Math.max(width, cursorX);
    sheetHeight = bottom + gap;
  }

  return { widthMm: sheetWidth, heightMm: sheetHeight, lines: dedupeLines(lines) };
}
