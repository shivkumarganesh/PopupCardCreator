/**
 * Bitmap → silhouette. Every element source (library shape, text, emoji,
 * uploaded image, freehand drawing) is rasterised to a coverage mask and traced
 * here, so there is exactly one path from "a picture" to "a cuttable outline".
 *
 * Marching squares with linear interpolation on the anti-aliased coverage
 * gives sub-pixel contours; Douglas–Peucker then thins them to what a blade or
 * a laser can actually follow.
 */
import { pointInRing, ringArea, simplifyRing } from './geom';
import type { MultiPoly, Pt, Ring } from './types';

export interface TraceOptions {
  /** Simplification tolerance in pixels. */
  epsilon?: number;
  /** Drop islands and holes smaller than this many square pixels. */
  minArea?: number;
  /** Keep inner cut-outs (letter counters, windows). */
  holes?: boolean;
}

export interface Traced {
  /** Outline space: y up, standing on y = 0, height 1. */
  outline: MultiPoly;
  aspect: number;
}

// Cell edges: 0 top, 1 right, 2 bottom, 3 left. Corner bits: tl=1, tr=2, br=4, bl=8.
const SEGMENTS: number[][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [], [[0, 2]], [[3, 2]],
  [[2, 3]], [[2, 0]], [], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], [],
];

/** Trace a coverage mask (0–255, row 0 at the top) into pixel-space rings. */
export function contourRings(mask: ArrayLike<number>, w: number, h: number, iso = 128): Ring[] {
  const W = w + 2;
  const val = (i: number, j: number) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : mask[j * w + i]);
  const hKey = (i: number, j: number) => ((j + 1) * W + (i + 1)) * 2;
  const vKey = (i: number, j: number) => ((j + 1) * W + (i + 1)) * 2 + 1;

  const pts = new Map<number, Pt>();
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  const lerp = (a: number, b: number) => (iso - a) / (b - a);

  for (let j = -1; j < h; j++) {
    for (let i = -1; i < w; i++) {
      const tl = val(i, j);
      const tr = val(i + 1, j);
      const br = val(i + 1, j + 1);
      const bl = val(i, j + 1);
      const code = (tl >= iso ? 1 : 0) | (tr >= iso ? 2 : 0) | (br >= iso ? 4 : 0) | (bl >= iso ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const keys = [hKey(i, j), vKey(i + 1, j), hKey(i, j + 1), vKey(i, j)];
      const edgePt = (e: number): Pt => {
        // sample centres sit at +0.5 px
        if (e === 0) return [i + 0.5 + lerp(tl, tr), j + 0.5];
        if (e === 1) return [i + 1.5, j + 0.5 + lerp(tr, br)];
        if (e === 2) return [i + 0.5 + lerp(bl, br), j + 1.5];
        return [i + 0.5, j + 0.5 + lerp(tl, bl)];
      };
      let segs = SEGMENTS[code];
      if (code === 5 || code === 10) {
        const joined = (tl + tr + br + bl) / 4 >= iso;
        if (code === 5) segs = joined ? [[3, 2], [0, 1]] : [[3, 0], [1, 2]];
        else segs = joined ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
      }
      for (const [a, b] of segs) {
        if (!pts.has(keys[a])) pts.set(keys[a], edgePt(a));
        if (!pts.has(keys[b])) pts.set(keys[b], edgePt(b));
        link(keys[a], keys[b]);
      }
    }
  }

  const rings: Ring[] = [];
  const seen = new Set<number>();
  for (const start of pts.keys()) {
    if (seen.has(start)) continue;
    const ring: Ring = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      ring.push(pts.get(cur)!);
      const next = (links.get(cur) ?? []).find((k) => k !== prev && !seen.has(k));
      if (next === undefined) break;
      prev = cur;
      cur = next;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/** Group rings into polygons-with-holes by nesting depth (even-odd). */
export function nestRings(rings: Ring[], holes = true): MultiPoly {
  const items = rings
    .map((ring) => ({ ring, area: Math.abs(ringArea(ring)), depth: 0, parent: -1 }))
    .sort((a, b) => b.area - a.area);
  for (let i = 0; i < items.length; i++) {
    for (let k = i - 1; k >= 0; k--) {
      // smallest enclosing ring = nearest larger ring that contains us
      if (pointInRing(items[i].ring[0], items[k].ring)) {
        if (items[i].parent < 0 || items[k].area < items[items[i].parent].area) items[i].parent = k;
      }
    }
    if (items[i].parent >= 0) items[i].depth = items[items[i].parent].depth + 1;
  }
  const polys = new Map<number, Ring[]>();
  items.forEach((it, i) => {
    if (it.depth % 2 === 0) polys.set(i, [it.ring]);
  });
  if (holes)
    items.forEach((it) => {
      if (it.depth % 2 === 1) polys.get(it.parent)?.push(it.ring);
    });
  return [...polys.values()];
}

/** Scale a pixel-space multipolygon into outline space. */
export function normalise(mp: MultiPoly): Traced {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of mp)
    for (const [x, y] of poly[0]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const H = maxY - minY || 1;
  const outline = mp.map((poly) =>
    poly.map((ring) =>
      ring.map(([x, y]): Pt => {
        const ny = (maxY - y) / H;
        // flatten the foot so it becomes one clean fold line
        return [(x - minX) / H, ny < 0.006 ? 0 : ny];
      }),
    ),
  );
  return { outline, aspect: (maxX - minX) / H };
}

export function traceMask(
  mask: ArrayLike<number>,
  w: number,
  h: number,
  opts: TraceOptions = {},
): Traced | null {
  const { epsilon = 0.45, minArea = 12, holes = true } = opts;
  const rings = contourRings(mask, w, h)
    .filter((r) => Math.abs(ringArea(r)) >= minArea)
    .map((r) => simplifyRing(r, epsilon))
    .filter((r) => r.length >= 3);
  const mp = nestRings(rings, holes);
  if (!mp.length) return null;
  return normalise(mp);
}
