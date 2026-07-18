import { useMemo } from 'react';
import * as THREE from 'three';
import { solveVFold } from '../../core/kinematics';
import type { CardParams, VFoldMechanism } from '../../core/types';

interface Props {
  mechanism: VFoldMechanism;
  card: CardParams;
  openAngleDeg: number;
  worldPerMm: number;
  /** Tint yellow to flag an invalid configuration. */
  conflict?: boolean;
}

/**
 * The 3D popup for a symmetric V-fold: two rigid wing triangles sharing the
 * vertex on the gutter and the central crease. Directions come from
 * `solveVFold`; the wings stay rigid (fixed arm length, apex angle B) while
 * the creases swing as the card opens.
 */
export function VFold({ mechanism, card, openAngleDeg, worldPerMm, conflict }: Props) {
  const geometry = useMemo(() => {
    const theta = THREE.MathUtils.degToRad(openAngleDeg);
    const A = THREE.MathUtils.degToRad(mechanism.baseAngleDeg);
    const B = THREE.MathUtils.degToRad(mechanism.popupAngleDeg);
    const pose = solveVFold({ A, B }, theta);
    if (!pose) return null;

    const W = worldPerMm;
    const arm = mechanism.armMm * W;
    const zV = (card.heightMm / 2 - mechanism.centreMm) * W;
    const V = new THREE.Vector3(0, 0, zV);
    const along = (u: { x: number; y: number; z: number }) =>
      new THREE.Vector3(u.x, u.y, u.z).multiplyScalar(arm).add(V);

    const Pc = along(pose.central);
    const PaL = along(pose.attachLeft);
    const PaR = along(pose.attachRight);

    const positions: number[] = [];
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    tri(V, PaL, Pc);
    tri(V, Pc, PaR);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [
    openAngleDeg,
    mechanism.baseAngleDeg,
    mechanism.popupAngleDeg,
    mechanism.armMm,
    mechanism.centreMm,
    card.heightMm,
    worldPerMm,
  ]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={conflict ? '#f2c14e' : '#5c8ce8'}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
