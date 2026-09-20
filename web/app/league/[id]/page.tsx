import Link from "next/link";
import { LeagueView } from "@/components/league-view";

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string | string[]; rank?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const rawRank = Array.isArray(query.rank) ? query.rank[0] : query.rank;
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : null;
  const teamRank = rawRank ? Number(rawRank.replace(/\D/g, "")) : null;

  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/"><span className="brand-mark">F</span><span>Footy</span></Link>
        <div className="nav-links">
          <Link href="/research">Research</Link>
          {teamId ? <Link href={`/team/${teamId}`}>My team</Link> : null}
          {teamId ? (
            <Link href={`/team/${teamId}?league=${id}#build-test`}>
              Build &amp; Test
            </Link>
          ) : (
            <Link href="/">Find team</Link>
          )}
          {teamId ? (
            <Link href={`/review?team=${teamId}&league=${id}`}>Review</Link>
          ) : null}
        </div>
      </nav>

      <div className="shell">
        <LeagueView
          leagueId={id}
          initialEntryId={teamId && Number.isInteger(teamId) && teamId > 0 ? teamId : undefined}
          initialRank={teamRank && Number.isInteger(teamRank) && teamRank > 0 ? teamRank : undefined}
        />
      </div>

      <footer className="shell footer">
        <p>Footy is unofficial and not affiliated with the Premier League or Fantasy Premier League.</p>
        <p>YOUR TEAM → YOUR LEAGUE → YOUR RIVALS → YOUR NEXT MOVE</p>
      </footer>
    </main>
  );
}
