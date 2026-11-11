/**
 * Fold kinematics. Every pop-up element here is a PARALLELOGRAM linkage in the
 * cross-section perpendicular to the centre fold:
 *
 *      wall │        strut (length d)
 *           ├───────────┐
 *           │           │ front face (parallel to the wall)
 *           │    d      │
 *     ──────┴───────────┴────── floor
 *        gutter      floor crease
 *
 * The front face hinges on the floor at distance d from the gutter and stays
 * parallel to the back wall; the strut leaves it at height s and stays parallel
 * to the floor, reaching the wall at height s. Opposite sides are equal, so the
 * linkage closes flat at 0° and lies flat at 180° for ANY d and s — this is
 * what guarantees every generated card physically folds.
 *
 * Opening angle θ: 180° = sheet flat, 90° = displayed, 0° = closed.
 * The floor stays on the ground; the wall is elevated by α = 180° − θ.
 */
import type { Part } from './types';

export interface Pose {
  /** Flat-space y of the part's reference line. */
  y0: number;
  /** 3D position (y, z) of that reference line. */
  py: number;
  pz: number;
  /** Elevation of the part's flat +y direction (rad). 0 = lying on the floor plane pointing away. */
  a: number;
}

export function partPose(part: Pick<Part, 'role' | 'depth' | 'strut'>, openDeg: number): Pose {
  const alpha = ((180 - openDeg) * Math.PI) / 180;
  const d = part.depth;
  const s = part.strut;
  switch (part.role) {
    case 'floor':
    case 'backFloor':
      return { y0: 0, py: 0, pz: 0, a: 0 };
    case 'wall':
    case 'backWall':
      return { y0: 0, py: 0, pz: 0, a: alpha };
    case 'front':
    case 'piece':
      return { y0: -d, py: 0, pz: d, a: alpha };
    case 'bridge':
      return { y0: s - d, py: s * Math.sin(alpha), pz: d - s * Math.cos(alpha), a: 0 };
  }
}

/** Map a flat-space point (plus an offset t along the paper normal) into 3D. */
export function poseToWorld(p: Pose, x: number, y: number, t = 0): [number, number, number] {
  const s = Math.sin(p.a);
  const c = Math.cos(p.a);
  const v = y - p.y0;
  return [x, p.py + v * s + t * c, p.pz - v * c + t * s];
}
