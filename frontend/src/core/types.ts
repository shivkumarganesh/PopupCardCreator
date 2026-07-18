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
