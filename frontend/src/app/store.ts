import { useMemo } from 'react';
import { create } from 'zustand';
import { buildCard, elementWidth } from '../core/build';
import type { Traced } from '../core/trace';
import type { CardModel, CardSpec, Design, PopElement } from '../core/types';
import { LIMITS } from '../core/types';

export const PALETTE = ['#e5484d', '#f5a524', '#30a46c', '#3e63dd', '#8e4ec6', '#e93d82', '#12a594', '#f76b15'];

export const CARD_PRESETS = [
  { id: 'a6', name: 'A6 (A5 sheet)', widthMm: 148, panelMm: 105 },
  { id: '5x7', name: '5 × 7 in', widthMm: 178, panelMm: 127 },
  { id: 'a5', name: 'A5 (A4 sheet)', widthMm: 210, panelMm: 148 },
  { id: 'square', name: 'Square 130', widthMm: 130, panelMm: 130 },
] as const;

export const DEFAULT_CARD: CardSpec = {
  widthMm: 148,
  panelMm: 105,
  color: '#fbfaf5',
  backing: true,
  backingColor: '#2f4b7c',
};

let seq = 0;
export const newId = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

const errorCount = (d: Design) => buildCard(d, true).issues.filter((i) => i.severity === 'error').length;

const OFFSETS = [0, -0.5, 0.5, -1, 1, -0.75, 0.75, -0.25, 0.25, -0.88, 0.88, -0.62, 0.62, -0.38, 0.38, -0.12, 0.12];

/** Nudge support positions until tabs sit side by side and struts clear the pieces behind them. */
export function resolveSupports(design: Design): Design {
  let d = design;
  let n = errorCount(d);
  for (let round = 0; round < 16 && n > 0; round++) {
    let best = d;
    let bestN = n;
    // try the elements nearest the viewer first: they have the longest tabs and the most freedom
    const order = [...d.elements].sort((a, b) => b.depthMm - a.depthMm);
    for (const el of order) {
      // a low tab is the second resort: it keeps the piece but changes how it is held
      const tabs = el.mode === 'glued' && !el.lowTab ? [false, true] : [!!el.lowTab];
      for (const lowTab of tabs) {
        for (const off of OFFSETS) {
          if (off === el.supportOffset && lowTab === !!el.lowTab) continue;
          const cand = { ...d, elements: d.elements.map((e) => (e.id === el.id ? { ...e, supportOffset: off, lowTab } : e)) };
          const k = errorCount(cand);
          if (k < bestN) {
            best = cand;
            bestN = k;
          }
        }
        if (bestN < n) break;
      }
      if (bestN < n) break;
    }
    if (best === d) break;
    d = best;
    n = bestN;
  }
  return d;
}

/** Find a free spot for a new element: first position with no errors wins. */
function tryPlace(design: Design, t: Traced, name: string, mode: PopElement['mode'], shrink: number): { el: PopElement; score: number } {
  const { widthMm: W, panelMm: P } = design.card;
  let height = Math.min(45, P * 0.4) * shrink;
  if (height * t.aspect > W - 16) height = (W - 16) / t.aspect;
  const base: PopElement = {
    id: newId(),
    name,
    outline: t.outline,
    aspect: t.aspect,
    xMm: W / 2,
    depthMm: 25,
    heightMm: Math.max(LIMITS.minHeight, Math.round(height)),
    mode,
    supportOffset: 0,
    supportWidthMm: 8,
    color: PALETTE[design.elements.length % PALETTE.length],
  };
  const w = elementWidth(base);
  base.supportWidthMm = Math.round(Math.max(5, Math.min(12, w * 0.3)));
  const maxDepth = P - LIMITS.edge - base.heightMm - 1;
  const depths = [25, 42, 14, 56, 34, 20, 48, 30].filter((d) => d <= maxDepth);
  if (!depths.length) depths.push(Math.max(LIMITS.minDepth, maxDepth));
  const lo = w / 2 + 4;
  const hi = W - w / 2 - 4;
  const xs = hi > lo ? [0.5, 0.2, 0.8, 0.35, 0.65, 0.05, 0.95].map((f) => lo + (hi - lo) * f) : [W / 2];
  // First spot with nothing to complain about wins; otherwise take the least bad one.
  let best = { ...base, depthMm: depths[0] };
  let bestScore = Infinity;
  const started = Date.now();
  search: for (const depthMm of depths)
    for (const xMm of xs)
      for (const supportOffset of [0, -0.7, 0.7, -0.35, 0.35]) {
        const cand = { ...base, depthMm, xMm: Math.round(xMm), supportOffset };
        const issues = buildCard({ ...design, elements: [...design.elements, cand] }, true).issues;
        const score = issues.reduce((n, i) => n + (i.severity === 'error' ? 10 : 1), 0);
        if (score < bestScore) {
          best = cand;
          bestScore = score;
        }
        if (score === 0 || Date.now() - started > 500) break search;
      }
  return { el: best, score: bestScore };
}

