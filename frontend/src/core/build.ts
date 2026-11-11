/**
 * Design → CardModel: the single geometry source. The 2D editor, the 3D
 * preview and the exported file all read the model this returns.
 */
import {
  area,
  bbox,
  difference,
  intersection,
  mergeIntervals,
  pointInPoly,
  rect,
  scanline,
  subtractIntervals,
  transform,
  union,
} from './geom';
import { LIMITS } from './types';
import type {
  BBox,
  CardModel,
  Design,
  Issue,
  LoosePiece,
  MultiPoly,
  Part,
  PatternLine,
  PopElement,
  Pt,
} from './types';

const EPS = 1e-4;

interface Built {
  el: PopElement;
  /** Support column x-range. */
  c1: number;
  c2: number;
  /** Height at which the strut leaves the front face. */
  strut: number;
  /** Front-face region cut from the card (fused: silhouette + pillar; glued: the tab front). */
  front: MultiPoly;
  bridge: MultiPoly;
  /** Glued piece at its lying-down position, flat space. */
  piece: MultiPoly | null;
  /** Everything this element removes from the card sheet. */
  footprint: MultiPoly;
  /** Total standing height including any pillar. */
  top: number;
  ok: boolean;
  /** Footprint grown by the tab clearance, for the "same paper" test. */
  grown: MultiPoly;
  /** Slotted versions of the piece, keyed by the slot rectangles. */
  slotted: Map<string, MultiPoly | null>;
}

// Polygon booleans are the expensive part, and during a drag or an auto-placement search
// only one element changes. Elements are immutable, so cache by identity.
const builtCache = new WeakMap<PopElement, Built>();
interface PairResult {
  issues: Issue[];
  /** Slots to open in a back piece: [element id, x1, x2, top y (flat)] */
  slots: [string, number, number, number][];
}
const pairCache = new WeakMap<Built, WeakMap<Built, PairResult>>();

export function elementWidth(el: Pick<PopElement, 'heightMm' | 'aspect'>): number {
  return el.heightMm * el.aspect;
}

function buildElement(el: PopElement): Built {
  const hit = builtCache.get(el);
  if (hit) return hit;
  const b = computeElement(el);
  builtCache.set(el, b);
  return b;
}

function computeElement(el: PopElement): Built {
  const d = el.depthMm;
  const w = elementWidth(el);
  const x0 = el.xMm - w / 2;
  const shape = transform(el.outline, el.heightMm, x0, -d);

  const sw = Math.min(Math.max(el.supportWidthMm, LIMITS.minSupport), Math.max(LIMITS.minSupport, w));
  const travel = Math.max(0, w / 2 - sw / 2);
  const cx = el.xMm + Math.max(-1, Math.min(1, el.supportOffset)) * travel;
  const c1 = cx - sw / 2;
  const c2 = cx + sw / 2;

  // Highest point of the silhouette inside the support column.
  const inColumn = intersection(shape, rect(c1, -d - 1, c2, -d + el.heightMm + 1));
  const colTop = inColumn.length ? bbox(inColumn).maxY + d : 0;

  let strut: number;
  if (el.mode === 'fused') {
    // The strut leaves from the very top of the column so nothing of the
    // silhouette has to be sacrificed for it.
    strut = Math.max(colTop, 5);
  } else {
    // A hidden box tab: as tall as it is deep when the piece covers it
    // (then its top fold lands on the centre fold and scissors can cut it
    // from the folded edge), otherwise just short of the piece's top.
    strut = Math.max(5, Math.min(d, colTop > 8 ? colTop - 3 : d));
  }

  const pillar = rect(c1, -d, c2, -d + strut);
  const bridge = rect(c1, -d + strut, c2, strut);

  // Keep only the part of the silhouette that is physically connected to the support.
  const joined = union(shape, pillar);
  const probe: Pt = [cx, -d + Math.min(strut, 2) / 2];
  const main = joined.find((poly) => pointInPoly(probe, poly));
  const body: MultiPoly = main ? [main] : pillar;

  let front: MultiPoly;
  let piece: MultiPoly | null = null;
  if (el.mode === 'fused') {
    front = body;
  } else {
    front = pillar;
    piece = body;
  }
  const footprint = el.mode === 'fused' ? union(front, bridge) : rect(c1, -d, c2, strut);
  const top = bbox(body).maxY + d;
  const g = LIMITS.gap / 2;
  const grown =
    el.mode === 'fused' ? union(front, rect(c1 - g, -d + strut, c2 + g, strut)) : rect(c1 - g, -d - g, c2 + g, strut + g);
  return { el, c1, c2, strut, front, bridge, piece, footprint, top, ok: !!main && inColumn.length > 0, grown, slotted: new Map() };
}

