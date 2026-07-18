import type { CardParams, FlatPattern, PatternLine } from './types';
import { SCORE_INSET_MM } from './types';

/**
 * Build the flat pattern for the base card: a single rectangle cut boundary
 * with one vertical valley score down the middle (the gutter).
 *
 * Pop-up mechanisms (V-folds, parallel folds) will append their own cut
 * polygons and fold lines here in later iterations, reusing the same
 * PatternLine vocabulary.
 */
export function buildBaseCardPattern(card: CardParams): FlatPattern {
  const width = card.panelWidthMm * 2;
  const height = card.heightMm;

  const outerCut: PatternLine = {
    kind: 'cut',
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
  };

  // Gutter runs vertically at x = panelWidth. Inset both ends so the score
  // stops short of the cut boundary instead of nicking the corner.
  const gutter: PatternLine = {
    kind: 'valley',
    closed: false,
    points: [
      { x: card.panelWidthMm, y: SCORE_INSET_MM },
      { x: card.panelWidthMm, y: height - SCORE_INSET_MM },
    ],
  };

  return { widthMm: width, heightMm: height, lines: [outerCut, gutter] };
}
