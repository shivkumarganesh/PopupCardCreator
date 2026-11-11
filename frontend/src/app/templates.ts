/** Ready-made scenes. Each is an ordinary Design the user can take apart and rebuild. */
import type { Traced } from '../core/trace';
import type { BuildMode, CardSpec, Design, PopElement } from '../core/types';
import { shapeById } from './shapes';
import { traceShape, traceText } from './sources';
import { DEFAULT_CARD, newId, resolveSupports } from './store';

export interface Template {
  id: string;
  name: string;
  /** The scene as authored — cheap, enough for a thumbnail. */
  build: () => Design;
}

const solved = new Map<string, Design>();
/** The scene ready to use: support positions solved so it builds without conflicts. Cached. */
export function loadTemplate(t: Template): Design {
  let d = solved.get(t.id);
  if (!d) solved.set(t.id, (d = resolveSupports(t.build())));
  // fresh ids so loading the same template twice never shares element identity with history
  return { card: d.card, elements: d.elements.map((e) => ({ ...e, id: newId() })) };
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
      supportWidthMm: s.sw ?? Math.round(Math.max(5, Math.min(t.aspect > 3 ? 7 : 12, s.h * t.aspect * 0.3))),
      color: s.color ?? '#e5484d',
    });
  }
  return { card: { ...DEFAULT_CARD, ...card }, elements };
}

export const blankDesign = (): Design => ({ card: DEFAULT_CARD, elements: [] });

const SKY = '#f5a524';

export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank card', build: blankDesign },
  // ── scenery ──
  {
    id: 'beach',
    name: 'Beach day',
    build: () =>
      scene({ color: '#fdf6e3', backingColor: '#38bdf8' }, [
        { shape: 'sun', x: 112, d: 10, h: 32, color: SKY },
        { shape: 'waves', x: 74, d: 20, h: 16, color: '#0ea5e9', name: 'Far waves' },
        { shape: 'sailboat', x: 46, d: 32, h: 40, color: '#f43f5e' },
        { shape: 'waves', x: 74, d: 46, h: 18, color: '#0369a1', name: 'Near waves' },
        { shape: 'palm', x: 120, d: 60, h: 40, color: '#15803d' },
      ]),
  },
  {
    id: 'desert',
    name: 'Desert',
    build: () =>
      scene({ color: '#fef3c7', backingColor: '#ea580c' }, [
        { shape: 'sun', x: 40, d: 10, h: 34, color: '#fde047' },
        { shape: 'mountains', x: 92, d: 18, h: 56, color: '#b45309', name: 'Mesa' },
        { shape: 'hills', x: 74, d: 34, h: 26, color: '#f59e0b', name: 'Dunes' },
        { shape: 'cactus', x: 34, d: 50, h: 40, color: '#15803d' },
        { shape: 'cactus', x: 116, d: 62, h: 28, color: '#166534' },
      ]),
  },
  {
    id: 'farm',
    name: 'Farm',
    build: () =>
      scene({ color: '#f7fee7', backingColor: '#7dd3fc' }, [
        { shape: 'cloud', x: 34, d: 8, h: 22, color: '#ffffff' },
        { shape: 'hills', x: 74, d: 16, h: 36, color: '#65a30d' },
        { shape: 'windmill', x: 116, d: 28, h: 56, color: '#92400e' },
        { shape: 'barn', x: 52, d: 38, h: 38, color: '#b91c1c' },
        { shape: 'roundtree', x: 98, d: 52, h: 30, color: '#166534' },
        { shape: 'fence', x: 74, d: 70, h: 14, color: '#a16207' },
      ]),
  },
  {
    id: 'harbour',
    name: 'Lighthouse',
    build: () =>
      scene({ color: '#f0f9ff', backingColor: '#1e3a8a' }, [
        { shape: 'moon', x: 18, d: 8, h: 26, color: '#fde68a' },
        { shape: 'lighthouse', x: 108, d: 22, h: 68, color: '#ef4444' },
        { shape: 'hills', x: 100, d: 34, h: 22, color: '#475569', name: 'Rocks', off: -0.7, sw: 8 },
        { shape: 'waves', x: 74, d: 48, h: 16, color: '#0284c7', name: 'Far waves', off: -0.45, sw: 8 },
        { shape: 'sailboat', x: 36, d: 58, h: 30, color: '#e5484d', sw: 6 },
        { shape: 'waves', x: 74, d: 72, h: 16, color: '#075985', name: 'Near waves', off: 0.35, sw: 8 },
      ]),
  },
  {
    id: 'castle',
    name: 'Castle hill',
    build: () =>
      scene({ color: '#faf5ff', backingColor: '#7c3aed' }, [
        { shape: 'cloud', x: 118, d: 8, h: 22, color: '#ffffff' },
        { shape: 'castle', x: 70, d: 20, h: 62, color: '#94a3b8' },
        { shape: 'hills', x: 74, d: 36, h: 30, color: '#4d7c0f' },
        { shape: 'roundtree', x: 24, d: 50, h: 34, color: '#166534' },
        { shape: 'roundtree', x: 124, d: 56, h: 28, color: '#15803d' },
        { shape: 'grass', x: 74, d: 72, h: 10, color: '#65a30d' },
      ]),
  },
  {
    id: 'camp',
    name: 'Campsite',
    build: () =>
      scene({ color: '#ecfdf5', backingColor: '#0f172a' }, [
        { shape: 'moon', x: 116, d: 8, h: 26, color: '#fde68a' },
        { shape: 'mountains', x: 66, d: 18, h: 62, color: '#64748b' },
        { shape: 'tree', x: 122, d: 32, h: 50, color: '#14532d' },
        { shape: 'tree', x: 22, d: 40, h: 40, color: '#166534' },
        { shape: 'tent', x: 76, d: 54, h: 30, color: '#f97316' },
        { shape: 'grass', x: 74, d: 74, h: 10, color: '#15803d' },
      ]),
  },
  {
    id: 'village',
    name: 'Village',
    build: () =>
      scene({ color: '#fffbeb', backingColor: '#0ea5e9' }, [
        { shape: 'sun', x: 26, d: 8, h: 28, color: SKY },
        { shape: 'hills', x: 74, d: 16, h: 38, color: '#84cc16' },
        { shape: 'church', x: 74, d: 28, h: 52, color: '#7c5cff' },
        { shape: 'house', x: 30, d: 42, h: 34, color: '#f97316' },
        { shape: 'house', x: 118, d: 46, h: 30, color: '#e11d48' },
        { shape: 'roundtree', x: 94, d: 62, h: 24, color: '#166534' },
        { shape: 'fence', x: 46, d: 70, h: 12, color: '#a16207' },
      ]),
  },
  {
    id: 'woodland',
    name: 'Mushroom wood',
    build: () =>
      scene({ color: '#f0fdf4', backingColor: '#14532d' }, [
        { shape: 'tree', x: 30, d: 12, h: 60, color: '#166534' },
        { shape: 'tree', x: 118, d: 16, h: 60, color: '#15803d' },
        { shape: 'roundtree', x: 74, d: 26, h: 50, color: '#4d7c0f' },
        { shape: 'mushroom', x: 50, d: 46, h: 30, color: '#dc2626' },
        { shape: 'mushroom', x: 102, d: 56, h: 22, color: '#f59e0b' },
        { shape: 'grass', x: 74, d: 72, h: 12, color: '#65a30d', off: 0.38, sw: 6 },
      ]),
  },
  // ── occasions ──
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
