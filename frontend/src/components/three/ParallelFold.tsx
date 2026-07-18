import { useMemo } from 'react';
import * as THREE from 'three';
import { solveParallelFold } from '../../core/kinematics';
import type { CardParams, ParallelFoldMechanism } from '../../core/types';

interface Props {
  mechanism: ParallelFoldMechanism;
  card: CardParams;
  openAngleDeg: number;
  worldPerMm: number;
  /** Tint yellow to flag an overlap with another mechanism. */
  conflict?: boolean;
}

/**
 * The 3D popup for a symmetric single-slit box/step fold.
 *
 * The cross-section (⊥ gutter) is solved by `solveParallelFold` as the
 * parallelogram case p = q = a = b = depth, giving a peak that rises above
 * the gutter. Two quads (left panel A→B, right panel B→C) are extruded along
 * the gutter over the strip's span.
 */
export function ParallelFold({ mechanism, card, openAngleDeg, worldPerMm, conflict }: Props) {
  const geometry = useMemo(() => {
    const theta = THREE.MathUtils.degToRad(openAngleDeg);
    const d = mechanism.depthMm;
    const pose = solveParallelFold({ p: d, q: d, a: d, b: d }, theta);
    if (!pose) return null;

    const W = worldPerMm;
    // Flat-pattern y (from the top edge) maps to world z, +z at the top.
    const zAt = (y: number) => (card.heightMm / 2 - y) * W;
    const z0 = zAt(mechanism.centreMm - mechanism.spanMm / 2);
    const z1 = zAt(mechanism.centreMm + mechanism.spanMm / 2);

    const A = new THREE.Vector2(pose.A.x * W, pose.A.y * W);
    const B = new THREE.Vector2(pose.B.x * W, pose.B.y * W);
    const C = new THREE.Vector2(pose.C.x * W, pose.C.y * W);

    const positions: number[] = [];
    const quad = (p: THREE.Vector2, q: THREE.Vector2) => {
      positions.push(
        p.x, p.y, z0, q.x, q.y, z0, q.x, q.y, z1,
        p.x, p.y, z0, q.x, q.y, z1, p.x, p.y, z1,
      );
    };
    quad(A, B);
    quad(B, C);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [openAngleDeg, mechanism.depthMm, mechanism.centreMm, mechanism.spanMm, worldPerMm, card.heightMm]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={conflict ? '#f2c14e' : '#e86a5c'}
        side={THREE.DoubleSide}
        // Popup lies coplanar with the base card at 180°; bias it forward in
        // the depth buffer so it wins cleanly instead of z-fighting.
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
