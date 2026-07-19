/**
 * Fold kinematics for pop-up mechanisms.
 *
 * Every mechanism is a linkage: panels are rigid links, creases are revolute
 * joints. Two solvers cover the core mechanisms:
 *
 * - Parallel/box fold  → planar four-bar in the cross-section ⊥ gutter.
 * - V-fold             → spherical four-bar about a vertex on the gutter.
 *
 * 3D convention (matches the R3F scene): the gutter lies along the z-axis,
 * the card opens as a valley (∨) rising in +y. With opening angle θ
 * (0 = closed, π = flat open), the in-panel directions perpendicular to the
 * gutter are:
 *
 *   right panel  r̂ = ( sin(θ/2), cos(θ/2), 0)
 *   left panel   l̂ = (-sin(θ/2), cos(θ/2), 0)
 *
 * The cross-section plane is x–y; cross-section solvers work in 2D {x, y}
 * and results lift to 3D by choosing a z offset along the gutter.
 * All angles are radians, all lengths millimetres.
 */

import type { Point2 } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const EPS = 1e-9;

/** In-panel unit direction ⊥ gutter for the given side, in the x–y cross-section. */
export function panelDirection(thetaRad: number, side: 'left' | 'right'): Point2 {
  const s = Math.sin(thetaRad / 2);
  const c = Math.cos(thetaRad / 2);
  return { x: side === 'right' ? s : -s, y: c };
}

// ---------------------------------------------------------------------------
// Parallel / box fold — planar four-bar
// ---------------------------------------------------------------------------

export interface ParallelFoldParams {
  /** Gutter → attachment crease distance on the left panel (mm). */
  p: number;
  /** Gutter → attachment crease distance on the right panel (mm). */
  q: number;
  /** Popup panel width, left crease → ridge (mm). */
  a: number;
  /** Popup panel width, ridge → right crease (mm). */
  b: number;
}

export interface ParallelFoldPose {
  /** Left attachment crease position in the cross-section (mm). */
  A: Point2;
  /** Popup ridge position (mm). */
  B: Point2;
  /** Right attachment crease position (mm). */
  C: Point2;
}

/**
 * Solve the cross-section four-bar for opening angle θ.
 *
 * A and C ride on the base panels; the ridge B is the intersection of
 * circle(A, radius a) and circle(C, radius b), taking the solution on the
 * popup side (+y of the A→C line, i.e. rising inside the valley).
 *
 * Returns null when the circles cannot meet — the mechanism binds (paper
 * would tear) at this opening angle.
 */
export function solveParallelFold(
  params: ParallelFoldParams,
  thetaRad: number,
): ParallelFoldPose | null {
  const { p, q, a, b } = params;
  const l = panelDirection(thetaRad, 'left');
  const r = panelDirection(thetaRad, 'right');
  const A: Point2 = { x: p * l.x, y: p * l.y };
  const C: Point2 = { x: q * r.x, y: q * r.y };

  const dx = C.x - A.x;
  const dy = C.y - A.y;
  const d = Math.hypot(dx, dy);

  // Coincident centers (θ=0 with p=q): the flat-folded state. B lies straight
  // up the collapsed panels at distance a from A.
  if (d < EPS) {
    if (Math.abs(a - b) > 1e-6) return null;
    return { A, B: { x: A.x, y: A.y + a }, C };
  }

  if (d > a + b + 1e-6 || d < Math.abs(a - b) - 1e-6) return null;

  // Standard circle–circle intersection; clamp the discriminant so exact
  // tangency (flat-folded / fully-flattened states) doesn't fail on rounding.
  const t = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - t * t));

  const mx = A.x + (t * dx) / d;
  const my = A.y + (t * dy) / d;
  // Perpendicular of (dx, dy)/d chosen so B lands on the +y side of A→C.
  const px = -dy / d;
  const py = dx / d;
  const sign = py >= 0 ? 1 : -1;

  return {
    A,
    B: { x: mx + sign * h * px, y: my + sign * h * py },
    C,
  };
}

