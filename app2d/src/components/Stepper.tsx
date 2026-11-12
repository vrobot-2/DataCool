import { PHASES } from '../data/phases';

/** Right-edge phase stepper; click scrolls (via Lenis) to that phase. */
export function Stepper({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  return (
    <nav className="stepper" aria-label="Phases">
      {PHASES.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`dot${p.index === active ? ' is-active' : ''}`}
          aria-label={`${p.eyebrowNo} ${p.stripTitle}`}
          aria-current={p.index === active ? 'step' : undefined}
          data-magnetic
          onClick={() => onSelect(p.index)}
        >
          <span className="dot-label">{p.stripTitle}</span>
          <i />
        </button>
      ))}
    </nav>
  );
}

/** Tiny "scroll" cue, shown until the first scroll. */
export function ScrollHint({ show }: { show: boolean }) {
  return (
    <div className={`hint${show ? ' is-on' : ''}`} aria-hidden="true">
      <span>Scroll</span>
      <i />
    </div>
  );
}
