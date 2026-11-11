import { useEffect, useRef, useState } from 'react';
import { LASER } from '../core/types';
import { ICONS, Icon } from './ui';

const SLIDES = [
  {
    title: 'Red cuts, blue folds',
    body: 'Red lines are cut all the way through. Blue lines are fold lines: score them lightly with the laser (low power, one pass) or press them with a ruler and an empty pen, then fold. Sizes are real — what you set is what gets cut.',
    art: (
      <svg viewBox="0 0 240 120">
        <rect x="30" y="14" width="180" height="92" fill="var(--color-bg-default)" stroke={LASER.cut} strokeWidth="1.5" />
        <path d="M30 60h60M150 60h60" stroke={LASER.score} strokeWidth="1.5" strokeDasharray="6 4" />
        <path d="M90 84V44M150 84V44" stroke={LASER.cut} strokeWidth="1.5" />
        <path d="M90 84h60M90 44h60M90 60h60" stroke={LASER.score} strokeWidth="1.5" strokeDasharray="6 4" />
      </svg>
    ),
  },
  {
    title: 'Which way each fold goes',
    body: 'Every pop-up is a little step. The centre fold and the two folds where a step meets the card fold toward you (valley). The fold in the middle of each step — where the upright front meets the strut going back — folds away from you (mountain). Open the 3D preview and drag “Opening” to watch it.',
    art: (
      <svg viewBox="0 0 240 120" fill="none">
        <path d="M40 100h160M40 100V16" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
        <path d="M120 100V52H40" stroke="var(--color-text-primary)" strokeWidth="2.5" />
        <circle cx="120" cy="100" r="4" fill={LASER.score} />
        <circle cx="40" cy="52" r="4" fill={LASER.score} />
        <circle cx="120" cy="52" r="4" fill="var(--color-bg-default)" stroke={LASER.score} strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: 'Paper that works',
    body: 'Use 160–220 gsm card for the pop-up sheet: thin paper sags, thick board cracks on the folds. Glue-on pieces can be any coloured paper. Crease every fold both ways before closing the card for the first time, then press it shut once.',
    art: (
      <svg viewBox="0 0 240 120" fill="none">
        <path d="M50 84l70-30 70 30-70 30z" fill="var(--color-bg-default)" stroke="var(--color-stroke-strong)" strokeWidth="1.5" />
        <path d="M50 66l70-30 70 30-70 30z" fill="var(--color-bg-default)" stroke="var(--color-stroke-strong)" strokeWidth="1.5" />
        <path d="M50 48l70-30 70 30-70 30z" fill="var(--color-bg-default)" stroke="var(--color-text-primary)" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'Glue-on pieces',
    body: 'Fold the card first so every tab stands up. Glue each piece to the front of its tab with its foot on the floor. A piece with a slot at its foot slides down over the strut of the piece in front of it — work from the back wall forward.',
    art: (
      <svg viewBox="0 0 240 120" fill="none">
        <path d="M30 104h180" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
        <rect x="104" y="64" width="32" height="40" fill="var(--color-bg-default)" stroke={LASER.cut} strokeWidth="1.5" />
        <path d="M120 22c-26 0-44 18-44 40 0 20 18 34 44 42 26-8 44-22 44-42 0-22-18-40-44-40z" fill="var(--color-red-subtlest)" stroke="var(--color-red-default)" strokeWidth="1.5" opacity=".9" />
      </svg>
    ),
  },
  {
    title: 'No laser? Scissors work',
    body: '“Print template for scissors” prints every sheet at full size: solid lines to cut, dashed lines to fold. Fold the card in half and snip the tabs straight in from the folded edge; use a craft knife for shapes cut from the card itself.',
    art: (
      <svg viewBox="0 0 240 120" fill="none" stroke="var(--color-text-primary)" strokeWidth="1.5">
        <rect x="40" y="20" width="160" height="80" fill="var(--color-bg-default)" />
        <path d="M40 60h160" strokeDasharray="6 4" />
        <path d="M100 40v40M140 40v40" />
        <path d="M100 40h40M100 80h40" strokeDasharray="6 4" />
      </svg>
    ),
  },
];

export function TipsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) {
      setI(0);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);
  const last = i === SLIDES.length - 1;
  return (
    <dialog className="dialog" ref={ref} aria-labelledby="tips-title" onClose={onClose}>
      <div className="dialog-header">
        <span id="tips-title">Fabrication Tips</span>
        <span className="spacer" aria-hidden="true" />
        <span className="sr-only" aria-live="polite">{i + 1} / {SLIDES.length}</span>
        <button type="button" className="btn-icon btn-icon-sm" aria-label="Close" onClick={onClose}><Icon d={ICONS.close} /></button>
      </div>
      <div className="dialog-media tips-art" aria-hidden="true">{SLIDES[i].art}</div>
      <div className="dialog-body">
        <div className="tip-slide">
          <h3>{SLIDES[i].title}</h3>
          <p>{SLIDES[i].body}</p>
        </div>
      </div>
      <div className="dialog-footer">
        <div className="dots" aria-hidden="true">
          {SLIDES.map((_, k) => <i key={k} aria-current={k === i ? 'true' : undefined} />)}
        </div>
        <span className="spacer" aria-hidden="true" />
        <button type="button" className="btn btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button type="button" className="btn btn-primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
      </div>
    </dialog>
  );
}
