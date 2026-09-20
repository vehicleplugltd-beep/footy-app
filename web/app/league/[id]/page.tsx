import Link from "next/link";
import { LeagueView } from "@/components/league-view";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#pricing">Season passes</Link>
        </div>
      </nav>

      <div className="shell">
        <LeagueView leagueId={id} />
      </div>

      <footer className="shell footer">
        <p>
          Footy is unofficial and not affiliated with the Premier League or
          Fantasy Premier League. Probabilities are estimates, not guarantees.
        </p>
        <p>YOUR LEAGUE → YOUR RIVALS → YOUR NEXT MOVE</p>
      </footer>
    </main>
  );
}
