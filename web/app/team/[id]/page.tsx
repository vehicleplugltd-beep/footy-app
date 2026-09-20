import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamPitch } from "@/components/team-pitch";
import { NextMoveCommand } from "@/components/next-move-command";
import { LeaguePreference } from "@/components/league-preference";
import { getFplTeamDiscovery } from "@/lib/fpl-team";
import { BuildTestWorkspace } from "@/components/build-test-workspace";
import { ScoutRoom } from "@/components/scout-room";
import { StaffRoom } from "@/components/staff-room";

function rank(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function movement(current: number | null, previous: number | null) {
  if (!current || !previous || current === previous) return "No change";
  const delta = previous - current;
  return delta > 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`;
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
          <h1>We couldn&apos;t load this team.</h1>
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
    <main className="league-edge-app footy-workspace minimal-footy">
      <nav className="nav shell minimal-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          <a href="#today">Today</a>
          <a href="#squad">Squad</a>
          <a href="#scout">Scout</a>
          <a href="#leagues">League</a>
          <a href="#build-test">Build</a>
          <Link href="/results">Receipts</Link>
        </div>
      </nav>

      <LeaguePreference
        teamId={team.id}
        leagueId={leagueId}
        validLeagueIds={leagues.map((league) => league.id)}
      />

      <header className="shell minimal-team-header">
        <div>
          <span>MY TEAM</span>
          <h1>{team.teamName}</h1>
          <p>{team.managerName}{team.region ? ` · ${team.region}` : ""}</p>
        </div>
        <div className="minimal-header-stats">
          <div><span>Points</span><strong>{team.overallPoints.toLocaleString()}</strong></div>
          <div><span>Overall</span><strong>{rank(team.overallRank)}</strong></div>
          <div><span>GW{team.currentEvent}</span><strong>{team.eventPoints ?? "—"}</strong></div>
        </div>
        <Link className="change-team-link" href="/">Change</Link>
      </header>

      {!selectedLeague ? (
        <section className="shell minimal-league-chooser" id="leagues">
          <div>
            <span>CHOOSE YOUR MINI-LEAGUE</span>
            <h2>Who are you trying to beat?</h2>
            <p>Footy changes the advice depending on the league battle.</p>
          </div>
          <div className="minimal-league-list">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/team/${team.id}?league=${league.id}#today`}
              >
                <div>
                  <strong>{league.name}</strong>
                  <small>
                    {league.entry_rank ? `Rank #${league.entry_rank}` : "Rank —"}
                    {" · "}{movement(league.entry_rank, league.entry_last_rank)}
                  </small>
                </div>
                <b>→</b>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div id="today">
        {selectedLeague ? (
          <NextMoveCommand
            teamId={team.id}
            leagueId={leagueId}
            leagueName={selectedLeague.name}
          />
        ) : null}

        <section className="shell staff-room-section" id="staff-room">
          <StaffRoom teamId={team.id} leagueId={leagueId} />
        </section>
      </div>

      <section className="shell minimal-squad-layout" id="squad">
        <div className="team-pitch-panel minimal-panel">
          <div className="minimal-section-head">
            <div>
              <span>YOUR SQUAD</span>
              <h2>Current team</h2>
            </div>
            <div className="minimal-squad-meta">
              <span>£{team.squadValue.toFixed(1)}m</span>
              <span>£{team.bank.toFixed(1)}m bank</span>
              {team.activeChip ? <span>{team.activeChip}</span> : null}
            </div>
          </div>
          {team.squad.length ? (
            <TeamPitch squad={team.squad} />
          ) : (
            <div className="league-state">
              The current public squad is temporarily unavailable.
            </div>
          )}
        </div>

        <aside className="minimal-context-panel" id="leagues">
          <span>MINI-LEAGUE</span>
          {selectedLeague ? (
            <>
              <h2>{selectedLeague.name}</h2>
              <div className="minimal-context-rank">
                <strong>{selectedLeague.entry_rank ? `#${selectedLeague.entry_rank}` : "—"}</strong>
                <small>{movement(selectedLeague.entry_rank, selectedLeague.entry_last_rank)}</small>
              </div>
              <p>
                Footy is optimising today&apos;s advice for this league.
              </p>
              <details className="minimal-switcher">
                <summary>Change mini-league</summary>
                <div>
                  {leagues.map((league) => (
                    <Link
                      key={league.id}
                      href={`/team/${team.id}?league=${league.id}#today`}
                    >
                      <span>{league.name}</span>
                      <small>{league.entry_rank ? `#${league.entry_rank}` : "—"}</small>
                    </Link>
                  ))}
                </div>
              </details>
              <Link
                className="text-link"
                href={`/league/${selectedLeague.id}?team=${team.id}${selectedLeague.entry_rank ? `&rank=${selectedLeague.entry_rank}` : ""}`}
              >
                View full league detail →
              </Link>
            </>
          ) : (
            <>
              <h2>No league selected</h2>
              <p>Choose a mini-league above to personalise the advice.</p>
            </>
          )}
        </aside>
      </section>

      <section className="shell minimal-scout-section" id="scout">
        <div className="minimal-section-copy">
          <span>SCOUT</span>
          <h2>Players, clubs and opportunities — before everyone sees them.</h2>
          <p>
            Scan the next eight Gameweeks, inspect player and club profiles,
            and see when an opportunity becomes a buy, a watch or a future target.
          </p>
        </div>
        <ScoutRoom />
      </section>

      <section className="shell minimal-build-section" id="build-test">
        <div className="minimal-section-copy">
          <span>BUILD &amp; TEST</span>
          <h2>Try the move before you make it.</h2>
          <p>
            Explore alternatives only when you need them. Footy keeps the live
            recommendation and the underlying player data in the same workspace.
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
        <a href="#scout"><span>⌕</span><b>Scout</b></a>
        <a href="#leagues"><span>↕</span><b>League</b></a>
        <a href="#build-test"><span>＋</span><b>Build</b></a>
      </nav>

      <footer className="shell footer minimal-footer">
        <p>Advice first. Evidence when you want it.</p>
        <p>DECIDE → SCOUT → UNDERSTAND → TEST</p>
      </footer>
    </main>
  );
}
