
import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamPitch } from "@/components/team-pitch";
import { TeamRoomDashboard } from "@/components/team-room-dashboard";
import { ProductNav } from "@/components/product-nav";
import { getFplTeamDiscovery } from "@/lib/fpl-team";

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawLeague = Array.isArray(query.league)
    ? query.league[0]
    : query.league;
  const teamId = Number(id.replace(/\D/g, ""));
  const leagueId = rawLeague
    ? Number(rawLeague.replace(/\D/g, ""))
    : undefined;

  let team;

  try {
    team = await getFplTeamDiscovery(teamId);
  } catch (error) {
    return (
      <main className="league-edge-app team-room-page">
        <ProductNav active="hq" />
        <section className="shell team-discovery-error">
          <h1>We couldn&apos;t load this team.</h1>
          <p>
            {error instanceof Error
              ? error.message
              : "The official FPL feed did not return this team."}
          </p>
          <Link href="/">Back to FPL HQ</Link>
        </section>
      </main>
    );
  }

  const leagues = team.miniLeagues.length
    ? team.miniLeagues
    : team.otherClassicLeagues;

  if (!leagueId) {
    redirect("/?team=" + team.id);
  }

  const selectedLeague = leagues.find(
    (league) => league.id === leagueId,
  );

  if (!selectedLeague) {
    redirect("/?team=" + team.id);
  }

  return (
    <main className="league-edge-app team-room-page">
      <ProductNav
        active="team"
        teamHref={"/team/" + team.id + "?league=" + selectedLeague.id}
      />

      <header className="shell team-room-header">
        <div>
          <span>TEAM ROOM</span>
          <h1>{team.teamName}</h1>
          <p>
            {team.managerName}
            {team.region ? " · " + team.region : ""}
          </p>
        </div>
        <div className="team-room-context">
          <div>
            <span>League</span>
            <strong>{selectedLeague.name}</strong>
            <small>
              Rank #{selectedLeague.entry_rank ?? "—"}
            </small>
          </div>
          <div>
            <span>Points</span>
            <strong>{team.overallPoints.toLocaleString()}</strong>
            <small>
              Overall {team.overallRank?.toLocaleString() ?? "—"}
            </small>
          </div>
          <div>
            <span>Squad</span>
            <strong>£{team.squadValue.toFixed(1)}m</strong>
            <small>£{team.bank.toFixed(1)}m bank</small>
          </div>
        </div>
      </header>

      <section className="shell">
        <TeamRoomDashboard
          teamId={team.id}
          leagueId={selectedLeague.id}
          leagueName={selectedLeague.name}
          leagueRank={selectedLeague.entry_rank}
          squad={team.squad}
        />
      </section>

      <details className="shell team-room-pitch-disclosure">
        <summary>
          <div>
            <span>SQUAD MAP</span>
            <strong>View current squad</strong>
          </div>
          <small>Formation, captain, bench and availability →</small>
        </summary>
        <section className="team-room-pitch">
        <div className="team-room-block-head">
          <div>
            <span>CURRENT SQUAD</span>
            <h2>Your starting point</h2>
          </div>
          <small>
            GW{team.currentEvent} · {team.eventPoints ?? "—"} pts
          </small>
        </div>
        {team.squad.length ? (
          <TeamPitch squad={team.squad} />
        ) : (
          <div className="league-state">
            Current public squad temporarily unavailable.
          </div>
        )}
        </section>
      </details>

      <footer className="shell footer minimal-footer">
        <p>Team Room combines squad quality with the league battle.</p>
        <p>DECIDE → PLAN → TEST → REVIEW</p>
      </footer>
    </main>
  );
}
