import Link from "next/link";
import { TeamPitch } from "@/components/team-pitch";
import { getFplTeamDiscovery } from "@/lib/fpl-team";

function rank(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function movement(current: number | null, previous: number | null) {
  if (!current || !previous || current === previous) return "—";
  const delta = previous - current;
  return delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`;
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id.replace(/\D/g, ""));
  let team;

  try {
    team = await getFplTeamDiscovery(teamId);
  } catch (error) {
    return (
      <main className="league-edge-app">
        <nav className="nav shell">
          <Link className="brand brand-link" href="/"><span className="brand-mark">F</span><span>Footy</span></Link>
        </nav>
        <section className="shell team-discovery-error">
          <span className="eyebrow">Find your FPL team</span>
          <h1>We couldn&apos;t find that team.</h1>
          <p>{error instanceof Error ? error.message : "The official FPL feed did not return this team."}</p>
          <Link href="/">Try another Team ID</Link>
        </section>
      </main>
    );
  }

  const leagues = team.miniLeagues.length ? team.miniLeagues : team.otherClassicLeagues.slice(0, 12);

  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/"><span className="brand-mark">F</span><span>Footy</span></Link>
        <div className="nav-links"><Link href="/results">Receipts</Link><Link href="/pro">Player Pass</Link></div>
      </nav>

      <section className="shell team-discovery-hero">
        <div>
          <span className="eyebrow">Step 1 complete · This is your team</span>
          <h1>{team.teamName}</h1>
          <p>{team.managerName}{team.region ? ` · ${team.region}` : ""}</p>
        </div>
        <Link className="change-team-link" href="/">Wrong team? Change it</Link>
      </section>

      <section className="shell team-first-dashboard">
        <div className="team-pitch-panel">
          <div className="team-pitch-panel-head">
            <div><span className="eyebrow">Your squad · GW{team.currentEvent}</span><h2>See the team before the advice.</h2></div>
            <div className="team-pitch-summary">
              <span>{team.squadValue.toFixed(1)}m squad</span>
              <span>{team.bank.toFixed(1)}m bank</span>
              {team.activeChip ? <span>{team.activeChip}</span> : null}
            </div>
          </div>
          {team.squad.length ? <TeamPitch squad={team.squad} /> : <div className="league-state">Footy found the team but the current public squad is temporarily unavailable.</div>}
        </div>

        <aside className="team-control-panel">
          <div className="team-control-kpis">
            <article><span>Overall points</span><strong>{team.overallPoints.toLocaleString()}</strong></article>
            <article><span>Overall rank</span><strong>{rank(team.overallRank)}</strong></article>
            <article><span>Latest GW</span><strong>{team.eventPoints ?? "—"} pts</strong></article>
          </div>

          <div className="team-league-picker-head">
            <span className="eyebrow">Step 2 · Choose your mini-league</span>
            <h2>Which battle matters?</h2>
            <p>{team.miniLeagues.length ? `Footy found ${team.miniLeagues.length} invitational classic league${team.miniLeagues.length === 1 ? "" : "s"} for this team.` : "No invitational classic league was returned, so Footy is showing the available classic leagues instead."}</p>
          </div>

          <div className="team-league-list">
            {leagues.length ? leagues.map((league) => {
              const rankParam = league.entry_rank ? `&rank=${league.entry_rank}` : "";
              return (
                <Link className="team-league-card" href={`/league/${league.id}?team=${team.id}${rankParam}`} key={league.id}>
                  <div><span>YOUR RANK</span><strong>{league.entry_rank ? `#${league.entry_rank}` : "—"}</strong><small>{movement(league.entry_rank, league.entry_last_rank)}</small></div>
                  <div><h3>{league.name}</h3><p>Open focused on your manager and nearest rivals.</p></div>
                  <b>→</b>
                </Link>
              );
            }) : <div className="league-state">No classic mini-league is currently attached to this team.</div>}
          </div>
        </aside>
      </section>

      <section className="shell team-flow-note">
        <span>STEP 3 · LEAGUE EDGE</span>
        <strong>From your team to the rivals you actually need to beat.</strong>
        <p>Selecting a league opens Footy on your manager automatically. From there we compare rank gaps, captaincy, squad overlap, transfer options and fresh player/team trends against the nearest rivals.</p>
      </section>

      <footer className="shell footer">
        <p>Footy uses public FPL data only. No FPL password or account connection is required.</p>
        <p>YOUR TEAM → YOUR LEAGUE → YOUR RIVALS → YOUR MOVE</p>
      </footer>
    </main>
  );
}