/** Find a free spot for a new element; on a crowded card, try it smaller before giving up. */
export function placeElement(design: Design, t: Traced, name: string, mode: PopElement['mode'] = 'glued'): PopElement {
  let best = tryPlace(design, t, name, mode, 1);
  for (const shrink of [0.7, 0.5]) {
    if (best.score === 0) break;
    const next = tryPlace(design, t, name, mode, shrink);
    if (next.score < best.score) best = next;
  }
  return best.el;
}

export type View = '2d' | '3d' | 'export';
export type Unit = 'mm' | 'in';

interface State {
  design: Design;
  selectedId: string | null;
  view: View;
  unit: Unit;
  /** Card opening angle: 180 flat, 90 displayed, 0 closed. */
  openDeg: number;
  /** Bumped to ask the 3D view to play the opening animation. */
  playNonce: number;
  play: () => void;
  past: Design[];
  future: Design[];
  lastKey: string;
  lastAt: number;
  setView: (v: View) => void;
  setUnit: (u: Unit) => void;
  setOpenDeg: (d: number) => void;
  select: (id: string | null) => void;
  /** Apply a change with undo. Edits sharing a `key` within a second collapse into one step. */
  mutate: (key: string, fn: (d: Design) => Design) => void;
  setCard: (patch: Partial<CardSpec>) => void;
  updateElement: (id: string, patch: Partial<PopElement>) => void;
  addTraced: (t: Traced, name: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  reorder: (id: string, dir: -1 | 1) => void;
  load: (d: Design) => void;
  undo: () => void;
  redo: () => void;
}

const STORAGE = 'popup-card-design-v1';
function loadSaved(): Design | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const d = JSON.parse(raw) as Design;
    if (d?.card?.widthMm && Array.isArray(d.elements)) return d;
  } catch {
    /* storage unavailable (sandboxed frame, private mode) — start fresh */
  }
  return null;
}

export const useStore = create<State>((set, get) => ({
  design: loadSaved() ?? { card: DEFAULT_CARD, elements: [] },
  selectedId: null,
  view: '3d',
  unit: 'mm',
  openDeg: 90,
  playNonce: 0,
  play: () => set((s) => ({ playNonce: s.playNonce + 1, view: '3d' })),
  past: [],
  future: [],
  lastKey: '',
  lastAt: 0,
  setView: (view) => set({ view }),
  setUnit: (unit) => set({ unit }),
  setOpenDeg: (openDeg) => set({ openDeg: Math.max(0, Math.min(180, openDeg)) }),
  select: (selectedId) => set({ selectedId }),
  mutate: (key, fn) =>
    set((s) => {
      const design = fn(s.design);
      if (design === s.design) return s;
      const now = Date.now();
      const merge = key !== '' && key === s.lastKey && now - s.lastAt < 1000;
      return {
        design,
        past: merge ? s.past : [...s.past.slice(-60), s.design],
        future: [],
        lastKey: key,
        lastAt: now,
      };
    }),
  setCard: (patch) => get().mutate(`card:${Object.keys(patch).join()}`, (d) => ({ ...d, card: { ...d.card, ...patch } })),
  updateElement: (id, patch) =>
    get().mutate(`el:${id}:${Object.keys(patch).join()}`, (d) => ({
      ...d,
      elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),
  addTraced: (t, name) => {
    const el = placeElement(get().design, t, name);
    get().mutate('', (d) => ({ ...d, elements: [...d.elements, el] }));
    set({ selectedId: el.id });
  },
  duplicate: (id) => {
    const src = get().design.elements.find((e) => e.id === id);
    if (!src) return;
    const W = get().design.card.widthMm;
    const copy: PopElement = { ...src, id: newId(), name: `${src.name} copy`, xMm: Math.min(W - 10, src.xMm + 14) };
    get().mutate('', (d) => ({ ...d, elements: [...d.elements, copy] }));
    set({ selectedId: copy.id });
  },
  remove: (id) => {
    get().mutate('', (d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    if (get().selectedId === id) set({ selectedId: null });
  },
  reorder: (id, dir) =>
    get().mutate('', (d) => {
      const i = d.elements.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.elements.length) return d;
      const elements = d.elements.slice();
      [elements[i], elements[j]] = [elements[j], elements[i]];
      return { ...d, elements };
    }),
  load: (design) => {
    get().mutate('', () => design);
    set({ selectedId: null });
  },
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { design: prev, past: s.past.slice(0, -1), future: [s.design, ...s.future], lastKey: '' };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return { design: next, past: [...s.past, s.design], future: s.future.slice(1), lastKey: '' };
    }),
}));

let saveTimer = 0;
useStore.subscribe((s, prev) => {
  if (s.design === prev.design) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(s.design));
    } catch {
      /* ignore */
    }
  }, 400);
});

let cacheKey: Design | null = null;
let cacheVal: CardModel | null = null;
export function modelOf(design: Design): CardModel {
  if (cacheKey !== design || !cacheVal) {
    cacheKey = design;
    cacheVal = buildCard(design);
  }
  return cacheVal;
}
export function useModel(): CardModel {
  const design = useStore((s) => s.design);
  return useMemo(() => modelOf(design), [design]);
}

export const MM_PER_IN = 25.4;
export const fmtLen = (mm: number, unit: Unit) => (unit === 'mm' ? `${Math.round(mm * 10) / 10}` : (mm / MM_PER_IN).toFixed(2));
