import { solveVFoldAsym } from './kinematics';
import type { CardParams, Mechanism, VFoldMechanism } from './types';
import { vFoldSectorAngles } from './types';

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
  const fz = m.flipped ? -1 : 1;
  if (m.mount === 'cut') {
    // Cut beak: the triangular hollow runs from the apex to the slit.
    const slit = m.centreMm + fz * m.armMm;
    return [Math.min(m.centreMm, slit), Math.max(m.centreMm, slit)];
  }
  // Glued V-fold: wings extend from the vertex along the gutter; each side's
  // sector [A, A+B] projects onto the gutter between arm·cos(A) and arm·cos(A+B).
  const { aL, bL, aR, bR } = vFoldSectorAngles(m);
  const proj = [aL, aL + bL, aR, aR + bR].map((deg) => m.centreMm - fz * m.armMm * Math.cos(rad(deg)));
  return [Math.min(...proj), Math.max(...proj)];
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
      const msg = gluedVFoldWarning(m, card);
      if (msg) conflicts.push({ ids: [m.id], message: msg });
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

/**
 * The first constraint a glued V-fold violates, or null if it is valid:
 *  - tear: the spherical four-bar has no closure at 180° (a side has B < A);
 *  - Kawasaki: A_L + B_L ≠ A_R + B_R, so the card can't close flat;
 *  - containment: a wing tip lands outside the card when folded flat.
 */
function gluedVFoldWarning(m: VFoldMechanism, card?: CardParams): string | null {
  const { aL, bL, aR, bR } = vFoldSectorAngles(m);

  if (!solveVFoldAsym({ aL: rad(aL), bL: rad(bL), aR: rad(aR), bR: rad(bR) }, Math.PI)) {
    return 'V-fold binds before fully open — each popup angle must be ≥ its base angle.';
  }

  if (Math.abs(aL + bL - (aR + bR)) > 0.5) {
    return 'V-fold won’t close flat — left and right (base + popup) angles must match.';
  }

  if (card) {
    // Folded flat (θ = 0), each wing tip sits at angle A+B, distance arm.
    const fz = m.flipped ? -1 : 1;
    const tipOutside = (sectorDeg: number) => {
      const t = rad(sectorDeg);
      const x = m.armMm * Math.sin(t); // across the gutter into the panel
      const y = m.centreMm - fz * m.armMm * Math.cos(t); // along the gutter
      return x > card.panelWidthMm + EPS || y < -EPS || y > card.heightMm + EPS;
    };
    if (tipOutside(aL + bL) || tipOutside(aR + bR)) {
      return 'V-fold extends past the card edge when closed — shorten the arm.';
    }
  }

  return null;
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