/** True when the fold closes completely flat with the card (θ = 0). */
export function parallelFoldClosesFlat(params: ParallelFoldParams): boolean {
  return Math.abs(params.p + params.a - (params.q + params.b)) < 1e-6;
}

/**
 * True when the fold reaches the given opening angle without binding.
 * A step fold cut from the base sheet (a+b = p+q) flattens exactly at 180°.
 */
export function parallelFoldOpensTo(params: ParallelFoldParams, thetaRad: number): boolean {
  return solveParallelFold(params, thetaRad) !== null;
}

/**
 * True for the parallelogram special case (a = q, b = p): the popup panels
 * remain parallel to the opposite base panels for every θ. This is the only
 * geometry a slit-cut step fold (popup cut from the base sheet) can have.
 */
export function isParallelogramFold(params: ParallelFoldParams): boolean {
  return Math.abs(params.a - params.q) < 1e-6 && Math.abs(params.b - params.p) < 1e-6;
}

// ---------------------------------------------------------------------------
// V-fold — spherical four-bar
// ---------------------------------------------------------------------------

export interface VFoldParams {
  /** Sector angle between gutter and attachment crease, on the base (rad). */
  A: number;
  /** Sector angle between attachment crease and central crease, on the popup (rad). */
  B: number;
  /**
   * Fold branch — choosing the mountain/valley sense of the central crease:
   * 'up' is the standard erect V-fold rising inside the valley (collapses to
   * sector angle A + B when the card closes); 'down' is the inverted V-fold
   * that folds to A − B when closed and dips below the base plane as the
   * card approaches fully open.
   */
  branch?: 'up' | 'down';
}

export interface VFoldPose {
  /** Angle of the central crease from the gutter axis, in the symmetry plane (rad). */
  delta: number;
  /** Unit direction of the central crease. */
  central: Vec3;
  /** Unit direction of the left attachment crease. */
  attachLeft: Vec3;
  /** Unit direction of the right attachment crease. */
  attachRight: Vec3;
}

/**
 * Solve the symmetric V-fold (A_L = A_R = A, B_L = B_R = B) at opening
 * angle θ.
 *
 * Loop closure, with the central crease c = (0, sin δ, cos δ) in the
 * symmetry plane and attachment crease u = cos A·ẑ + sin A·r̂:
 *
 *   cos B = cos A·cos δ + sin A·cos(θ/2)·sin δ
 *
 * Solved in the form R·cos(δ − ψ) = cos B where
 * R = √(cos²A + sin²A·cos²(θ/2)), ψ = atan2(sin A·cos(θ/2), cos A).
 *
 * Returns null when |cos B| > R — the spherical four-bar cannot close at
 * this θ (requires B ≥ A to reach 180°; otherwise the paper binds/tears).
 */
export function solveVFold(params: VFoldParams, thetaRad: number): VFoldPose | null {
  const { A, B, branch = 'up' } = params;
  const cosHalf = Math.cos(thetaRad / 2);

  const Rx = Math.cos(A);
  const Ry = Math.sin(A) * cosHalf;
  const R = Math.hypot(Rx, Ry);
  const ratio = Math.cos(B) / R;
  if (Math.abs(ratio) > 1 + 1e-9) return null;

  const psi = Math.atan2(Ry, Rx);
  const spread = Math.acos(Math.min(1, Math.max(-1, ratio)));
  // ψ + spread → erect popup rising inside the valley ('up');
  // ψ − spread → the mirror branch below the base plane ('down').
  const delta = branch === 'up' ? psi + spread : psi - spread;

  const sinHalf = Math.sin(thetaRad / 2);
  const attach = (side: 1 | -1): Vec3 => ({
    x: side * Math.sin(A) * sinHalf,
    y: Math.sin(A) * cosHalf,
    z: Math.cos(A),
  });

  return {
    delta,
    central: { x: 0, y: Math.sin(delta), z: Math.cos(delta) },
    attachLeft: attach(-1),
    attachRight: attach(1),
  };
}

/** Height above the base plane of a point at distance len along the central crease. */
export function vFoldApexHeight(pose: VFoldPose, len: number): number {
  return len * pose.central.y;
}

