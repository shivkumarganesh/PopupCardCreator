/**
 * Free zoom + pan for the SVG views. The wheel and a pinch scale continuously
 * and anchor on the pointer; dragging empty canvas pans; "fit" re-centres.
 * 100% means "fits the canvas".
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { create } from 'zustand';

export interface ZoomApi {
  zoomBy: (factor: number) => void;
  zoomTo: (pct: number) => void;
  fit: () => void;
}
export const useZoom = create<{ pct: number; api: ZoomApi | null }>(() => ({ pct: 100, api: null }));

export interface Viewport {
  /** px per mm */
  scale: number;
  tx: number;
  ty: number;
}

export function useViewport(ref: RefObject<SVGSVGElement | null>, content: { x: number; y: number; w: number; h: number }) {
  const [vp, setVp] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const fitScale = useRef(1);
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const box = useRef(content);
  box.current = content;
  const touched = useRef(false);

  const computeFit = useCallback((): Viewport | null => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const c = box.current;
    const padX = 48;
    const padTop = 72;
    const padBottom = 64;
    const scale = Math.max(0.05, Math.min((r.width - 2 * padX) / c.w, (r.height - padTop - padBottom) / c.h));
    fitScale.current = scale;
    return {
      scale,
      tx: (r.width - c.w * scale) / 2 - c.x * scale,
      ty: padTop + (r.height - padTop - padBottom - c.h * scale) / 2 - c.y * scale,
    };
  }, [ref]);

  const fit = useCallback(() => {
    const f = computeFit();
    if (f) {
      touched.current = false;
      setVp(f);
    }
  }, [computeFit]);

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = cx ?? r.width / 2;
      const py = cy ?? r.height / 2;
      touched.current = true;
      setVp((v) => {
        const scale = Math.max(fitScale.current * 0.25, Math.min(fitScale.current * 12, v.scale * factor));
        const k = scale / v.scale;
        return { scale, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
      });
    },
    [ref],
  );

  // refit when the content box or the container changes, unless the user has moved the view
  useLayoutEffect(() => {
    if (!touched.current) fit();
    else computeFit();
  }, [content.x, content.y, content.w, content.h, fit, computeFit]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!touched.current) fit();
      else computeFit();
    });
    ro.observe(el);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(f, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [ref, fit, computeFit, zoomAt]);

  useEffect(() => {
    useZoom.setState({
      api: {
        zoomBy: (f) => zoomAt(f),
        zoomTo: (pct) => zoomAt(((pct / 100) * fitScale.current) / vpRef.current.scale),
        fit,
      },
    });
    return () => useZoom.setState({ api: null });
  }, [zoomAt, fit]);

  useEffect(() => {
    useZoom.setState({ pct: Math.round((vp.scale / fitScale.current) * 100) });
  }, [vp.scale]);

  const pan = useCallback((dx: number, dy: number) => {
    touched.current = true;
    setVp((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  }, []);

  /** Background drag = pan. Spread onto the <svg>. */
  const panHandlers = {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.button !== 1) return;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      el.parentElement?.setAttribute('data-panning', '');
      let lx = e.clientX;
      let ly = e.clientY;
      const move = (ev: PointerEvent) => {
        pan(ev.clientX - lx, ev.clientY - ly);
        lx = ev.clientX;
        ly = ev.clientY;
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.parentElement?.removeAttribute('data-panning');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    },
  };

  return { vp, panHandlers };
}

export const ringPath = (ring: [number, number][], flipY = true) =>
  ring.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(flipY ? -y : y).toFixed(2)}`).join('') + 'Z';
export const regionPath = (mp: [number, number][][][], flipY = true) =>
  mp.map((poly) => poly.map((r) => ringPath(r, flipY)).join('')).join('');