/** Chain consecutive points into open polylines, breaking where `keep` is false. */
function ringLines(
  ring: Pt[],
  classify: (a: Pt, b: Pt) => { kind: 'cut' | 'valley' | 'skip'; parts?: [Pt, Pt][] },
  elementId: string,
  out: PatternLine[],
) {
  const n = ring.length;
  const edges = ring.map((a, i) => ({ a, b: ring[(i + 1) % n], c: classify(a, ring[(i + 1) % n]) }));
  // start at a break so a run never wraps around the array end
  const start = edges.findIndex((e) => e.c.kind !== 'cut' || e.c.parts);
  if (start < 0) {
    out.push({ kind: 'cut', points: ring.slice(), closed: true, elementId });
    return;
  }
  let run: Pt[] = [];
  const flush = () => {
    if (run.length > 1) out.push({ kind: 'cut', points: run, closed: false, elementId });
    run = [];
  };
  for (let k = 0; k < n; k++) {
    const e = edges[(start + k) % n];
    if (e.c.kind === 'cut' && !e.c.parts) {
      if (!run.length) run.push(e.a);
      run.push(e.b);
      continue;
    }
    flush();
    if (e.c.kind === 'valley') out.push({ kind: 'valley', points: [e.a, e.b], closed: false, elementId });
    for (const [p, q] of e.c.parts ?? []) out.push({ kind: 'cut', points: [p, q], closed: false, elementId });
  }
  flush();
}

function elementLines(b: Built, out: PatternLine[]) {
  const { el, c1, c2, strut } = b;
  const d = el.depthMm;
  const id = el.id;
  const yFloor = -d;
  const yMount = -d + strut;
  const yWall = strut;
  const near = (v: number, t: number) => Math.abs(v - t) < EPS;

  // Strut: two fold lines and two cut sides.
  out.push({ kind: 'mountain', points: [[c1, yMount], [c2, yMount]], closed: false, elementId: id });
  out.push({ kind: 'valley', points: [[c1, yWall], [c2, yWall]], closed: false, elementId: id });

  if (el.mode === 'glued') {
    out.push({ kind: 'valley', points: [[c1, yFloor], [c2, yFloor]], closed: false, elementId: id });
    out.push({ kind: 'cut', points: [[c1, yFloor], [c1, yWall]], closed: false, elementId: id });
    out.push({ kind: 'cut', points: [[c2, yFloor], [c2, yWall]], closed: false, elementId: id });
    return;
  }

  // Strut sides. Where the silhouette runs alongside, the same cut also frees the silhouette.
  out.push({ kind: 'cut', points: [[c1, yMount], [c1, yWall]], closed: false, elementId: id });
  out.push({ kind: 'cut', points: [[c2, yMount], [c2, yWall]], closed: false, elementId: id });

  for (const poly of b.front)
    for (const ring of poly)
      ringLines(
        ring,
        (p, q) => {
          // floor crease: the foot of the silhouette
          if (near(p[1], yFloor) && near(q[1], yFloor)) return { kind: 'valley' };
          // top of the pillar: already drawn as the strut's mountain fold
          if (near(p[1], yMount) && near(q[1], yMount)) {
            const lo = Math.min(p[0], q[0]);
            const hi = Math.max(p[0], q[0]);
            if (hi > c1 + EPS && lo < c2 - EPS) {
              const rest = subtractIntervals(lo, hi, [[c1, c2]]);
              return { kind: 'skip', parts: rest.map(([u, v]) => [[u, yMount], [v, yMount]] as [Pt, Pt]) };
            }
          }
          // an edge running up the strut's side: drop the overlap, keep the rest
          for (const cx of [c1, c2]) {
            if (near(p[0], cx) && near(q[0], cx)) {
              const lo = Math.min(p[1], q[1]);
              const hi = Math.max(p[1], q[1]);
              if (hi > yMount + EPS && lo < yWall - EPS) {
                const rest = subtractIntervals(lo, hi, [[yMount, yWall]]);
                return { kind: 'skip', parts: rest.map(([u, v]) => [[cx, u], [cx, v]] as [Pt, Pt]) };
              }
            }
          }
          return { kind: 'cut' };
        },
        id,
        out,
      );
}

function checkPair(A: Built, B: Built): PairResult {
  let inner = pairCache.get(A);
  if (!inner) pairCache.set(A, (inner = new WeakMap()));
  const hit = inner.get(B);
  if (hit) return hit;
  const res = computePair(A, B);
  inner.set(B, res);
  return res;
}

