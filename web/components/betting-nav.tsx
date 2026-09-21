import Link from "next/link";

type BettingArea = "edge" | "results" | "tools" | "bets";

export function BettingNav({ active }: { active: BettingArea }) {
  const items = [
    { key: "edge" as const, label: "Today", href: "/betting" },
    { key: "results" as const, label: "Results", href: "/betting/results" },
    { key: "tools" as const, label: "Bet Lab", href: "/betting/tools" },
    { key: "bets" as const, label: "My Bets", href: "/betting/my-bets" },
  ];

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
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={active === item.key ? "active" : undefined}
            aria-current={active === item.key ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/" aria-label="Open Footy FPL">
          FPL
        </Link>
      </div>
    </nav>
  );
}
