import { useMemo } from 'react';
import { buildCardPattern } from '../core/flatPattern';
import { patternToSvg } from '../core/svgExport';
import { useCardStore } from '../state/store';

/**
 * Live 2D flat-pattern pane. The preview IS the export: the same SVG string
 * that gets downloaded is what's rendered, so what you see is exactly what
 * the laser receives.
 */
export function FlatPatternView() {
  const card = useCardStore((s) => s.card);
  const mechanisms = useCardStore((s) => s.mechanisms);

  // The exporter validates the pattern and throws on laser-invalid geometry
  // (e.g. two mechanisms overlapping into a double-burn). Surface that as a
  // warning rather than letting it crash the app.
  const { svg, error } = useMemo(() => {
    try {
      return { svg: patternToSvg(buildCardPattern(card, mechanisms)), error: null as string | null };
    } catch (e) {
      return { svg: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [card, mechanisms]);

  const download = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'popup-card.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flat-pattern">
      <div className="flat-pattern-header">
        <h2>Flat pattern</h2>
        <button onClick={download} disabled={!svg}>
          Export SVG
        </button>
      </div>
      {error ? (
        <div className="flat-pattern-error">
          ⚠ Cannot export: {error}
          <span>Adjust the mechanisms so they don’t overlap.</span>
        </div>
      ) : (
        <div
          className="flat-pattern-canvas"
          // Rendering the exact export string guarantees WYSIWYG with the laser file.
          dangerouslySetInnerHTML={{ __html: svg! }}
        />
      )}
      <ul className="legend">
        <li><span className="swatch" style={{ background: '#FF0000' }} /> Cut</li>
        <li><span className="swatch" style={{ background: '#0000FF' }} /> Mountain fold (score)</li>
        <li><span className="swatch" style={{ background: '#00FF00' }} /> Valley fold (score)</li>
      </ul>
    </div>
  );
}
