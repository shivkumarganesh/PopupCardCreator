/**
 * Core domain types for the Pop-Up Card Creator.
 *
 * COORDINATE SYSTEMS (the one place they are documented)
 *
 *  Outline space  — a shape's own silhouette. Unitless, y UP, the shape stands
 *                   on y = 0, height is exactly 1, x runs 0 … aspect.
 *  Flat space     — the unfolded card sheet, millimetres, y UP. x runs 0 … W
 *                   along the centre fold. The centre fold (gutter) is y = 0;
 *                   the FLOOR panel is y ∈ [-P, 0], the BACK WALL is y ∈ [0, P].
 *                   This is the geometry IR: the 2D editor, the 3D preview and
 *                   the exported file are all derived from it.
 *  Export space   — flat space mirrored to y DOWN (SVG), millimetres, 1:1.
 *  3D space       — millimetres, y up. The gutter lies on the x axis, the floor
 *                   panel lies in the ground plane toward +z (the viewer), the
 *                   back wall rotates up about the gutter (see pose.ts).
 *
 * Nothing in src/core touches the DOM or three.js.
 */

export type Pt = [number, number];
/** A ring WITHOUT a repeated closing point. */
export type Ring = Pt[];
/** [outer, ...holes] */
export type Poly = Ring[];
export type MultiPoly = Poly[];

export interface CardSpec {
  /** Card width along the centre fold (mm). */
  widthMm: number;
  /** Depth of ONE panel, centre fold → outer edge (mm). */
  panelMm: number;
  /** Paper colour of the pop-up sheet. */
  color: string;
  /** Add a slightly larger backing cover that shows through the cut-outs. */
  backing: boolean;
  backingColor: string;
}

/**
 * How an element is made:
 *  - 'fused': cut from the card sheet itself. Its silhouette folds up out of
 *    the card and a strut cut from the same sheet holds it — no glue.
 *  - 'glued': a separate piece (any paper colour) glued to the front of a small
 *    box tab cut from the card. Pieces can overlap each other in depth.
 */
export type BuildMode = 'fused' | 'glued';

export interface PopElement {
  id: string;
  name: string;
  /** Silhouette in outline space. */
  outline: MultiPoly;
  /** Outline width / height. */
  aspect: number;
  /** Centre of the element along the card width (mm). */
  xMm: number;
  /** How far in front of the back wall it stands (mm). */
  depthMm: number;
  /** Standing height (mm). Width follows from the aspect ratio. */
  heightMm: number;
  mode: BuildMode;
  /** Where the support strut sits across the element, -1 (left) … 1 (right). */
  supportOffset: number;
  supportWidthMm: number;
  /** Paper colour of a glued piece. */
  color: string;
  /**
   * Glue-on only: use a short tab (8 mm) instead of one as tall as it is deep. Its strut then
   * runs low along the floor and passes under the scenery standing behind it.
   */
  lowTab?: boolean;
}

export interface Design {
  card: CardSpec;
  elements: PopElement[];
}

/** How a line is produced: cut through, or scored and folded. */
export type LineKind = 'cut' | 'valley' | 'mountain';

export interface PatternLine {
  kind: LineKind;
  points: Pt[];
  closed: boolean;
  /** Element that owns the line (undefined for the card outline / gutter). */
  elementId?: string;
}

/**
 * A rigid piece of paper in flat space plus the hinge data that places it in
 * 3D at any opening angle (see pose.ts).
 */
export type PartRole = 'floor' | 'wall' | 'front' | 'bridge' | 'piece' | 'backFloor' | 'backWall';

export interface Part {
  role: PartRole;
  elementId?: string;
  region: MultiPoly;
  color: string;
  /** Element depth d (front / bridge / piece). */
  depth: number;
  /** Height above the floor at which the strut leaves the front face. */
  strut: number;
  /** Stacking layer: -1 backing, 0 card sheet, 1 glued piece. */
  layer: number;
}

/** A separately cut, glued-on piece, in flat space at its "lying down" position. */
export interface LoosePiece {
  elementId: string;
  name: string;
  color: string;
  region: MultiPoly;
}

export interface Issue {
  severity: 'error' | 'warning';
  elementId?: string;
  message: string;
  /** What the user can do about it. */
  fix: string;
}

export interface CardModel {
  card: CardSpec;
  parts: Part[];
  /** Cut and fold lines of the card sheet, flat space. */
  lines: PatternLine[];
  pieces: LoosePiece[];
  issues: Issue[];
  /** Flat-space footprint per element, for hit-testing and selection. */
  footprints: Record<string, { region: MultiPoly; bbox: BBox; support: BBox }>;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Clearances and limits (mm). */
export const LIMITS = {
  /** Keep-out margin from the card edge. */
  edge: 3,
  /** Smallest gap between two neighbouring tabs. */
  gap: 2,
  minDepth: 6,
  minHeight: 10,
  minSupport: 4,
  /** How much larger the backing cover is on every side. */
  backingMargin: 3,
  paperMm: 0.3,
} as const;

/** Atomm / xTool processing colours: red stroke = cut, blue stroke = score. */
export const LASER = { cut: '#FE0002', score: '#2366FF', strokeMm: 0.1 } as const;
