import { useMemo } from 'react';
import * as THREE from 'three';
import { solveParallelFold, solveVFoldAsym } from '../../core/kinematics';
import { beakHalfWidth } from '../../core/flatPattern';
import { vFoldSectorAngles } from '../../core/types';
import type { CardParams, VFoldMechanism } from '../../core/types';

interface Props {
  mechanism: VFoldMechanism;
  card: CardParams;
  openAngleDeg: number;
  worldPerMm: number;
  /** Tint yellow to flag an invalid configuration. */
  conflict?: boolean;
}

/** Glued V-fold: two rigid wing triangles meeting at a central crease that
 * rises off the gutter (spherical four-bar). */
function gluedGeometry(m: VFoldMechanism, card: CardParams, thetaDeg: number, W: number) {
  const theta = THREE.MathUtils.degToRad(thetaDeg);
  const s = vFoldSectorAngles(m);
  const r = THREE.MathUtils.degToRad;
  const pose = solveVFoldAsym({ aL: r(s.aL), bL: r(s.bL), aR: r(s.aR), bR: r(s.bR) }, theta);
  if (!pose) return null;

  const arm = m.armMm * W;
  const zV = (card.heightMm / 2 - m.centreMm) * W;
  const V = new THREE.Vector3(0, 0, zV);
  const along = (u: { x: number; y: number; z: number }) =>
    new THREE.Vector3(u.x, u.y, u.z).multiplyScalar(arm).add(V);

  const Pc = along(pose.central);
  const PaL = along(pose.attachLeft);
  const PaR = along(pose.attachRight);
  return [V, PaL, Pc, V, Pc, PaR];
}

/** Cut V-fold ("beak"): two triangles sharing a ridge that rises from an apex
 * on the gutter (planar four-bar per cross-section, tapering to the apex). */
function cutGeometry(m: VFoldMechanism, card: CardParams, thetaDeg: number, W: number) {
  const theta = THREE.MathUtils.degToRad(thetaDeg);
  const d = beakHalfWidth(m);
  const pose = solveParallelFold({ p: d, q: d, a: d, b: d }, theta);
  if (!pose) return null;

  const zApex = (card.heightMm / 2 - m.centreMm) * W;
  const zSlit = (card.heightMm / 2 - (m.centreMm + m.armMm)) * W;
  const apex = new THREE.Vector3(0, 0, zApex);
  const ridge = new THREE.Vector3(pose.B.x * W, pose.B.y * W, zSlit);
  const left = new THREE.Vector3(pose.A.x * W, pose.A.y * W, zSlit);
  const right = new THREE.Vector3(pose.C.x * W, pose.C.y * W, zSlit);
  return [apex, left, ridge, apex, ridge, right];
}

/**
 * The 3D popup for a V-fold — glued (wings off the gutter) or cut (beak rising
 * from an apex on the gutter), selected by `mechanism.mount`.
 */
export function VFold({ mechanism, card, openAngleDeg, worldPerMm, conflict }: Props) {
  const geometry = useMemo(() => {
    const verts =
      mechanism.mount === 'cut'
        ? cutGeometry(mechanism, card, openAngleDeg, worldPerMm)
        : gluedGeometry(mechanism, card, openAngleDeg, worldPerMm);
    if (!verts) return null;

    const positions: number[] = [];
    for (const v of verts) positions.push(v.x, v.y, v.z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [
    mechanism.mount,
    mechanism.symmetric,
    mechanism.baseAngleDeg,
    mechanism.popupAngleDeg,
    mechanism.baseAngleRightDeg,
    mechanism.popupAngleRightDeg,
    mechanism.spreadAngleDeg,
    mechanism.armMm,
    mechanism.centreMm,
    card.heightMm,
    openAngleDeg,
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