function computePair(A: Built, B: Built): PairResult {
  const issues: Issue[] = [];
  const slots: PairResult['slots'] = [];
  const fa = bbox(A.grown);
  const fb = bbox(B.grown);
  const apart = fa.maxX < fb.minX || fb.maxX < fa.minX || fa.maxY < fb.minY || fb.maxY < fa.minY;
  if (!apart && area(intersection(A.grown, B.grown)) > 0.05) {
    const bothTabs = A.el.mode === 'glued' && B.el.mode === 'glued';
    issues.push({
      severity: 'error',
      elementId: B.el.id,
      message: `${A.el.name} and ${B.el.name} need the same paper.`,
      fix: bothTabs
        ? 'Slide one sideways, or move its “Support position” so the two tabs sit side by side.'
        : 'Slide one sideways — or switch the front one to “Glue-on” and offset its support.',
    });
    return { issues, slots };
  }

  const pa = A.piece ?? A.front;
  const pb = B.piece ?? B.front;
  const ba = bbox(pa);
  const bb = bbox(pb);
  const xOverlap = ba.maxX > bb.minX && bb.maxX > ba.minX;

  // Two pieces standing in the same plane would have to occupy the same space.
  if (xOverlap && Math.abs(A.el.depthMm - B.el.depthMm) < 2) {
    // compare in "standing" coordinates so a small depth difference does not hide the clash
    const shifted = transform(pb, 1, 0, B.el.depthMm - A.el.depthMm);
    if (area(intersection(pa, shifted)) > 1)
      issues.push({
        severity: 'warning',
        elementId: B.el.id,
        message: `${A.el.name} and ${B.el.name} stand in the same spot.`,
        fix: 'Move one of them nearer or farther from the wall (at least 2 mm apart), or slide it sideways.',
      });
  }

  // A strut travelling back to the wall crosses every piece standing behind it at a
  // constant height (the strut's own height), whatever the opening angle. Give the back
  // piece a slot, open at the foot, so it can be slid down over the strut.
  for (const [front, back] of [
    [A, B],
    [B, A],
  ] as const) {
    if (front.el.depthMm <= back.el.depthMm + EPS || !back.piece) continue;
    const y = front.strut - back.el.depthMm;
    const pbb = back === A ? ba : bb;
    if (front.c2 < pbb.minX || front.c1 > pbb.maxX || y - 0.5 > pbb.maxY) continue;
    const hitArea = area(intersection(back.piece, rect(front.c1, y - 0.5, front.c2, y + 0.5)));
    if (hitArea > 0.05) slots.push([back.el.id, front.c1, front.c2, y]);
  }
  return { issues, slots };
}

const inside = (b: BBox, card: { widthMm: number; panelMm: number }, m: number) =>
  b.minX >= m - EPS && b.maxX <= card.widthMm - m + EPS && b.minY >= -card.panelMm + m - EPS && b.maxY <= card.panelMm - m + EPS;

/**
 * `quick` skips the sheet geometry and returns only what the checks need — used when
 * searching for a free spot, where dozens of candidates are tried.
 */
