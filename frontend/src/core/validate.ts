import type { CardParams, Mechanism } from './types';

/**
 * Design-level validation across mechanisms.
 *
 * Physical rule: each mechanism claims a region of the card along the gutter —
 * a step fold lifts a strip; a V-fold's wings occupy the sector its creases
 * sweep near the vertex. Two mechanisms whose gutter footprints overlap would
 * collide (share material or interpenetrate). Touching is fine; true interior
 * overlap is not.
 */

export interface MechanismConflict {
  ids: string[];
  message: string;
}

const EPS = 1e-6;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The gutter interval [lo, hi] (mm from the top edge) a mechanism footprint
 * occupies. For a V-fold this is the along-gutter extent of the wing sector
 * from the base crease (angle A) to the central crease (angle A+B).
 */
function gutterSpan(m: Mechanism): [number, number] {
  if (m.type === 'parallelFold') {
    return [m.centreMm - m.spanMm / 2, m.centreMm + m.spanMm / 2];
  }
  if (m.mount === 'cut') {
    // Cut beak: the triangular hollow runs from the apex to the slit.
    return [m.centreMm, m.centreMm + m.armMm];
  }
  // Glued V-fold: wings extend from the vertex toward the top; the sector
  // [A, A+B] projects onto the gutter between arm·cos(A) and arm·cos(A+B).
  const A = rad(m.baseAngleDeg);
  const AB = rad(m.baseAngleDeg + m.popupAngleDeg);
  const lo = m.centreMm - m.armMm * Math.cos(A);
  const hi = m.centreMm - m.armMm * Math.cos(AB);
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

/** All conflicts among the mechanisms: overlaps and per-mechanism validity. */
export function findConflicts(
  mechanisms: Mechanism[],
  card?: CardParams,
): MechanismConflict[] {
  const conflicts: MechanismConflict[] = [];

  // Pairwise: no two mechanisms may occupy overlapping gutter footprints.
  for (let i = 0; i < mechanisms.length; i++) {
    for (let j = i + 1; j < mechanisms.length; j++) {
      const a = gutterSpan(mechanisms[i]);
      const b = gutterSpan(mechanisms[j]);
      const overlap = a[0] < b[1] - EPS && b[0] < a[1] - EPS;
      if (overlap) {
        const bothSteps =
          mechanisms[i].type === 'parallelFold' && mechanisms[j].type === 'parallelFold';
        conflicts.push({
          ids: [mechanisms[i].id, mechanisms[j].id],
          message: bothSteps
            ? 'Step folds overlap — they can’t lift the same card material.'
            : 'Mechanisms overlap on the card — move them apart.',
        });
      }
    }
  }

  // Per-mechanism validity.
  for (const m of mechanisms) {
    if (m.type !== 'vFold') continue;
    if (m.mount === 'glued') {
      // Glued wings need popup angle ≥ base angle to open fully without tearing.
      if (m.popupAngleDeg < m.baseAngleDeg - EPS) {
        conflicts.push({
          ids: [m.id],
          message: 'V-fold binds before fully open — popup angle must be ≥ base angle.',
        });
      }
    } else {
      // Cut beak: the half-width must fit within a panel.
      const halfWidth = m.armMm * Math.tan(rad(m.spreadAngleDeg));
      if (card && halfWidth > card.panelWidthMm + EPS) {
        conflicts.push({
          ids: [m.id],
          message: 'Beak is too wide for the card — reduce the spread or ridge length.',
        });
      }
    }
  }

  return conflicts;
}

/** The set of mechanism ids involved in any conflict. */
export function conflictingIds(mechanisms: Mechanism[], card?: CardParams): Set<string> {
  const set = new Set<string>();
  for (const c of findConflicts(mechanisms, card)) {
    for (const id of c.ids) set.add(id);
  }
  return set;
}

/** Map each conflicting mechanism id to its (first) conflict message. */
export function conflictMessages(
  mechanisms: Mechanism[],
  card?: CardParams,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of findConflicts(mechanisms, card)) {
    for (const id of c.ids) {
      if (!map.has(id)) map.set(id, c.message);
    }
  }
  return map;
}
