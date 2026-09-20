
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFplTeamDiscovery } from "@/lib/fpl-team";
import { NextMoveCommand } from "@/components/next-move-command";
import { BuildTestWorkspace } from "@/components/build-test-workspace";
import { footyQuip } from "@/lib/footy-voice";

export default async function PreviewPage({
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

  const team = await getFplTeamDiscovery(teamId);
  const leagues = team.miniLeagues.length
    ? team.miniLeagues
    : team.otherClassicLeagues.slice(0, 12);

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
    <main className="league-edge-app preview-page">
      <nav className="nav shell hq-nav">
        <Link
          className="brand brand-link"
          href={
            "/team/" +
            team.id +
            "?league=" +
            selectedLeague.id
          }
        >
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="hq-nav-right">
          <Link
            href={
              "/team/" +
              team.id +
              "?league=" +
              selectedLeague.id
            }
          >
            Team Room
          </Link>
          <Link href={"/?team=" + team.id}>HQ</Link>
        </div>
      </nav>

      <header className="shell preview-header">
        <span>PREVIEW</span>
        <h1>Follow Footy’s route — or build your own.</h1>
        <p>
          Nothing here changes your real FPL team. Use Footy’s suggestion as
          the starting point, then test your own combinations against the same
          player, fixture and mini-league data.
        </p>
        <blockquote className="footy-quip">{footyQuip("preview")}</blockquote>
      </header>

      <section className="preview-suggestion">
        <NextMoveCommand
          teamId={team.id}
          leagueId={selectedLeague.id}
          leagueName={selectedLeague.name}
        />
      </section>

      <section className="shell preview-builder">
        <div className="team-room-block-head">
          <div>
            <span>YOUR VERSION</span>
            <h2>Build and compare</h2>
          </div>
          <small>
            Current squad loaded · £{team.bank.toFixed(1)}m bank
          </small>
        </div>
        <BuildTestWorkspace
          initialPlayerIds={team.squad.map((player) => player.id)}
          teamId={team.id}
          leagueId={selectedLeague.id}
          teamName={team.teamName}
        />
      </section>
    </main>
  );
}