export function buildCard(design: Design, quick = false): CardModel {
  const { card } = design;
  const W = card.widthMm;
  const P = card.panelMm;
  const built = design.elements.map(buildElement);
  const issues: Issue[] = [];
  const lines: PatternLine[] = [];
  const parts: Part[] = [];
  const pieces: LoosePiece[] = [];
  const footprints: CardModel['footprints'] = {};

  // ── per-element checks ────────────────────────────────────────────────
  for (const b of built) {
    const { el } = b;
    const name = el.name;
    const fp = bbox(b.footprint);
    const body = b.piece ?? b.front;
    const bb = bbox(body);
    footprints[el.id] = {
      region: b.piece ? [...b.piece, ...b.footprint] : b.footprint,
      bbox: { minX: Math.min(bb.minX, fp.minX), minY: Math.min(bb.minY, fp.minY), maxX: Math.max(bb.maxX, fp.maxX), maxY: Math.max(bb.maxY, fp.maxY) },
      support: { minX: b.c1, maxX: b.c2, minY: -el.depthMm, maxY: b.strut },
    };

    if (!b.ok)
      issues.push({
        severity: 'error',
        elementId: el.id,
        message: `${name}: the support misses the shape.`,
        fix: 'Slide “Support position” until the support sits under a solid part of the shape.',
      });
    if (el.depthMm + b.top > P - LIMITS.edge + EPS)
      issues.push({
        severity: 'error',
        elementId: el.id,
        message: `${name} would stick out of the closed card by ${(el.depthMm + b.top - (P - LIMITS.edge)).toFixed(0)} mm.`,
        fix: 'Make it shorter or move it closer to the back wall — depth + height must fit inside one panel.',
      });
    else if (!inside(fp, card, LIMITS.edge))
      issues.push({
        severity: 'error',
        elementId: el.id,
        message: `${name}: the cut reaches the edge of the card.`,
        fix: 'Move it away from the edge or make it smaller.',
      });
    if (bb.minX < -EPS || bb.maxX > W + EPS)
      issues.push({
        severity: el.mode === 'fused' ? 'error' : 'warning',
        elementId: el.id,
        message: `${name} is wider than the card at that position.`,
        fix: 'Move it toward the middle or make it smaller.',
      });
    if (el.mode === 'fused' && area(b.front) < area(transform(el.outline, el.heightMm, 0, 0)) * 0.6)
      issues.push({
        severity: 'warning',
        elementId: el.id,
        message: `${name} has separate islands; only the part on the support is cut.`,
        fix: 'Switch it to “Glue-on”, or use a shape that is one connected piece.',
      });
  }

  // ── pairwise checks ───────────────────────────────────────────────────
  const slots = new Map<string, [number, number, number][]>();
  for (let i = 0; i < built.length; i++)
    for (let j = i + 1; j < built.length; j++) {
      const r = checkPair(built[i], built[j]);
      issues.push(...r.issues);
      for (const [id, x1, x2, y] of r.slots) slots.set(id, [...(slots.get(id) ?? []), [x1, x2, y]]);
    }

  // Open the slots. A piece must stay in one part and stay on its own tab.
  const pieceOf = new Map<Built, MultiPoly | null>();
  for (const b of built) {
    const list = slots.get(b.el.id);
    if (!b.piece || !list) {
      pieceOf.set(b, b.piece);
      continue;
    }
    const key = list.map((v) => v.map((n) => n.toFixed(2)).join()).join('|');
    let cut = b.slotted.get(key);
    if (cut === undefined) {
      const yFoot = -b.el.depthMm;
      const res = difference(b.piece, ...list.map(([x1, x2, y]) => rect(x1 - 0.75, yFoot - 1, x2 + 0.75, y + 1)));
      const probe: Pt = [(b.c1 + b.c2) / 2, yFoot + 1];
      cut = res.length === 1 && pointInPoly(probe, res[0]) ? res : null;
      b.slotted.set(key, cut);
    }
    if (cut) pieceOf.set(b, cut);
    else {
      pieceOf.set(b, b.piece);
      issues.push({
        severity: 'error',
        elementId: b.el.id,
        message: `A support in front of ${b.el.name} would cut it in two.`,
        fix: `Slide ${b.el.name} sideways, or move the “Support position” of the element in front of it.`,
      });
    }
  }

  // ── card sheet: panels with every moving region removed ───────────────
  const holes = built.map((b) => b.footprint);
  const floorRect = rect(0, -P, W, 0);
  const wallRect = rect(0, 0, W, P);
  let floor = floorRect;
  let wall = wallRect;
  if (quick) return { card, parts, lines, pieces, issues, footprints };
  try {
    floor = difference(floorRect, ...holes);
    wall = difference(wallRect, ...holes);
  } catch {
    /* keep solid panels; overlaps are already reported above */
  }
  const base = { depth: 0, strut: 0 };
  parts.push({ role: 'floor', region: floor, color: card.color, layer: 0, ...base });
  parts.push({ role: 'wall', region: wall, color: card.color, layer: 0, ...base });
  if (card.backing) {
    const m = LIMITS.backingMargin;
    parts.push({ role: 'backFloor', region: rect(-m, -P - m, W + m, 0), color: card.backingColor, layer: -1, ...base });
    parts.push({ role: 'backWall', region: rect(-m, 0, W + m, P + m), color: card.backingColor, layer: -1, ...base });
  }

  // ── lines ─────────────────────────────────────────────────────────────
  lines.push({ kind: 'cut', points: [[0, -P], [W, -P], [W, P], [0, P]], closed: true });
  const covered = mergeIntervals(
    built.flatMap((b) => [
      [b.c1, b.c2] as [number, number],
      ...(b.el.mode === 'fused' ? scanline(b.front, EPS * 3) : []),
    ]),
  );
  for (const [a, c] of subtractIntervals(0, W, covered))
    lines.push({ kind: 'valley', points: [[a, 0], [c, 0]], closed: false });

  for (const b of built) {
    const { el } = b;
    elementLines(b, lines);
    const common = { elementId: el.id, depth: el.depthMm, strut: b.strut };
    parts.push({ role: 'front', region: b.front, color: card.color, layer: 0, ...common });
    parts.push({ role: 'bridge', region: b.bridge, color: card.color, layer: 0, ...common });
    const piece = pieceOf.get(b);
    if (piece) {
      parts.push({ role: 'piece', region: piece, color: el.color, layer: 1, ...common });
      pieces.push({ elementId: el.id, name: el.name, color: el.color, region: piece });
    }
  }

  return { card, parts, lines, pieces, issues, footprints };
}

export const hasErrors = (m: CardModel) => m.issues.some((i) => i.severity === 'error');
