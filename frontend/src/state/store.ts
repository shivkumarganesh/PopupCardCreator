import { create } from 'zustand';
import type { CardParams, Mechanism } from '../core/types';

let idCounter = 0;
const newId = () => `m${++idCounter}`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Create a step fold at a free position along the gutter, so adding several
 * in a row staggers them instead of stacking identical (colliding) folds.
 */
function defaultParallelFold(card: CardParams, existing: Mechanism[]): Mechanism {
  const spanMm = Math.min(60, card.heightMm * 0.4);
  const depthMm = Math.min(30, card.panelWidthMm * 0.4);
  const occupied = existing
    .filter((m) => m.type === 'parallelFold')
    .map((m) => [m.centreMm - m.spanMm / 2, m.centreMm + m.spanMm / 2] as const);

  const step = spanMm * 1.2 + 10;
  const lo = spanMm / 2;
  const hi = card.heightMm - spanMm / 2;
  let centreMm = card.heightMm / 2;
  for (let i = 0; i <= existing.length; i++) {
    const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * step;
    const c = clamp(card.heightMm / 2 + offset, lo, hi);
    const clear = !occupied.some(([a, b]) => c - spanMm / 2 < b && a < c + spanMm / 2);
    if (clear) {
      centreMm = c;
      break;
    }
  }

  return { id: newId(), type: 'parallelFold', centreMm, spanMm, depthMm };
}

function defaultVFold(card: CardParams): Mechanism {
  return {
    id: newId(),
    type: 'vFold',
    mount: 'glued',
    centreMm: card.heightMm / 2,
    flipped: false,
    symmetric: true,
    baseAngleDeg: 45,
    popupAngleDeg: 60,
    baseAngleRightDeg: 45,
    popupAngleRightDeg: 60,
    armMm: Math.min(50, card.heightMm * 0.3, card.panelWidthMm * 0.6),
    spreadAngleDeg: 40,
    tabMm: 10,
  };
}

interface CardStore {
  /** Card opening angle in degrees: 0 = closed, 180 = flat open. */
  openAngleDeg: number;
  card: CardParams;
  mechanisms: Mechanism[];
  setOpenAngleDeg: (deg: number) => void;
  setCard: (card: Partial<CardParams>) => void;
  addParallelFold: () => void;
  addVFold: () => void;
  updateMechanism: (id: string, patch: Partial<Mechanism>) => void;
  removeMechanism: (id: string) => void;
}

const initialCard: CardParams = { panelWidthMm: 130, heightMm: 180 };

export const useCardStore = create<CardStore>((set) => ({
  openAngleDeg: 90,
  card: initialCard,
  mechanisms: [defaultParallelFold(initialCard, [])],
  setOpenAngleDeg: (deg) =>
    set({ openAngleDeg: Math.min(180, Math.max(0, deg)) }),
  setCard: (card) => set((s) => ({ card: { ...s.card, ...card } })),
  addParallelFold: () =>
    set((s) => ({
      mechanisms: [...s.mechanisms, defaultParallelFold(s.card, s.mechanisms)],
    })),
  addVFold: () =>
    set((s) => ({ mechanisms: [...s.mechanisms, defaultVFold(s.card)] })),
  updateMechanism: (id, patch) =>
    set((s) => ({
      mechanisms: s.mechanisms.map((m) =>
        m.id === id ? ({ ...m, ...patch } as Mechanism) : m,
      ),
    })),
  removeMechanism: (id) =>
    set((s) => ({ mechanisms: s.mechanisms.filter((m) => m.id !== id) })),
}));
