import type { FlatPattern, LineKind, PatternLine } from './types';
import { LASER_COLORS, LASER_STROKE_MM } from './types';

const round = (v: number) => Math.round(v * 1000) / 1000;

function pathData(line: PatternLine): string {
  const [first, ...rest] = line.points;
  const d =
    `M ${round(first.x)} ${round(first.y)}` +
    rest.map((p) => ` L ${round(p.x)} ${round(p.y)}`).join('');
  return line.closed ? `${d} Z` : d;
}

/** Canonical key for a segment regardless of direction, for de-duplication. */
function segmentKeys(line: PatternLine): string[] {
  const pts = line.closed ? [...line.points, line.points[0]] : line.points;
  const keys: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = `${round(pts[i].x)},${round(pts[i].y)}`;
    const b = `${round(pts[i + 1].x)},${round(pts[i + 1].y)}`;
    keys.push(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  return keys;
}

/**
 * Validate a pattern before export. Throws on rule violations rather than
 * emitting a file that would misbehave on the laser.
 */
export function validatePattern(pattern: FlatPattern): void {
  const seen = new Set<string>();
  let hasClosedCut = false;
  for (const line of pattern.lines) {
    if (line.kind === 'cut' && line.closed) hasClosedCut = true;
    if (line.points.length < 2) {
      throw new Error('Degenerate pattern line with fewer than 2 points.');
    }
    for (const key of segmentKeys(line)) {
      if (seen.has(key)) {
        throw new Error(`Duplicate segment would double-burn: ${key}`);
      }
      seen.add(key);
    }
  }
  // Open cut lines (slits, internal through-cuts) are valid laser geometry;
  // but the part must be released by at least one closed outer boundary.
  if (!hasClosedCut) {
    throw new Error('Laser rule violation: no closed cut boundary to release the part.');
  }
}

/**
 * Serialize a flat pattern to a laser-ready SVG string.
 *
 * - mm-true coordinates: viewBox units are millimetres and width/height carry
 *   explicit `mm` so xTool XCS / LightBurn import at exact scale.
 * - One <g> layer per operation, ordered valley → mountain → cut so scores
 *   run before the cut releases the part from the sheet.
 * - Hairline strokes, no fills, cut paths closed with `Z`.
 */
export function patternToSvg(pattern: FlatPattern): string {
  validatePattern(pattern);

  const layerOrder: LineKind[] = ['valley', 'mountain', 'cut'];
  const layers = layerOrder
    .map((kind) => {
      const paths = pattern.lines
        .filter((line) => line.kind === kind)
        .map((line) => `    <path d="${pathData(line)}"/>`)
        .join('\n');
      if (!paths) return '';
      return [
        `  <g id="${kind}" stroke="${LASER_COLORS[kind]}"`,
        ` stroke-width="${LASER_STROKE_MM}" fill="none">\n${paths}\n  </g>`,
      ].join('');
    })
    .filter(Boolean)
    .join('\n');

  const w = round(pattern.widthMm);
  const h = round(pattern.heightMm);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"` +
    ` width="${w}mm" height="${h}mm">\n${layers}\n</svg>\n`
  );
}
