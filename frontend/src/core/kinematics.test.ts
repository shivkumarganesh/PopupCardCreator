import { describe, expect, it } from 'vitest';
import {
  isParallelogramFold,
  panelDirection,
  parallelFoldClosesFlat,
  parallelFoldOpensTo,
  solveParallelFold,
  solveVFold,
  solveVFoldAsym,
  vFoldApexHeight,
  vFoldClosedPosition,
  vFoldFoldsFlat,
  vFoldOpensTo,
} from './kinematics';

const deg = (d: number) => (d * Math.PI) / 180;

describe('panelDirection', () => {
  it('is flat along ±x when the card is fully open', () => {
    expect(panelDirection(Math.PI, 'right').x).toBeCloseTo(1);
    expect(panelDirection(Math.PI, 'right').y).toBeCloseTo(0);
    expect(panelDirection(Math.PI, 'left').x).toBeCloseTo(-1);
  });

  it('points straight up when the card is closed', () => {
    expect(panelDirection(0, 'right')).toEqual({ x: 0, y: 1 });
    expect(panelDirection(0, 'left')).toEqual({ x: -0, y: 1 });
  });
});

describe('solveParallelFold', () => {
  const parallelogram = { p: 30, q: 20, a: 20, b: 30 }; // a=q, b=p

  it('recognizes the parallelogram (slit-cut step fold) case', () => {
    expect(isParallelogramFold(parallelogram)).toBe(true);
    expect(parallelFoldClosesFlat(parallelogram)).toBe(true);
  });

  it('parallelogram ridge equals the vector sum A + C at any angle', () => {
    // With gutter at the origin, GACB is a parallelogram, so B = A + C.
    for (const theta of [deg(30), deg(90), deg(150)]) {
      const pose = solveParallelFold(parallelogram, theta);
      expect(pose).not.toBeNull();
      expect(pose!.B.x).toBeCloseTo(pose!.A.x + pose!.C.x, 6);
      expect(pose!.B.y).toBeCloseTo(pose!.A.y + pose!.C.y, 6);
    }
  });

  it('slit-cut step fold flattens exactly at 180° (ridge height 0)', () => {
    const pose = solveParallelFold(parallelogram, Math.PI);
    expect(pose).not.toBeNull();
    expect(pose!.B.y).toBeCloseTo(0, 6);
  });

  it('folds flat when closed: everything collapses onto the vertical line', () => {
    const pose = solveParallelFold({ p: 25, q: 25, a: 15, b: 15 }, 0);
    expect(pose).not.toBeNull();
    expect(pose!.B.x).toBeCloseTo(0, 6);
    expect(pose!.B.y).toBeCloseTo(40, 6); // p + a
  });

  it('rises inside the valley (positive ridge height) mid-opening', () => {
    const pose = solveParallelFold(parallelogram, deg(90));
    expect(pose!.B.y).toBeGreaterThan(0);
    const midBase = (pose!.A.y + pose!.C.y) / 2;
    expect(pose!.B.y).toBeGreaterThan(midBase);
  });

  it('binds (tears) when the popup is too short to span its creases', () => {
    // a + b < p + q: crease separation 2·30·sin(θ/2) exceeds the popup's
    // reach (40mm) once θ > 2·arcsin(40/60) ≈ 83.6°.
    const tooShort = { p: 30, q: 30, a: 20, b: 20 };
    expect(parallelFoldOpensTo(tooShort, deg(60))).toBe(true);
    expect(parallelFoldOpensTo(tooShort, deg(120))).toBe(false);
    expect(parallelFoldOpensTo(tooShort, Math.PI)).toBe(false);
  });

  it('glued platform with a+b > p+q still stands at 180°', () => {
    const platform = { p: 20, q: 20, a: 30, b: 30 };
    const pose = solveParallelFold(platform, Math.PI);
    expect(pose).not.toBeNull();
    expect(pose!.B.y).toBeGreaterThan(0);
  });

  it('detects asymmetric folds that cannot close flat', () => {
    expect(parallelFoldClosesFlat({ p: 30, q: 20, a: 20, b: 20 })).toBe(false);
  });
});