// --- Vector helpers (local, for the asymmetric solve) ----------------------
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export interface VFoldAsymParams {
  /** Base sector angle on the left, gutter → attachment crease (rad). */
  aL: number;
  /** Popup sector angle on the left, attachment → central crease (rad). */
  bL: number;
  aR: number;
  bR: number;
  branch?: 'up' | 'down';
}

/**
 * Solve the general (asymmetric) V-fold at opening angle θ by intersecting the
 * two rigid-panel constraints with the unit sphere:
 *
 *   u_L · c = cos B_L,   u_R · c = cos B_R,   |c| = 1
 *
 * where u_L, u_R are the attachment-crease directions in the two base panels.
 * The two roots are the up/down branches. Returns null when the constraints
 * have no common unit solution — the four-bar binds (paper tears) at this θ —
 * or when the panels degenerate (θ ≈ 0, panels coincident).
 */
export function solveVFoldAsym(p: VFoldAsymParams, thetaRad: number): VFoldPose | null {
  const { aL, bL, aR, bR, branch = 'up' } = p;
  const sh = Math.sin(thetaRad / 2);
  const ch = Math.cos(thetaRad / 2);

  const uL: Vec3 = { x: -Math.sin(aL) * sh, y: Math.sin(aL) * ch, z: Math.cos(aL) };
  const uR: Vec3 = { x: Math.sin(aR) * sh, y: Math.sin(aR) * ch, z: Math.cos(aR) };

  const m = dot(uL, uR);
  const denom = 1 - m * m;
  if (denom < 1e-9) return null; // attachment creases parallel (θ ≈ 0)

  const cbL = Math.cos(bL);
  const cbR = Math.cos(bR);
  const a = (cbL - m * cbR) / denom;
  const b = (cbR - m * cbL) / denom;
  const c0 = add(scale(uL, a), scale(uR, b));
  const d = cross(uL, uR);
  const dd = dot(d, d);
  if (dd < 1e-12) return null;

  const disc = (1 - dot(c0, c0)) / dd;
  if (disc < 0) return null; // no closure → binds/tears

  const t = Math.sqrt(disc);
  const cUp = add(c0, scale(d, t));
  const cDown = add(c0, scale(d, -t));
  // 'up' = the erect branch (central crease rising, larger y).
  const rising = cUp.y >= cDown.y ? cUp : cDown;
  const central = branch === 'up' ? rising : rising === cUp ? cDown : cUp;

  return {
    delta: Math.atan2(Math.hypot(central.x, central.y), central.z),
    central,
    attachLeft: uL,
    attachRight: uR,
  };
}

/**
 * True when the symmetric V-fold reaches θ without binding.
 * Opening fully (θ = π) requires cos B ≤ cos A, i.e. B ≥ A.
 */
export function vFoldOpensTo(params: VFoldParams, thetaRad: number): boolean {
  return solveVFold(params, thetaRad) !== null;
}

/**
 * Kawasaki flat-fold condition for an asymmetric V-fold vertex: the sector
 * sums on each side of the gutter must match or the card cannot close flat.
 */
export function vFoldFoldsFlat(aL: number, bL: number, aR: number, bR: number): boolean {
  return Math.abs(aL + bL - (aR + bR)) < 1e-9;
}

// ---------------------------------------------------------------------------
// Closed-card containment
// ---------------------------------------------------------------------------

/**
 * Where a point of the popup lands when the card is closed flat (θ = 0),
 * in the flat plane of the collapsed card, measured from the V-fold vertex.
 *
 * A point at distance `len` along the central crease folds to angle
 * (A + B) from the gutter for the 'up' branch, (A − B) for 'down'. For it to
 * stay inside the card it must satisfy 0 ≤ x ≤ panelWidth and |z| within the
 * card height bounds relative to the vertex.
 */
export function vFoldClosedPosition(params: VFoldParams, len: number): Point2 {
  const angle =
    (params.branch ?? 'up') === 'up' ? params.A + params.B : params.A - params.B;
  // x: distance from the gutter (into the panel), y here reused as the
  // along-gutter offset from the vertex.
  return { x: len * Math.sin(angle), y: len * Math.cos(angle) };
}
