import { Fragment, useEffect, useRef } from 'react';
import { PHASES } from '../data/phases';
import { HEROES } from './heroes';

/** One plain-English sentence per phase: the thing to remember if you read nothing else. */
const PLAIN = [
  'Servers make heat. We catch it, sell it, and shrink the cooling bill.',
  'Liquid touches the hot chips directly, so fans and air-conditioning barely have to work.',
  'Sealed pipes carry the heat away. Nothing evaporates and nothing touches the electronics.',
  'Row after row of racks hand their heat to one shared loop.',
  'The heat crosses a metal plate into the city’s water. The two loops never mix.',
  'Warmed water leaves the building through an insulated pipe.',
  'Under the street, that pipe carries the warmth across town.',
  'Homes and offices get heat they would otherwise burn gas for.',
  'Lower cooling bills, a new revenue line, and a payback measured in years, not decades.',
];

// numbers with units ($2.2M, 70 %, 85 °C, 4.2 L/s, 5.5 yr, 13,702 t ...) get picked out in the accent colour
const NUM = /(\$?\d[\d,.]*(?:\s?(?:%|°C|MWh|GWh|MW|kW|L\/s|M|k|yr|years|t)\b)?)/g;

function Hi({ text }: { text: string }) {
  const parts = text.split(NUM);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <b className="hi" key={i}>
            {p}
          </b>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Copy panel + hero figure for the active phase (DOM, over the 2D film). */
export function FilmUI({ active, reducedMotion }: { active: number; reducedMotion: boolean }) {
  const i = Math.min(active, PHASES.length - 1);
  const p = PHASES[i];
  const hero = HEROES[Math.min(i, HEROES.length - 1)];
  const valueRef = useRef<HTMLDivElement | null>(null);
  const right = i % 2 === 1;
  const last = i === PHASES.length - 1;

  // count-up when a phase appears
  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    if (reducedMotion) {
      el.textContent = hero.format(hero.value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = hero.format(hero.value * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hero, reducedMotion]);

  return (
    <div className="film-ui" aria-live="polite">
      <div className={`note-slot${right ? ' right' : ''}`} key={`n${p.id}`}>
        <div className="note note--big note--read">
          <div className="note-top">
            <p className="note-eyebrow">
              <i>{p.eyebrowNo}</i> {p.eyebrow}
            </p>
            <span className="note-step" aria-hidden="true">
              {String(Math.min(i, 8) + 1).padStart(2, '0')}
              <em> / 09</em>
            </span>
          </div>
          <h2 className="note-title">
            {p.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p className="note-plain">
            <Hi text={PLAIN[Math.min(i, PLAIN.length - 1)]} />
          </p>
          <ul className="note-specs note-specs--read">
            {p.specs.map((s, k) => (
              <li key={s.key} style={{ ['--k' as string]: k } as React.CSSProperties}>
                <b>{s.key}</b>
                <span>
                  <Hi text={s.text} />
                </span>
              </li>
            ))}
          </ul>
          <p className="sr-only">{p.lede}</p>
          {last && <p className="note-foot">Modelled estimates. Every assumption is editable in the calculator below.</p>}
        </div>
      </div>
      <div className={`hero-slot${right ? ' left' : ''}`} key={`h${p.id}`}>
        <div className="hero-value" ref={valueRef}>
          {hero.format(hero.value)}
        </div>
        {hero.unit && <div className="hero-unit">{hero.unit}</div>}
        <div className="hero-label">{hero.label}</div>
      </div>
    </div>
  );
}
