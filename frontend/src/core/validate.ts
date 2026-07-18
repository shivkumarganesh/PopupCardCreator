import type { Mechanism } from './types';

/**
 * Design-level validation across mechanisms.
 *
 * The key physical rule for step folds: each one lifts a strip of the card's
 * own material. Two folds whose gutter strips overlap would need to lift the
 * same material twice — impossible. Touching (sharing a boundary) is fine;
 * true interior overlap is not.
 */

export interface MechanismConflict {
  ids: string[];
  message: string;
}

const EPS = 1e-6;

/** The gutter interval [lo, hi] a mechanism occupies, or null if it has none. */
function gutterSpan(m: Mechanism): [number, number] | null {
  if (m.type === 'parallelFold') {
    return [m.centreMm - m.spanMm / 2, m.centreMm + m.spanMm / 2];
  }
  return null;
}

/** All conflicts among the mechanisms: overlaps and per-mechanism validity. */
export function findConflicts(mechanisms: Mechanism[]): MechanismConflict[] {
  const conflicts: MechanismConflict[] = [];

  // Pairwise: step folds must not overlap (they'd share the same material).
  for (let i = 0; i < mechanisms.length; i++) {
    for (let j = i + 1; j < mechanisms.length; j++) {
      const a = gutterSpan(mechanisms[i]);
      const b = gutterSpan(mechanisms[j]);
      if (!a || !b) continue;
      const overlap = a[0] < b[1] - EPS && b[0] < a[1] - EPS;
      if (overlap) {
        conflicts.push({
          ids: [mechanisms[i].id, mechanisms[j].id],
          message: 'Step folds overlap — they can’t lift the same card material.',
        });
      }
    }
  }

  // Per-mechanism: a V-fold needs popup angle ≥ base angle to open fully.
  for (const m of mechanisms) {
    if (m.type === 'vFold' && m.popupAngleDeg < m.baseAngleDeg - EPS) {
      conflicts.push({
        ids: [m.id],
        message: 'V-fold binds before fully open — popup angle must be ≥ base angle.',
      });
    }
  }

  return conflicts;
}

/** The set of mechanism ids involved in any conflict. */
export function conflictingIds(mechanisms: Mechanism[]): Set<string> {
  const set = new Set<string>();
  for (const c of findConflicts(mechanisms)) {
    for (const id of c.ids) set.add(id);
  }
  return set;
}
