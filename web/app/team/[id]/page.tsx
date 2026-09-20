import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamPitch } from "@/components/team-pitch";
import { NextMoveCommand } from "@/components/next-move-command";
import { getFplTeamDiscovery } from "@/lib/fpl-team";
import { BuildTestWorkspace } from "@/components/build-test-workspace";

function rank(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function movement(current: number | null, previous: number | null) {
  if (!current || !previous || current === previous) return "—";
  const delta = previous - current;
  return delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`;
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : undefined;
  const teamId = Number(id.replace(/\D/g, ""));

  let team;

  try {
    team = await getFplTeamDiscovery(teamId);
  } catch (error) {
    return (
      <main className="league-edge-app">
        <nav className="nav shell">
          <Link className="brand brand-link" href="/">
            <span className="brand-mark">F</span><span>Footy</span>
          </Link>
        </nav>
        <section className="shell team-discovery-error">
          <span className="eyebrow">Find your FPL team</span>
          <h1>We couldn&apos;t load this workspace.</h1>
          <p>
            {error instanceof Error
              ? error.message
              : "The official FPL feed did not return this team."}
          </p>
          <Link href="/">Try another Team ID</Link>
        </section>
      </main>
    );
  }

  const leagues = team.miniLeagues.length
    ? team.miniLeagues
    : team.otherClassicLeagues.slice(0, 12);
  if (!leagueId && leagues.length === 1) {
    redirect(`/team/${team.id}?league=${leagues[0].id}#today`);
  }

  const selectedLeague =
    leagueId && Number.isInteger(leagueId)
      ? leagues.find((league) => league.id === leagueId) ?? null
      : null;

  return (
    <main className="league-edge-app footy-workspace">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          <a href="#today">Today</a>
          <a href="#squad">Squad</a>
          <a href="#leagues">Mini-League</a>
          <a href="#build-test">Build &amp; Test</a>
          <Link href="/results">Receipts</Link>
        </div>
      </nav>

      <section className="shell team-discovery-hero workspace-hero">
        <div>
          <span className="eyebrow">My Footy</span>
          <h1>{team.teamName}</h1>
          <p>
            {team.managerName}
            {team.region ? ` · ${team.region}` : ""}
          </p>
        </div>
        <Link className="change-team-link" href="/">Change team</Link>
      </section>

      <div className="workspace-tabs shell" aria-label="Footy workspace">
        <a href="#squad"><span>01</span> Squad</a>
        <a href="#leagues"><span>02</span> Mini-Leagues</a>
        <a href="#build-test"><span>03</span> Build &amp; Test</a>
        <Link href="/results"><span>04</span> Receipts</Link>
      </div>

      <NextMoveCommand
        teamId={team.id}
        leagueId={leagueId}
        leagueName={selectedLeague?.name ?? null}
      />

      <section className="shell team-first-dashboard" id="squad">
        <div className="team-pitch-panel">
          <div className="team-pitch-panel-head">
            <div>
              <span className="eyebrow">2 · Your squad · GW{team.currentEvent}</span>
              <h2>See the team behind the decision.</h2>
            </div>
            <div className="team-pitch-summary">
              <span>£{team.squadValue.toFixed(1)}m value</span>
              <span>£{team.bank.toFixed(1)}m bank</span>
              {team.activeChip ? <span>{team.activeChip}</span> : null}
            </div>
          </div>
          {team.squad.length ? (
            <TeamPitch squad={team.squad} />
          ) : (
            <div className="league-state">
              Footy found the team but the current public squad is temporarily unavailable.
            </div>
          )}
        </div>

        <aside className="team-control-panel" id="leagues">
          <div className="team-control-kpis">
            <article>
              <span>Overall points</span>
              <strong>{team.overallPoints.toLocaleString()}</strong>
            </article>
            <article>
              <span>Overall rank</span>
              <strong>{rank(team.overallRank)}</strong>
            </article>
            <article>
              <span>Latest GW</span>
              <strong>{team.eventPoints ?? "—"} pts</strong>
            </article>
          </div>

          {selectedLeague ? (
            <>
              <div className="team-league-picker-head">
                <span className="eyebrow">3 · Mini-league</span>
                <h2>Switch the battle.</h2>
                <p>Your recommendation changes with the league you choose.</p>
              </div>
              <div className="team-league-list">
                {leagues.map((league) => {
                  const rankParam = league.entry_rank
                    ? `&rank=${league.entry_rank}`
                    : "";
                  return (
                    <div className="team-league-card-wrap" key={league.id}>
                      <Link
                        className="team-league-card"
                        href={`/team/${team.id}?league=${league.id}#today`}
                      >
                        <div>
                          <span>YOUR RANK</span>
                          <strong>
                            {league.entry_rank ? `#${league.entry_rank}` : "—"}
                          </strong>
                          <small>
                            {movement(league.entry_rank, league.entry_last_rank)}
                          </small>
                        </div>
                        <div>
                          <h3>{league.name}</h3>
                          <p>
                            {league.id === selectedLeague.id
                              ? "Currently selected"
                              : "Switch Footy to this league"}
                          </p>
                        </div>
                        <b>{league.id === selectedLeague.id ? "✓" : "→"}</b>
                      </Link>
                      {league.id === selectedLeague.id ? (
                        <div className="league-card-actions">
                          <Link
                            className="league-build-link"
                            href={`/team/${team.id}?league=${league.id}#build-test`}
                          >
                            Build &amp; test
                          </Link>
                          <Link
                            className="league-build-link"
                            href={`/league/${league.id}?team=${team.id}${rankParam}`}
                          >
                            Full league view
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="journey-helper-card">
              <span className="eyebrow">What happens next</span>
              <strong>Choose a league above.</strong>
              <p>
                Footy will identify the rival that matters, rank your transfer
                and captain options, compare chips/free transfers, and give you
                one clear recommendation.
              </p>
            </div>
          )}
        </aside>
      </section>

      <section className="shell integrated-build-test" id="build-test">
        <div className="workspace-section-intro">
          <span className="eyebrow">4 · Build &amp; Test</span>
          <h2>
            {leagueId
              ? "Test moves against this mini-league."
              : "Explore your next move before the deadline."}
          </h2>
          <p>
            This is part of your Footy workspace: the same real squad, player
            database, underlying football process and—when a league is selected—
            rival resources and league-specific recommendations.
          </p>
        </div>

        <BuildTestWorkspace
          initialPlayerIds={team.squad.map((player) => player.id)}
          teamId={team.id}
          leagueId={leagueId}
          teamName={team.teamName}
        />
      </section>

      <nav className="mobile-workspace-nav" aria-label="Mobile Footy navigation">
        <a href="#today"><span>●</span><b>Today</b></a>
        <a href="#squad"><span>▦</span><b>Squad</b></a>
        <a href="#leagues"><span>↕</span><b>League</b></a>
        <a href="#build-test"><span>＋</span><b>Build</b></a>
        <Link href="/results"><span>✓</span><b>Receipts</b></Link>
      </nav>

      <footer className="shell footer">
        <p>
          Footy uses public FPL data only. No FPL password or account connection is required.
        </p>
        <p>CHOOSE → DECIDE → UNDERSTAND → TEST → RECEIPTS</p>
      </footer>
    </main>
  );
}
