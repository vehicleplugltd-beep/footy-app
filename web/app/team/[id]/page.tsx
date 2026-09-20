import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamPitch } from "@/components/team-pitch";
import { NextMoveCommand } from "@/components/next-move-command";
import { LeaguePreference } from "@/components/league-preference";
import { getFplTeamDiscovery } from "@/lib/fpl-team";
import { BuildTestWorkspace } from "@/components/build-test-workspace";
import { ScoutRoom } from "@/components/scout-room";
import { StaffRoom } from "@/components/staff-room";
import { LeagueView } from "@/components/league-view";

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
  searchParams: Promise<{
    league?: string | string[];
    view?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view;
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : undefined;
  const allowedViews = new Set(["today", "squad", "scout", "league", "build"]);
  const view = rawView && allowedViews.has(rawView) ? rawView : "today";
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
    redirect(`/team/${team.id}?league=${leagues[0].id}&view=${view}`);
  }

  const selectedLeague =
    leagueId && Number.isInteger(leagueId)
      ? leagues.find((league) => league.id === leagueId) ?? null
      : null;

  return (
    <main className="league-edge-app footy-workspace minimal-footy">
      <nav className="nav shell minimal-nav app-topbar">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="topbar-secondary">
          <Link href="/review">Review</Link>
          <Link href="/">Change team</Link>
        </div>
      </nav>

      <LeaguePreference
        teamId={team.id}
        leagueId={leagueId}
        view={view}
        validLeagueIds={leagues.map((league) => league.id)}
      />

      <header className="shell minimal-team-header workspace-context">
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
        <div className="workspace-context-league">
          <span>MINI-LEAGUE</span>
          <strong>{selectedLeague?.name ?? "Choose league"}</strong>
          <small>
            {selectedLeague?.entry_rank
              ? `#${selectedLeague.entry_rank} · ${movement(selectedLeague.entry_rank, selectedLeague.entry_last_rank)}`
              : "Advice becomes opponent-aware once selected"}
          </small>
        </div>
      </header>

      <nav className="shell workspace-tabs" aria-label="Footy workspace">
        {[
          ["today", "Today", "Your brief"],
          ["squad", "Squad", "Your team"],
          ["scout", "Scout", "Future picks"],
          ["league", "League", "Your battle"],
          ["build", "Build", "Test moves"],
        ].map(([key, label, description]) => (
          <Link
            key={key}
            className={view === key ? "active" : ""}
            href={`/team/${team.id}?view=${key}${leagueId ? `&league=${leagueId}` : ""}`}
          >
            <b>{label}</b>
            <small>{description}</small>
          </Link>
        ))}
      </nav>

      {!selectedLeague && (view === "today" || view === "league") ? (
        <section className="shell minimal-league-chooser workspace-screen">
          <div>
            <span>CHOOSE YOUR MINI-LEAGUE</span>
            <h2>Who are you trying to beat?</h2>
            <p>
              Footy uses the league battle after the football model has found a
              strong decision. It never promotes a weak player just for differentiation.
            </p>
          </div>
          <div className="minimal-league-list">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/team/${team.id}?league=${league.id}&view=${view}`}
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

      {view === "today" ? (
        <section className="workspace-screen workspace-today">
          {selectedLeague ? (
            <NextMoveCommand
              teamId={team.id}
              leagueId={leagueId}
              leagueName={selectedLeague.name}
            />
          ) : (
            <section className="shell workspace-empty-state">
              <span>ASSISTANT BRIEF</span>
              <h2>Choose the mini-league you want to attack.</h2>
              <p>
                Your squad data is ready. Select the battle above and Footy will
                combine football quality with the pressure above and below you.
              </p>
            </section>
          )}

          <section className="shell staff-room-section">
            <StaffRoom teamId={team.id} leagueId={leagueId} />
          </section>
        </section>
      ) : null}

      {view === "squad" ? (
        <section className="shell workspace-screen squad-screen">
          <div className="screen-intro">
            <span>SQUAD</span>
            <h2>What in your team actually needs attention?</h2>
            <p>
              Your current XI stays visual. Availability, form and transfer
              signals are there to identify problems — not to create work.
            </p>
          </div>
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
        </section>
      ) : null}

      {view === "scout" ? (
        <section className="shell workspace-screen scout-screen">
          <div className="screen-intro">
            <span>SCOUT</span>
            <h2>Find the move before it becomes obvious.</h2>
            <p>
              Buy now, watch or plan for later. Every profile combines live FPL
              market data, EPA, underlying process and the best window across
              the next eight Gameweeks.
            </p>
          </div>
          <ScoutRoom />
        </section>
      ) : null}

      {view === "league" ? (
        <section className="shell workspace-screen league-screen">
          <div className="screen-intro">
            <span>LEAGUE</span>
            <h2>Know who you need to catch — and who is chasing you.</h2>
            <p>
              The league screen is opposition analysis. Football quality comes
              first; ownership, chips and resources only adjust close decisions.
            </p>
          </div>
          {selectedLeague ? (
            <>
              <div className="league-screen-switcher">
                <div>
                  <strong>{selectedLeague.name}</strong>
                  <small>
                    {selectedLeague.entry_rank ? `#${selectedLeague.entry_rank}` : "—"}
                    {" · "}{movement(selectedLeague.entry_rank, selectedLeague.entry_last_rank)}
                  </small>
                </div>
                <details className="minimal-switcher">
                  <summary>Change league</summary>
                  <div>
                    {leagues.map((league) => (
                      <Link
                        key={league.id}
                        href={`/team/${team.id}?league=${league.id}&view=league`}
                      >
                        <span>{league.name}</span>
                        <small>{league.entry_rank ? `#${league.entry_rank}` : "—"}</small>
                      </Link>
                    ))}
                  </div>
                </details>
              </div>
              <LeagueView
                leagueId={String(selectedLeague.id)}
                initialEntryId={team.id}
                initialRank={selectedLeague.entry_rank ?? undefined}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {view === "build" ? (
        <section className="shell workspace-screen build-screen">
          <div className="screen-intro">
            <span>BUILD &amp; TEST</span>
            <h2>Try the route before you spend the transfer.</h2>
            <p>
              Build is the tactics board. Compare alternatives against the same
              player model, budget and mini-league context without touching the real team.
            </p>
          </div>
          <BuildTestWorkspace
            initialPlayerIds={team.squad.map((player) => player.id)}
            teamId={team.id}
            leagueId={leagueId}
            teamName={team.teamName}
          />
        </section>
      ) : null}

      <nav className="mobile-workspace-nav" aria-label="Mobile Footy navigation">
        {[
          ["today", "●", "Today"],
          ["squad", "▦", "Squad"],
          ["scout", "⌕", "Scout"],
          ["league", "↕", "League"],
          ["build", "＋", "Build"],
        ].map(([key, icon, label]) => (
          <Link
            key={key}
            className={view === key ? "active" : ""}
            href={`/team/${team.id}?view=${key}${leagueId ? `&league=${leagueId}` : ""}`}
          >
            <span>{icon}</span><b>{label}</b>
          </Link>
        ))}
      </nav>

      <footer className="shell footer minimal-footer">
        <p>One screen. One job. Evidence when you want it.</p>
        <p>BRIEF → SCOUT → TEST → REVIEW</p>
      </footer>
    </main>
  );
}
