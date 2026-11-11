/** Ready-made scenes. Each is an ordinary Design the user can take apart and rebuild. */
import type { Traced } from '../core/trace';
import type { BuildMode, CardSpec, Design, PopElement } from '../core/types';
import { shapeById } from './shapes';
import { traceShape, traceText } from './sources';
import { DEFAULT_CARD, newId, resolveSupports } from './store';

export interface Template {
  id: string;
  name: string;
  build: () => Design;
}

interface Spec {
  shape?: string;
  text?: string;
  font?: string;
  name?: string;
  x: number;
  d: number;
  h: number;
  mode?: BuildMode;
  color?: string;
  off?: number;
  sw?: number;
}

function scene(card: Partial<CardSpec>, specs: Spec[]): Design {
  const elements: PopElement[] = [];
  for (const s of specs) {
    const t: Traced | null = s.shape ? traceShape(shapeById(s.shape)) : traceText(s.text ?? '', s.font ?? 'sans', true);
    if (!t) continue;
    elements.push({
      id: newId(),
      name: s.name ?? (s.shape ? shapeById(s.shape).name : (s.text ?? 'Text')),
      outline: t.outline,
      aspect: t.aspect,
      xMm: s.x,
      depthMm: s.d,
      heightMm: s.h,
      mode: s.mode ?? 'glued',
      supportOffset: s.off ?? 0,
      supportWidthMm: s.sw ?? Math.round(Math.max(5, Math.min(12, s.h * t.aspect * 0.3))),
      color: s.color ?? '#e5484d',
    });
  }
  return resolveSupports({ card: { ...DEFAULT_CARD, ...card }, elements });
}

export const TEMPLATES: Template[] = [
  {
    id: 'birthday',
    name: 'Birthday',
    build: () =>
      scene({ color: '#fffaf0', backingColor: '#e93d82' }, [
        { shape: 'balloon', x: 28, d: 14, h: 62, color: '#3e63dd' },
        { shape: 'balloon', x: 120, d: 14, h: 56, color: '#f5a524' },
        { shape: 'cake', x: 74, d: 30, h: 48, color: '#e93d82' },
        { shape: 'gift', x: 48, d: 50, h: 24, color: '#30a46c' },
        { shape: 'gift', x: 102, d: 54, h: 20, color: '#8e4ec6' },
        { text: 'HAPPY DAY', x: 74, d: 72, h: 15, color: '#e5484d', name: 'Happy day', sw: 6 },
      ]),
  },
  {
    id: 'forest',
    name: 'Winter forest',
    build: () =>
      scene({ color: '#ffffff', backingColor: '#1d5b4f' }, [
        { shape: 'tree', x: 24, d: 20, h: 44, mode: 'fused' },
        { shape: 'snowman', x: 56, d: 50, h: 26, mode: 'fused', sw: 6 },
        { shape: 'tree', x: 90, d: 26, h: 62, mode: 'fused' },
        { shape: 'tree', x: 130, d: 44, h: 32, mode: 'fused' },
      ]),
  },
  {
    id: 'love',
    name: 'With love',
    build: () =>
      scene({ color: '#fff5f5', backingColor: '#c4162a' }, [
        { shape: 'heart', x: 74, d: 22, h: 60, color: '#e5484d' },
        { shape: 'heart', x: 30, d: 44, h: 32, color: '#e93d82' },
        { shape: 'heart', x: 118, d: 48, h: 28, color: '#f76b15' },
        { text: 'LOVE', font: 'serif', x: 74, d: 70, h: 18, color: '#c4162a', name: 'Love', sw: 6 },
      ]),
  },
  {
    id: 'city',
    name: 'City night',
    build: () =>
      scene({ color: '#f4f1ea', backingColor: '#172554' }, [
        { shape: 'skyline', x: 40, d: 24, h: 56, mode: 'fused', sw: 9 },
        { shape: 'moon', x: 80, d: 14, h: 26, color: '#f5a524', sw: 5 },
        { shape: 'skyline', x: 112, d: 44, h: 42, mode: 'fused', sw: 8 },
      ]),
  },
  {
    id: 'peaks',
    name: 'Mountain trail',
    build: () =>
      scene({ color: '#f8fafc', backingColor: '#0f766e' }, [
        { shape: 'sun', x: 104, d: 10, h: 34, color: '#f5a524' },
        { shape: 'mountains', x: 74, d: 20, h: 64, color: '#64748b', name: 'Far peaks' },
        { shape: 'mountains', x: 60, d: 38, h: 44, color: '#0f766e', name: 'Near peaks' },
        { shape: 'tree', x: 118, d: 56, h: 34, color: '#14532d' },
        { shape: 'tree', x: 26, d: 60, h: 28, color: '#166534' },
      ]),
  },
  {
    id: 'rocket',
    name: 'Lift-off',
    build: () =>
      scene({ color: '#f1f5f9', backingColor: '#1e1b4b' }, [
        { shape: 'star', x: 24, d: 12, h: 22, color: '#f5a524' },
        { shape: 'moon', x: 122, d: 14, h: 34, color: '#fde68a' },
        { shape: 'rocket', x: 72, d: 28, h: 64, color: '#e5484d' },
        { shape: 'cloud', x: 36, d: 58, h: 26, color: '#ffffff' },
        { shape: 'cloud', x: 110, d: 62, h: 24, color: '#e2e8f0' },
      ]),
  },
];

export const blankDesign = (): Design => ({ card: DEFAULT_CARD, elements: [] });
