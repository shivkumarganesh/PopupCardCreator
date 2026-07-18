import { describe, expect, it } from 'vitest';
import { buildCardPattern } from './flatPattern';
import { patternToSvg } from './svgExport';
import type { ParallelFoldMechanism } from './types';

const card = { panelWidthMm: 130, heightMm: 180 };
const fold = (id: string, centreMm: number): ParallelFoldMechanism => ({
  id,
  type: 'parallelFold',
  centreMm,
  spanMm: 60,
  depthMm: 30,
});

describe('buildCardPattern', () => {
  it('emits a closed outer boundary plus the base gutter valley', () => {
    const p = buildCardPattern(card, []);
    const closedCuts = p.lines.filter((l) => l.kind === 'cut' && l.closed);
    expect(closedCuts).toHaveLength(1);
    expect(p.lines.some((l) => l.kind === 'valley')).toBe(true);
  });

  it('adds slit cuts and splits the gutter valley around a step fold', () => {
    const p = buildCardPattern(card, [fold('m1', 90)]);
    // Two open slit cuts crossing the gutter (x = 130) at y = 60 and y = 120.
    const slits = p.lines.filter((l) => l.kind === 'cut' && !l.closed);
    expect(slits).toHaveLength(2);
    // Gutter valley is split into two segments (above and below the strip).
    const gutterSegs = p.lines.filter(
      (l) => l.kind === 'valley' && l.points.every((pt) => pt.x === 130),
    );
    expect(gutterSegs).toHaveLength(2);
    // The reversed gutter crease inside the strip is a mountain fold.
    expect(p.lines.some((l) => l.kind === 'mountain')).toBe(true);
  });

  it('de-duplicates the shared slit of two adjacent folds (no double-burn)', () => {
    // Folds at 60 and 120 both have a slit at y = 90 → must collapse to one.
    const p = buildCardPattern(card, [fold('m1', 60), fold('m2', 120)]);
    const slitsAt90 = p.lines.filter(
      (l) => l.kind === 'cut' && !l.closed && l.points[0].y === 90,
    );
    expect(slitsAt90).toHaveLength(1);
    // And the whole pattern is exportable (validation would throw on a dup).
    expect(() => patternToSvg(p)).not.toThrow();
  });

  it('produces a laser-valid SVG for a single step fold', () => {
    const svg = patternToSvg(buildCardPattern(card, [fold('m1', 90)]));
    expect(svg).toContain('#FF0000'); // cut
    expect(svg).toContain('#0000FF'); // mountain
    expect(svg).toContain('#00FF00'); // valley
    expect(svg).toContain('width="260mm"');
  });
});
