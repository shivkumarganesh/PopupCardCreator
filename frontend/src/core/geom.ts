/** Polygon helpers. Booleans are delegated to polyclip-ts. */
import * as pc from 'polyclip-ts';
import type { BBox, MultiPoly, Poly, Pt, Ring } from './types';

type Geom = Parameters<typeof pc.union>[0];

const snap = (v: number) => Math.round(v * 1e4) / 1e4;

function clean(mp: [number, number][][][]): MultiPoly {
  const out: MultiPoly = [];
  for (const poly of mp) {
    const rings: Ring[] = [];
    for (const ring of poly) {
      const r: Ring = [];
      for (const [x, y] of ring) {
        const p: Pt = [snap(x), snap(y)];
        const last = r[r.length - 1];
        if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) r.push(p);
      }
      if (r.length > 1) {
        const a = r[0];
        const b = r[r.length - 1];
        if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) r.pop();
      }
      if (r.length >= 3 && Math.abs(ringArea(r)) > 1e-6) rings.push(r);
      else if (rings.length === 0) break; // degenerate outer ring: drop the polygon
    }
    if (rings.length) out.push(rings);
  }
  return out;
}

const asGeom = (mp: MultiPoly) => mp as unknown as Geom;

export function union(...mps: MultiPoly[]): MultiPoly {
  const parts = mps.filter((m) => m.length);
  if (!parts.length) return [];
  if (parts.length === 1) return clean(pc.union(asGeom(parts[0])) as never);
  return clean(pc.union(asGeom(parts[0]), ...parts.slice(1).map(asGeom)) as never);
}
export function intersection(a: MultiPoly, b: MultiPoly): MultiPoly {
  if (!a.length || !b.length) return [];
  return clean(pc.intersection(asGeom(a), asGeom(b)) as never);
}
export function difference(a: MultiPoly, ...bs: MultiPoly[]): MultiPoly {
  const subs = bs.filter((m) => m.length);
  if (!a.length) return [];
  if (!subs.length) return a;
  return clean(pc.difference(asGeom(a), ...subs.map(asGeom)) as never);
}

export function rect(x1: number, y1: number, x2: number, y2: number): MultiPoly {
  return [[[
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]]];
}
export const bboxRect = (b: BBox, grow = 0): MultiPoly =>
  rect(b.minX - grow, b.minY - grow, b.maxX + grow, b.maxY + grow);

export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return a / 2;
}
export const polyArea = (p: Poly) =>
  Math.abs(ringArea(p[0])) - p.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);
export const area = (mp: MultiPoly) => mp.reduce((s, p) => s + polyArea(p), 0);

export function bbox(mp: MultiPoly): BBox {
  const b: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const poly of mp)
    for (const [x, y] of poly[0]) {
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
    }
  return b;
}

export function mapPts(mp: MultiPoly, f: (p: Pt) => Pt): MultiPoly {
  return mp.map((poly) => poly.map((ring) => ring.map(f)));
}
export const transform = (mp: MultiPoly, scale: number, dx: number, dy: number): MultiPoly =>
  mapPts(mp, ([x, y]) => [x * scale + dx, y * scale + dy]);

export function pointInRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const pointInPoly = (p: Pt, poly: Poly) =>
  pointInRing(p, poly[0]) && !poly.slice(1).some((h) => pointInRing(p, h));
export const pointInMulti = (p: Pt, mp: MultiPoly) => mp.some((poly) => pointInPoly(p, poly));

/** Sorted, merged x-intervals where the horizontal line at `y` is inside `mp`. */
export function scanline(mp: MultiPoly, y: number): [number, number][] {
  const xs: number[] = [];
  for (const poly of mp)
    for (const r of poly)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return mergeIntervals(out);
}

export function mergeIntervals(iv: [number, number][], tol = 1e-6): [number, number][] {
  const s = iv.filter(([a, b]) => b - a > tol).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + tol) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** [a, b] minus the given intervals. */
export function subtractIntervals(a: number, b: number, cuts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let cur = a;
  for (const [c1, c2] of mergeIntervals(cuts)) {
    if (c2 <= cur) continue;
    if (c1 >= b) break;
    if (c1 > cur) out.push([cur, Math.min(c1, b)]);
    cur = Math.max(cur, c2);
    if (cur >= b) break;
  }
  if (cur < b) out.push([cur, b]);
  return out.filter(([p, q]) => q - p > 1e-6);
}

/** Ramer–Douglas–Peucker on a closed ring. */
export function simplifyRing(ring: Ring, eps: number): Ring {
  if (ring.length < 5) return ring;
  // Split at the two mutually farthest-ish points so both halves are open polylines.
  let far = 0;
  let best = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = rdp(ring.slice(0, far + 1), eps);
  const b = rdp([...ring.slice(far), ring[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function rdp(pts: Pt[], eps: number): Pt[] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let idx = -1;
    let max = eps;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
