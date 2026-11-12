import type { PhaseData } from '../data/phases';

/** Scroll spacer for one phase. The visible copy lives in the 3D scene (scene/Annotations). */
export function PhaseSection({ phase }: { phase: PhaseData }) {
  return (
    <section className="phase" data-id={phase.id} data-phase={phase.index} aria-label={phase.stripTitle}>
      <p className="sr-only">
        {phase.title.join(' ')} {phase.lede}
      </p>
    </section>
  );
}
