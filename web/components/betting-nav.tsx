import Link from "next/link";

export function BettingNav({ active }: { active: "edge" | "bets" }) {
  return (
    <nav className="betting-nav shell" aria-label="Footy betting">
      <Link className="betting-brand" href="/betting">
        <span className="betting-brand-mark">F</span>
        <span>
          <strong>Footy</strong>
          <small>EDGE</small>
        </span>
      </Link>

      <div className="betting-nav-links">
        <Link
          href="/betting"
          className={active === "edge" ? "active" : undefined}
          aria-current={active === "edge" ? "page" : undefined}
        >
          Edge
        </Link>
        <Link
          href="/betting/my-bets"
          className={active === "bets" ? "active" : undefined}
          aria-current={active === "bets" ? "page" : undefined}
        >
          My Bets
        </Link>
        <Link href="/research">Football Research</Link>
        <Link href="/">FPL</Link>
      </div>
    </nav>
  );
}
