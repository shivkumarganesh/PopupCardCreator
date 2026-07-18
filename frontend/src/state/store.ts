import { create } from 'zustand';
import type { CardParams } from '../core/types';

interface CardStore {
  /** Card opening angle in degrees: 0 = closed, 180 = flat open. */
  openAngleDeg: number;
  card: CardParams;
  setOpenAngleDeg: (deg: number) => void;
  setCard: (card: Partial<CardParams>) => void;
}

export const useCardStore = create<CardStore>((set) => ({
  openAngleDeg: 90,
  card: {
    panelWidthMm: 130,
    heightMm: 180,
  },
  setOpenAngleDeg: (deg) =>
    set({ openAngleDeg: Math.min(180, Math.max(0, deg)) }),
  setCard: (card) => set((s) => ({ card: { ...s.card, ...card } })),
}));
