/**
 * Core domain types for the Pop-Up Card Creator.
 *
 * Everything in this module is expressed in millimetres (laser-native units)
 * and is deliberately free of three.js / React dependencies: the same data
 * drives both the 3D visualizer and the 2D SVG flat-pattern engine.
 */

/** A 2D point in flat-pattern space, millimetres. Origin = top-left of the sheet. */
export interface Point2 {
  x: number;
  y: number;
}

/** How the laser must treat a line, and how the 3D sim must fold it. */
export type LineKind = 'cut' | 'mountain' | 'valley';

/** An open polyline (fold/score) or closed polygon (cut) in the flat pattern. */
export interface PatternLine {
  kind: LineKind;
  points: Point2[];
  /** Closed paths get a `Z`; required true for every `cut` boundary. */
  closed: boolean;
}

/** The complete 2D flat pattern of a card design. */
export interface FlatPattern {
  widthMm: number;
  heightMm: number;
  lines: PatternLine[];
}

/** Parameters of the base card (two panels joined at the gutter). */
export interface CardParams {
  /** Width of ONE panel, gutter to outer edge, in mm. */
  panelWidthMm: number;
  /** Card height (along the gutter), in mm. */
  heightMm: number;
}

/**
 * A symmetric single-slit box/step fold cut directly from the base card.
 *
 * Two slits run perpendicular to the gutter; the freed strip between them
 * reverses its gutter crease (mountain instead of the card's valley) and
 * rises as a peak when the card opens. Cut-from-sheet, so it needs no glue
 * and flattens back into its own slot at 180°.
 */
export interface ParallelFoldMechanism {
  id: string;
  type: 'parallelFold';
  /** Distance from the top edge to the strip centre, along the gutter (mm). */
  centreMm: number;
  /** Strip width measured along the gutter (mm). */
  spanMm: number;
  /**
   * Crease depth from the gutter to each base crease (mm). Also the pop
   * projection: the peak reaches height 2·depth·cos(θ/2) above the gutter.
   */
  depthMm: number;
}

/**
 * A symmetric V-fold (angle fold): a glued patch, not cut from the card.
 *
 * Two wings meet at a central mountain crease rising from a vertex on the
 * gutter; each wing folds down to an attachment crease on a base panel where
 * a glue tab holds it. Modelled as a spherical four-bar (see `solveVFold`):
 * the popup sector angle B must be ≥ the base sector angle A for the fold to
 * open fully to 180° without tearing.
 */
export interface VFoldMechanism {
  id: string;
  type: 'vFold';
  /** Vertex position from the top edge, along the gutter (mm). */
  centreMm: number;
  /** Base sector angle A: gutter → attachment crease (degrees). */
  baseAngleDeg: number;
  /** Popup sector angle B: attachment crease → central crease (degrees). */
  popupAngleDeg: number;
  /** Length of the creases measured from the vertex (mm). */
  armMm: number;
  /** Glue-tab width along each attachment crease (mm). */
  tabMm: number;
}

export type Mechanism = ParallelFoldMechanism | VFoldMechanism;

/** Laser color conventions (xTool XCS maps operations by stroke color). */
export const LASER_COLORS: Record<LineKind, string> = {
  cut: '#FF0000',
  mountain: '#0000FF',
  valley: '#00FF00',
};

/** Hairline stroke width in mm for all laser vectors. */
export const LASER_STROKE_MM = 0.1;

/**
 * Fold/score lines are shortened by this much where they would meet a cut
 * edge, so the score never over-weakens a corner that the cut releases.
 */
export const SCORE_INSET_MM = 0.5;
