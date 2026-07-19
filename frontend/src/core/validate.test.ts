import { describe, expect, it } from 'vitest';
import { conflictingIds, findConflicts } from './validate';
import type { ParallelFoldMechanism, VFoldMechanism } from './types';

const fold = (id: string, centreMm: number, spanMm = 60): ParallelFoldMechanism => ({
  id,
  type: 'parallelFold',
  centreMm,
  spanMm,
  depthMm: 30,
});

const vfold = (id: string, over: Partial<VFoldMechanism> = {}): VFoldMechanism => ({
  id,
  type: 'vFold',
  mount: 'glued',
  centreMm: 90,
  symmetric: true,
  baseAngleDeg: 45,
  popupAngleDeg: 60,
  baseAngleRightDeg: 45,
  popupAngleRightDeg: 60,
  armMm: 50,
  spreadAngleDeg: 40,
  tabMm: 10,
  ...over,
});

describe('findConflicts', () => {
  it('reports no conflict for well-separated folds', () => {
    expect(findConflicts([fold('a', 40), fold('b', 140)])).toHaveLength(0);
  });

  it('allows folds that merely touch at a boundary', () => {
    // [10,70] and [70,130] share only the boundary at 70.
    expect(findConflicts([fold('a', 40), fold('b', 100)])).toHaveLength(0);
  });

  it('flags overlapping folds', () => {
    // [90,126] and [82,142] overlap — the case from the bug report.
    const conflicts = findConflicts([fold('a', 108, 36), fold('b', 112, 60)]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].ids).toEqual(['a', 'b']);
  });

  it('collects every conflicting id', () => {
    const ids = conflictingIds([fold('a', 100), fold('b', 110), fold('c', 40)]);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
    expect(ids.has('c')).toBe(false);
  });

  it('flags a V-fold overlapping a step fold at the same position', () => {
    const step = fold('s', 101); // spans [71, 131]
    const v = vfold('v', { centreMm: 101, baseAngleDeg: 49 });
    const conflicts = findConflicts([step, v]);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    const ids = conflictingIds([step, v]);
    expect(ids.has('s')).toBe(true);
    expect(ids.has('v')).toBe(true);
  });

  it('does not flag a V-fold placed well clear of a step fold', () => {
    const step = fold('s', 40); // spans [10, 70]
    const v = vfold('v', { centreMm: 160, armMm: 40 });
    expect(findConflicts([step, v])).toHaveLength(0);
  });

  it('flags a glued V-fold whose popup angle is below its base angle', () => {
    const bad = vfold('v', { baseAngleDeg: 60, popupAngleDeg: 45 });
    expect(findConflicts([bad])).toHaveLength(1);
    // A valid V-fold (B ≥ A) is fine.
    expect(findConflicts([vfold('v', { popupAngleDeg: 70 })])).toHaveLength(0);
  });

  it('flags an asymmetric V-fold that won’t close flat (Kawasaki)', () => {
    // A_L+B_L = 45+60 = 105; A_R+B_R = 50+50 = 100 → not flat-foldable.
    const bad = vfold('v', {
      symmetric: false,
      baseAngleDeg: 45,
      popupAngleDeg: 60,
      baseAngleRightDeg: 50,
      popupAngleRightDeg: 50,
    });
    const msgs = conflictingIds([bad]);
    expect(msgs.has('v')).toBe(true);
    // A matched asymmetric pair (both sum to 105) is fine.
    const ok = vfold('v', {
      symmetric: false,
      baseAngleDeg: 40,
      popupAngleDeg: 65,
      baseAngleRightDeg: 50,
      popupAngleRightDeg: 55,
    });
    expect(findConflicts([ok])).toHaveLength(0);
  });

  it('flags a V-fold whose wing extends past the card edge when closed', () => {
    const card = { panelWidthMm: 130, heightMm: 180 };
    // arm·sin(A+B) = 120·sin(105°) ≈ 116 < 130 across, but tip along the gutter
    // y = 20 − 120·cos(105°) ≈ 51 is fine; push the arm long enough to exceed.
    const big = vfold('v', { centreMm: 20, armMm: 200 });
    expect(findConflicts([big], card).some((c) => c.ids.includes('v'))).toBe(true);
    // A modest arm stays inside.
    const small = vfold('v', { centreMm: 90, armMm: 40 });
    expect(findConflicts([small], card)).toHaveLength(0);
  });

  it('flags a cut beak that is too wide for the card', () => {
    // half-width = arm·tan(spread) = 100·tan(60°) ≈ 173 > panelWidth 130.
    const wide = vfold('v', { mount: 'cut', armMm: 100, spreadAngleDeg: 60 });
    const card = { panelWidthMm: 130, heightMm: 180 };
    expect(findConflicts([wide], card)).toHaveLength(1);
    // A narrower beak fits.
    const ok = vfold('v', { mount: 'cut', armMm: 40, spreadAngleDeg: 40 });
    expect(findConflicts([ok], card)).toHaveLength(0);
  });
});
