import { describe, expect, it } from 'vitest';
import { buildCard, hasErrors } from './build';
import { area, bbox, rect, union } from './geom';
import { partPose, poseToWorld } from './pose';
import { layoutSheets, toLaserSvg } from './sheet';
import { contourRings, traceMask } from './trace';
import type { Design, MultiPoly, PopElement } from './types';

const square: MultiPoly = rect(0, 0, 1, 1);
const el = (over: Partial<PopElement> = {}): PopElement => ({
  id: 'a',
  name: 'Box',
  outline: square,
  aspect: 1,
  xMm: 75,
  depthMm: 25,
  heightMm: 40,
  mode: 'fused',
  supportOffset: 0,
  supportWidthMm: 10,
  color: '#ff0000',
  ...over,
});
const design = (...elements: PopElement[]): Design => ({
  card: { widthMm: 150, panelMm: 105, color: '#fff', backing: false, backingColor: '#000' },
  elements,
});

describe('trace', () => {
  const disc = (size: number, r: number, hole = 0) => {
    const m = new Uint8ClampedArray(size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
        m[y * size + x] = Math.max(0, Math.min(1, r - d + 0.5)) * Math.max(0, Math.min(1, d - hole + 0.5)) * 255;
      }
    return m;
  };
  it('traces a disc to one ring of the right area', () => {
    const rings = contourRings(disc(100, 30), 100, 100);
    expect(rings).toHaveLength(1);
    const t = traceMask(disc(100, 30), 100, 100)!;
    expect(t.aspect).toBeCloseTo(1, 1);
    expect(area(t.outline)).toBeCloseTo(Math.PI / 4, 1);
    expect(bbox(t.outline).minY).toBe(0);
  });
  it('keeps or drops holes on request', () => {
    const m = disc(100, 30, 12);
    expect(traceMask(m, 100, 100)!.outline[0]).toHaveLength(2);
    expect(traceMask(m, 100, 100, { holes: false })!.outline[0]).toHaveLength(1);
  });
  it('returns null for an empty mask', () => {
    expect(traceMask(new Uint8ClampedArray(100), 10, 10)).toBeNull();
  });
});

describe('parallelogram kinematics', () => {
  const front = { role: 'front' as const, depth: 30, strut: 45 };
  const bridge = { role: 'bridge' as const, depth: 30, strut: 45 };
  const wall = { role: 'wall' as const, depth: 0, strut: 0 };
  it.each([0, 30, 90, 135, 180])('the strut meets front face and wall at %i°', (deg) => {
    // mountain fold: flat y = strut - depth
    const onFront = poseToWorld(partPose(front, deg), 10, 15);
    const onBridgeStart = poseToWorld(partPose(bridge, deg), 10, 15);
    // wall fold: flat y = strut
    const onBridgeEnd = poseToWorld(partPose(bridge, deg), 10, 45);
    const onWall = poseToWorld(partPose(wall, deg), 10, 45);
    for (let k = 0; k < 3; k++) {
      expect(onFront[k]).toBeCloseTo(onBridgeStart[k], 9);
      expect(onBridgeEnd[k]).toBeCloseTo(onWall[k], 9);
    }
  });
  it('lies flat at 180° and closes flat at 0°', () => {
    for (const part of [front, bridge, wall]) {
      expect(poseToWorld(partPose(part, 180), 0, 20)[1]).toBeCloseTo(0, 9);
      expect(poseToWorld(partPose(part, 0), 0, 20)[1]).toBeCloseTo(0, 9);
    }
  });
  it('stands vertical at 90°', () => {
    const top = poseToWorld(partPose(front, 90), 0, 10); // 40 mm up the face
    expect(top[1]).toBeCloseTo(40, 9);
    expect(top[2]).toBeCloseTo(30, 9);
  });
});

