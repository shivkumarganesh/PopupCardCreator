/**
 * Browser-side rasterisers: anything a person can pick, type, upload or draw
 * becomes a coverage mask, and core/trace.ts turns the mask into a silhouette.
 */
import { traceMask } from '../core/trace';
import type { Traced } from '../core/trace';
import type { LibraryShape } from './shapes';

function maskOf(canvas: HTMLCanvasElement): { mask: Uint8ClampedArray; w: number; h: number } {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3];
  return { mask, w, h };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const cache = new Map<string, Traced>();

export function traceShape(shape: LibraryShape): Traced {
  const hit = cache.get(shape.id);
  if (hit) return hit;
  const S = 4; // 400 px for the default 100-unit box
  const c = makeCanvas((shape.w ?? 100) * S + 8, (shape.h ?? 100) * S + 8);
  const ctx = c.getContext('2d')!;
  ctx.translate(4, 4);
  ctx.scale(S, S);
  ctx.fillStyle = '#000';
  for (const d of shape.fill) ctx.fill(new Path2D(d));
  ctx.globalCompositeOperation = 'destination-out';
  for (const d of shape.holes ?? []) ctx.fill(new Path2D(d));
  const { mask, w, h } = maskOf(c);
  const t = traceMask(mask, w, h, { epsilon: 0.5 })!;
  cache.set(shape.id, t);
  return t;
}

/** Bundled lettering (self-hosted, so it looks the same on every device and inside a sandbox). */
export const FONTS = [
  { id: 'sans', name: 'Bold', family: 'Archivo Black', weight: 400 },
  { id: 'round', name: 'Rounded', family: 'Fredoka', weight: 700 },
  { id: 'bubble', name: 'Bubbly', family: 'Baloo 2', weight: 800 },
  { id: 'tall', name: 'Tall poster', family: 'Bebas Neue', weight: 400 },
  { id: 'slab', name: 'Slab', family: 'Alfa Slab One', weight: 400 },
  { id: 'serif', name: 'Elegant serif', family: 'Playfair Display', weight: 900 },
  { id: 'script', name: 'Script', family: 'Pacifico', weight: 400 },
  { id: 'retro', name: 'Retro script', family: 'Lobster', weight: 400 },
  { id: 'marker', name: 'Marker', family: 'Permanent Marker', weight: 400 },
  { id: 'comic', name: 'Comic', family: 'Bangers', weight: 400 },
  { id: 'toy', name: 'Playful', family: 'Luckiest Guy', weight: 400 },
  { id: 'deco', name: 'Deco', family: 'Righteous', weight: 400 },
  { id: 'mono', name: 'Typewriter', family: 'Special Elite', weight: 400 },
] as const;

const fontCss = (f: (typeof FONTS)[number]) => `${f.weight} 160px "${f.family}", "Arial Black", Arial, sans-serif`;

/** Canvas text only uses a web font once it is loaded, so load them all before the first trace. */
export async function loadFonts(): Promise<void> {
  if (!document.fonts?.load) return;
  const all = Promise.all(FONTS.map((f) => document.fonts.load(`${f.weight} 40px "${f.family}"`).catch(() => [])));
  await Promise.race([all, new Promise((r) => setTimeout(r, 3000))]);
}

/**
 * Text (or emoji) → one connected silhouette. Separate letters would fall
 * apart when cut, so a ground bar under the baseline joins them.
 */
export function traceText(text: string, fontId: string, bar: boolean): Traced | null {
  const t = text.trim();
  if (!t) return null;
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0];
  const probe = makeCanvas(1, 1).getContext('2d')!;
  probe.font = fontCss(font);
  const m = probe.measureText(t);
  const asc = Math.ceil(m.actualBoundingBoxAscent || 120);
  const desc = Math.ceil(m.actualBoundingBoxDescent || 0);
  const left = Math.ceil(m.actualBoundingBoxLeft || 0);
  const width = Math.ceil((m.actualBoundingBoxRight || m.width) + left);
  const barH = bar ? Math.round(asc * 0.16) : 0;
  const pad = 6;
  const scale = Math.min(1, 1600 / (width + 2 * pad));
  const c = makeCanvas((width + 2 * pad) * scale, (asc + Math.max(desc, barH) + 2 * pad) * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.font = fontCss(font);
  ctx.fillStyle = '#000';
  ctx.fillText(t, pad + left, pad + asc);
  // the bar overlaps the baseline slightly so round letters still bite into it
  if (bar) ctx.fillRect(pad, pad + asc - asc * 0.035, width, barH + asc * 0.035);
  const { mask, w, h } = maskOf(c);
  return traceMask(mask, w, h, { epsilon: 0.5, minArea: 20 });
}

export interface ImageOptions {
  /** 0–255: pixels darker than this are the shape (ignored for transparent images). */
  threshold: number;
  invert: boolean;
  holes: boolean;
}

/** Photo, logo or drawing → silhouette. Uses transparency when the image has it, darkness otherwise. */
export function traceImage(img: CanvasImageSource, iw: number, ih: number, o: ImageOptions): Traced | null {
  const scale = Math.min(1, 480 / Math.max(iw, ih));
  const c = makeCanvas(iw * scale, ih * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const n = c.width * c.height;
  let transparent = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 128) transparent++;
  const useAlpha = transparent > n * 0.02;
  const mask = new Uint8ClampedArray(n);
  // a soft ramp around the threshold keeps the contour sub-pixel smooth
  const soft = (v: number) => Math.max(0, Math.min(255, 128 + v * 6));
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    let v: number;
    if (useAlpha) v = a;
    else {
      const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      v = soft(o.threshold - lum);
    }
    mask[i] = o.invert ? 255 - v : v;
  }
  return traceMask(mask, c.width, c.height, { epsilon: 0.7, minArea: 40, holes: o.holes });
}

export function traceCanvas(canvas: HTMLCanvasElement): Traced | null {
  const { mask, w, h } = maskOf(canvas);
  return traceMask(mask, w, h, { epsilon: 0.8, minArea: 30 });
}