describe('solveVFold', () => {
  it('folds flat when the card closes: δ = A + B on the erect branch', () => {
    const pose = solveVFold({ A: deg(40), B: deg(50) }, 0);
    expect(pose).not.toBeNull();
    expect(pose!.delta).toBeCloseTo(deg(90), 6);
  });

  it('inverted branch folds flat to δ = A − B', () => {
    const pose = solveVFold({ A: deg(60), B: deg(75), branch: 'down' }, 0);
    expect(pose!.delta).toBeCloseTo(deg(60) - deg(75), 6);
  });

  it('B = A lies flat against the card at 180°', () => {
    const pose = solveVFold({ A: deg(45), B: deg(45) }, Math.PI);
    expect(pose).not.toBeNull();
    expect(pose!.delta).toBeCloseTo(0, 6);
    expect(pose!.central.y).toBeCloseTo(0, 6); // no elevation
  });

  it('B > A stands erect at 180° with cos δ = cos B / cos A', () => {
    const A = deg(45);
    const B = deg(60);
    const pose = solveVFold({ A, B }, Math.PI);
    expect(pose).not.toBeNull();
    expect(Math.abs(Math.cos(pose!.delta))).toBeCloseTo(Math.cos(B) / Math.cos(A), 6);
    expect(vFoldApexHeight(pose!, 50)).toBeGreaterThan(0);
  });

  it('B < A binds before 180° — the tear condition', () => {
    const params = { A: deg(60), B: deg(45) };
    expect(vFoldOpensTo(params, deg(90))).toBe(true);
    expect(vFoldOpensTo(params, Math.PI)).toBe(false);
  });

  it('satisfies the loop closure equation at every opening angle', () => {
    const A = deg(50);
    const B = deg(65);
    for (const theta of [deg(20), deg(90), deg(160)]) {
      const pose = solveVFold({ A, B }, theta)!;
      const { central, attachLeft, attachRight } = pose;
      for (const u of [attachLeft, attachRight]) {
        const dot = u.x * central.x + u.y * central.y + u.z * central.z;
        expect(dot).toBeCloseTo(Math.cos(B), 6); // rigid popup panel
      }
    }
  });

  it('attachment creases are unit vectors lying in their base panels', () => {
    const theta = deg(70);
    const pose = solveVFold({ A: deg(30), B: deg(40) }, theta)!;
    const len = Math.hypot(pose.attachRight.x, pose.attachRight.y, pose.attachRight.z);
    expect(len).toBeCloseTo(1, 9);
    // In-panel: expressible as cos A·ẑ + sin A·r̂.
    const r = panelDirection(theta, 'right');
    expect(pose.attachRight.x).toBeCloseTo(Math.sin(deg(30)) * r.x, 9);
    expect(pose.attachRight.y).toBeCloseTo(Math.sin(deg(30)) * r.y, 9);
  });
});

describe('solveVFoldAsym', () => {
  it('matches the symmetric solver when both sides are equal', () => {
    const A = deg(45);
    const B = deg(65);
    for (const theta of [deg(30), deg(90), deg(160)]) {
      const sym = solveVFold({ A, B }, theta)!;
      const asym = solveVFoldAsym({ aL: A, bL: B, aR: A, bR: B }, theta)!;
      expect(asym.central.x).toBeCloseTo(sym.central.x, 6);
      expect(asym.central.y).toBeCloseTo(sym.central.y, 6);
      expect(asym.central.z).toBeCloseTo(sym.central.z, 6);
    }
  });

  it('satisfies both rigid-panel constraints for asymmetric angles', () => {
    const params = { aL: deg(40), bL: deg(70), aR: deg(55), bR: deg(55) };
    for (const theta of [deg(40), deg(110), deg(175)]) {
      const pose = solveVFoldAsym(params, theta)!;
      const dotL =
        pose.attachLeft.x * pose.central.x +
        pose.attachLeft.y * pose.central.y +
        pose.attachLeft.z * pose.central.z;
      const dotR =
        pose.attachRight.x * pose.central.x +
        pose.attachRight.y * pose.central.y +
        pose.attachRight.z * pose.central.z;
      expect(dotL).toBeCloseTo(Math.cos(params.bL), 6);
      expect(dotR).toBeCloseTo(Math.cos(params.bR), 6);
    }
  });

  it('binds before 180° when a side has B < A (tear condition)', () => {
    const params = { aL: deg(60), bL: deg(45), aR: deg(45), bR: deg(60) };
    expect(solveVFoldAsym(params, deg(90))).not.toBeNull();
    expect(solveVFoldAsym(params, Math.PI)).toBeNull();
  });
});

describe('constraint validators', () => {
  it('Kawasaki condition for asymmetric V-folds', () => {
    expect(vFoldFoldsFlat(deg(40), deg(60), deg(50), deg(50))).toBe(true);
    expect(vFoldFoldsFlat(deg(40), deg(60), deg(50), deg(55))).toBe(false);
  });

  it('closed-card position lands at angle A+B from the gutter (erect branch)', () => {
    const closed = vFoldClosedPosition({ A: deg(45), B: deg(75) }, 40);
    const angle = deg(45) + deg(75);
    expect(closed.x).toBeCloseTo(40 * Math.sin(angle), 6);
    expect(closed.y).toBeCloseTo(40 * Math.cos(angle), 6);
  });
});
