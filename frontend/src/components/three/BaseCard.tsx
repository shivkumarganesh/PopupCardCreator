import { useMemo } from 'react';
import * as THREE from 'three';
import type { CardParams, Mechanism } from '../../core/types';

export interface BaseCardProps {
  /** Card opening angle in degrees: 0 = closed, 180 = flat open. */
  openAngleDeg: number;
  card: CardParams;
  mechanisms: Mechanism[];
  worldPerMm: number;
}

/** A notch on the gutter edge of a panel: [z0, z1] range, `depth` inward. */
interface Notch {
  z0: number;
  z1: number;
  depth: number;
}

/** Merge overlapping notch intervals, keeping the deepest, so the panel
 * outline stays a simple (non-self-intersecting) polygon. */
function mergeNotches(notches: Notch[]): Notch[] {
  const sorted = [...notches].sort((a, b) => a.z0 - b.z0);
  const merged: Notch[] = [];
  for (const n of sorted) {
    const last = merged[merged.length - 1];
    if (last && n.z0 <= last.z1) {
      last.z1 = Math.max(last.z1, n.z1);
      last.depth = Math.max(last.depth, n.depth);
    } else {
      merged.push({ ...n });
    }
  }
  return merged;
}

/**
 * Build one panel as a flat shape in the gutter-local (u, v) plane, where
 * u = distance from the gutter (0 → panelWidth) and v = position along the
 * gutter. Each mechanism removes a notch of `depth` from the gutter edge over
 * its strip range, because that material lifts away to form the popup — so
 * the card shows a window there, not solid card.
 */
function buildPanelGeometry(
  panelWidth: number,
  height: number,
  notches: Notch[],
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const merged = mergeNotches(notches);

  // Walk up the gutter edge (u = 0) from -height/2, detouring around notches.
  shape.moveTo(0, -height / 2);
  for (const n of merged) {
    shape.lineTo(0, n.z0);
    shape.lineTo(n.depth, n.z0);
    shape.lineTo(n.depth, n.z1);
    shape.lineTo(0, n.z1);
  }
  shape.lineTo(0, height / 2);
  // Across the top, down the outer edge, back along the bottom.
  shape.lineTo(panelWidth, height / 2);
  shape.lineTo(panelWidth, -height / 2);
  shape.lineTo(0, -height / 2);

  const geo = new THREE.ShapeGeometry(shape);
  // Shape lives in XY (u, v); map to the flat panel in XZ: (u, v, 0) → (u, 0, v).
  geo.rotateX(Math.PI / 2);
  return geo;
}

/**
 * The base card: two rigid panels hinged along the gutter (the z-axis).
 *
 * The card opens as a valley (∨): the gutter rests on the ground and the
 * panels rise upward and outward, so pop-up mechanisms rise inside the
 * valley. Each step fold cuts a matching window in the panels where its strip
 * lifts, so the popup and the card never render the same material twice.
 */
export function BaseCard({ openAngleDeg, card, mechanisms, worldPerMm }: BaseCardProps) {
  const W = worldPerMm;
  const panelWidth = card.panelWidthMm * W;
  const height = card.heightMm * W;
  const tilt = Math.PI / 2 - THREE.MathUtils.degToRad(openAngleDeg) / 2;

  // Flat-pattern y (from the top) maps to world z, +z at the top.
  const zAt = (y: number) => (card.heightMm / 2 - y) * W;

  const notches = useMemo<Notch[]>(() => {
    const out: Notch[] = [];
    for (const m of mechanisms) {
      if (m.type === 'parallelFold') {
        const z0 = zAt(m.centreMm + m.spanMm / 2); // smaller z (lower)
        const z1 = zAt(m.centreMm - m.spanMm / 2); // larger z (upper)
        out.push({ z0, z1, depth: Math.min(m.depthMm * W, panelWidth) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanisms, panelWidth, height, card.heightMm, W]);

  const leftGeometry = useMemo(
    () => buildPanelGeometry(panelWidth, height, notches),
    [panelWidth, height, notches],
  );
  const rightGeometry = useMemo(
    () => buildPanelGeometry(panelWidth, height, notches),
    [panelWidth, height, notches],
  );

  return (
    <group>
      {/* Left panel: mirror of the right across the gutter (scale x = -1). */}
      <group rotation={[0, 0, -tilt]}>
        <mesh geometry={leftGeometry} scale={[-1, 1, 1]}>
          <meshStandardMaterial color="#f5f0e6" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Right panel: extends toward +x, rising in +y. */}
      <group rotation={[0, 0, tilt]}>
        <mesh geometry={rightGeometry}>
          <meshStandardMaterial color="#efe8d8" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Gutter line, for visual reference. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, height]} />
        <meshBasicMaterial color="#b09a6d" />
      </mesh>
    </group>
  );
}