describe('buildCard', () => {
  it('builds a valid fused element whose parts tile the sheet exactly', () => {
    const m = buildCard(design(el()));
    expect(m.issues).toEqual([]);
    const sheet = m.parts.filter((p) => p.layer === 0).map((p) => p.region);
    expect(area(union(...sheet))).toBeCloseTo(150 * 210, 3);
    expect(sheet.reduce((s, r) => s + area(r), 0)).toBeCloseTo(150 * 210, 3);
  });

  it('never cuts the same segment twice and folds where it should', () => {
    const m = buildCard(design(el()));
    const mine = m.lines.filter((l) => l.elementId === 'a');
    const kinds = (k: string) => mine.filter((l) => l.kind === k);
    expect(kinds('mountain')).toHaveLength(1);
    expect(kinds('valley')).toHaveLength(2); // floor crease + wall crease
    // floor crease spans the whole 40 mm foot
    const floor = kinds('valley').find((l) => l.points[0][1] === -25)!;
    expect(Math.abs(floor.points[1][0] - floor.points[0][0])).toBeCloseTo(40, 6);
    // total cut length: square sides (2×40) + top outside the strut (30) + strut sides (2×25)
    const len = kinds('cut').reduce(
      (s, l) => s + l.points.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - l.points[i][0], p[1] - l.points[i][1]), 0),
      0,
    );
    expect(len).toBeCloseTo(80 + 30 + 50, 6);
    // the gutter is interrupted across the element
    const gutter = m.lines.filter((l) => !l.elementId && l.kind === 'valley');
    expect(gutter).toHaveLength(2);
  });

  it('a glued element only cuts a tab and yields a loose piece', () => {
    const m = buildCard(design(el({ mode: 'glued' })));
    expect(m.issues).toEqual([]);
    expect(m.pieces).toHaveLength(1);
    expect(area(m.pieces[0].region)).toBeCloseTo(1600, 3);
    const cuts = m.lines.filter((l) => l.elementId === 'a' && l.kind === 'cut');
    expect(cuts).toHaveLength(2);
    // tab as tall as deep → its mountain fold sits on the gutter
    expect(m.lines.find((l) => l.kind === 'mountain')!.points[0][1]).toBeCloseTo(0, 9);
  });

  it('flags an element that would stick out of the closed card', () => {
    const m = buildCard(design(el({ depthMm: 60, heightMm: 60 })));
    expect(hasErrors(m)).toBe(true);
    expect(m.issues[0].message).toMatch(/stick out/);
  });

  it('flags two elements that need the same paper, but not side-by-side ones', () => {
    const clash = buildCard(design(el(), el({ id: 'b', name: 'B', depthMm: 40, heightMm: 30 })));
    expect(clash.issues.some((i) => /same paper/.test(i.message))).toBe(true);
    const ok = buildCard(design(el({ xMm: 40 }), el({ id: 'b', name: 'B', xMm: 100 })));
    expect(ok.issues).toEqual([]);
  });

  it('slots a back piece so a front strut can pass through it', () => {
    const back = el({ mode: 'glued', depthMm: 20, heightMm: 50, supportOffset: -0.8 });
    const frontEl = el({ id: 'b', name: 'B', mode: 'glued', depthMm: 45, heightMm: 30, supportOffset: 0.8, xMm: 85 });
    const m = buildCard(design(back, frontEl));
    expect(m.issues).toEqual([]);
    // front strut is 10 mm wide and leaves at 27 mm: slot = 11.5 × 28 mm, open at the foot
    const piece = m.pieces.find((p) => p.elementId === 'a')!;
    expect(area(piece.region)).toBeCloseTo(50 * 50 - 11.5 * 28, 3);
    expect(piece.region).toHaveLength(1);
  });

  it('refuses a strut that would cut the piece behind it in two', () => {
    const back = el({ mode: 'glued', depthMm: 20, heightMm: 20, supportOffset: -0.8, outline: rect(0, 0, 3, 1), aspect: 3 });
    const frontEl = el({ id: 'b', name: 'B', mode: 'glued', depthMm: 50, heightMm: 22, xMm: 85 });
    const m = buildCard(design(back, frontEl));
    expect(m.issues.some((i) => /in two/.test(i.message))).toBe(true);
    expect(m.issues.some((i) => i.elementId === 'a')).toBe(true);
  });
});

describe('export', () => {
  it('writes a 1:1 mm SVG in the platform colours with every line present', () => {
    const m = buildCard({
      ...design(el({ mode: 'glued' })),
      card: { widthMm: 150, panelMm: 105, color: '#fff', backing: true, backingColor: '#123456' },
    });
    const doc = layoutSheets(m);
    expect(doc.groups.map((g) => g.id)).toEqual(['card', 'backing', 'pieces-ff0000']);
    const svg = toLaserSvg(doc);
    expect(svg).toContain(`width="${doc.widthMm}mm"`);
    expect(svg).toContain(`viewBox="0 0 ${doc.widthMm} ${doc.heightMm}"`);
    expect(svg.match(/stroke="#FE0002"/g)!.length).toBe(doc.groups.flatMap((g) => g.lines).filter((l) => l.kind === 'cut').length);
    expect(svg).toContain('stroke="#2366FF"');
    expect(svg).not.toMatch(/NaN|undefined/);
    // groups never overlap
    const [a, b, c] = doc.groups;
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.w);
    expect(c.x).toBeGreaterThanOrEqual(b.x + b.w);
  });
});
