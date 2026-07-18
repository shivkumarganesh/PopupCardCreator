import { create } from 'zustand';
import type { CardParams, Mechanism } from '../core/types';

let idCounter = 0;
const newId = () => `m${++idCounter}`;

function defaultParallelFold(card: CardParams): Mechanism {
  return {
    id: newId(),
    type: 'parallelFold',
    centreMm: card.heightMm / 2,
    spanMm: Math.min(60, card.heightMm * 0.4),
    depthMm: Math.min(30, card.panelWidthMm * 0.4),
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
  updateMechanism: (id: string, patch: Partial<Mechanism>) => void;
  removeMechanism: (id: string) => void;
}

const initialCard: CardParams = { panelWidthMm: 130, heightMm: 180 };

export const useCardStore = create<CardStore>((set) => ({
  openAngleDeg: 90,
  card: initialCard,
  mechanisms: [defaultParallelFold(initialCard)],
  setOpenAngleDeg: (deg) =>
    set({ openAngleDeg: Math.min(180, Math.max(0, deg)) }),
  setCard: (card) => set((s) => ({ card: { ...s.card, ...card } })),
  addParallelFold: () =>
    set((s) => ({ mechanisms: [...s.mechanisms, defaultParallelFold(s.card)] })),
  updateMechanism: (id, patch) =>
    set((s) => ({
      mechanisms: s.mechanisms.map((m) =>
        m.id === id ? ({ ...m, ...patch } as Mechanism) : m,
      ),
    })),
  removeMechanism: (id) =>
    set((s) => ({ mechanisms: s.mechanisms.filter((m) => m.id !== id) })),
}));
