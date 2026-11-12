import { Logo } from './Logo';

export function Header({ onHome }: { onHome: () => void }) {
  return (
    <header className="mast">
      <a
        className="mark"
        href="#top"
        aria-label="DataCool — back to the start"
        data-magnetic
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
      >
        <Logo />
      </a>
      <div className="mid">PLATE HEAT EXCHANGER · SYSTEM DATASHEET</div>
      <div className="rev">
        REV <b>02</b> / 2026
      </div>
    </header>
  );
}
