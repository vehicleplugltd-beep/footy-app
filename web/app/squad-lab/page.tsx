import Link from "next/link";
import { SquadLab } from "@/components/squad-lab";
import { getFplTeamDiscovery } from "@/lib/fpl-team";
import { getPlayerDatabase } from "@/lib/fpl";

export default async function SquadLabPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[]; league?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : undefined;
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : undefined;

  const [data, team] = await Promise.all([
    getPlayerDatabase(),
    teamId && Number.isInteger(teamId) && teamId > 0
      ? getFplTeamDiscovery(teamId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          {teamId ? <Link href={`/team/${teamId}`}>My team</Link> : <Link href="/">Find team</Link>}
          <Link href="/results">Receipts</Link>
        </div>
      </nav>

      <div className="shell">
        <SquadLab
          players={data.players}
          dataRetrievedAt={data.dataRetrievedAt}
          freshness={data.freshness}
          processTeams={data.processTeams}
          initialPlayerIds={team?.squad.map((player) => player.id) ?? []}
          teamId={teamId}
          leagueId={leagueId}
          teamName={team?.teamName}
        />
      </div>

      <footer className="shell footer">
        <p>Official FPL player data enriched with Footy&apos;s underlying football process and league context.</p>
        <p>SEARCH → SIMULATE → COMPARE → DECIDE</p>
      </footer>
    </main>
  );
}
