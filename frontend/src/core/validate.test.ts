import { describe, expect, it } from 'vitest';
import { conflictingIds, findConflicts } from './validate';
import type { ParallelFoldMechanism } from './types';

const fold = (id: string, centreMm: number, spanMm = 60): ParallelFoldMechanism => ({
  id,
  type: 'parallelFold',
  centreMm,
  spanMm,
  depthMm: 30,
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
});
