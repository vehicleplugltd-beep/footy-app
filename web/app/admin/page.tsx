import Link from "next/link";
import { AdminLauncher } from "@/components/admin-launcher";
import { getAdminOverview } from "@/lib/admin-data";
import { getPlayerDatabase } from "@/lib/fpl";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function ageLabel(value: string | null) {
  if (!value) return "No snapshot";
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const features = [
  {
    name: "Team-first onboarding",
    status: "LIVE",
    description: "Team ID → real squad → mini-league discovery.",
    href: "/",
  },
  {
    name: "2D squad pitch",
    status: "LIVE",
    description: "Actual XI, captain, vice-captain and bench.",
    href: "/",
  },
  {
    name: "Player Database + Build & Test",
    status: "LIVE",
    description: "FPL pool enriched with Footy football-process data.",
    href: "/",
  },
  {
    name: "Build & Test",
    status: "BETA",
    description: "Mock £100m squads, Draft Board and scenario testing.",
    href: "/",
  },
  {
    name: "League Command Centre",
    status: "LIVE",
    description: "Rank gaps, pressure map and nearest-rival context.",
    href: "/",
  },
  {
    name: "League-specific moves",
    status: "BETA",
    description: "CHASE / PROTECT / RECOVER adjusts strong transfer and captain calls.",
    href: "/",
  },
  {
    name: "Rival Arsenal",
    status: "BETA",
    description: "Chips used, chips left, hits, transfer aggression and reconstructed FT bank.",
    href: "/",
  },
  {
    name: "Freshness + trend radar",
    status: "LIVE",
    description: "Live FPL first, process trends and data timestamps.",
    href: "/",
  },
  {
    name: "Receipts",
    status: "LIVE",
    description: "Freeze latest pre-deadline top-three calls.",
    href: "/results",
  },
  {
    name: "Receipt scoring",
    status: "LIVE",
    description: "Post-deadline squad evidence scores whether advice was followed.",
    href: "/results",
  },
  {
    name: "Chip timing engine",
    status: "BETA",
    description: "Resource imbalance now informs strategy; deeper fixture-window optimisation next.",
    href: "/",
  },
  {
    name: "League-win simulator",
    status: "RESEARCH",
    description: "No win percentage until remaining-season simulation is calibrated.",
    href: "/results",
  },
];

export default async function AdminPage() {
  const [overview, playerDb] = await Promise.all([
    getAdminOverview(),
    getPlayerDatabase().catch(() => null),
  ]);

  return (
    <main className="league-edge-app admin-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy Admin</span>
        </Link>
        <div className="nav-links">
                    <Link href="/results">Receipts</Link>
          <Link href="/">Public app</Link>
        </div>
      </nav>

      <section className="shell admin-hero">
        <div>
          <span className="eyebrow">Owner Feature Lab</span>
          <h1>See the whole product in one place.</h1>
          <p>
            Launch real team and league flows, inspect feature status, watch data
            freshness and verify the model evidence before customers see it.
          </p>
        </div>
        <AdminLauncher />
      </section>

      <section className="shell admin-kpis">
        <article>
          <span>Player database</span>
          <strong>{playerDb?.players.length ?? "—"}</strong>
          <small>current FPL players</small>
        </article>
        <article>
          <span>Connected leagues</span>
          <strong>{overview.counts.leagues}</strong>
          <small>{overview.counts.entries} stored manager rows</small>
        </article>
        <article>
          <span>Frozen calls</span>
          <strong>{overview.counts.recommendations}</strong>
          <small>{overview.counts.scoredReceipts} scored receipts</small>
        </article>
        <article>
          <span>Analytics events</span>
          <strong>{overview.counts.analyticsEvents}</strong>
          <small>product funnel events</small>
        </article>
      </section>

      <section className="shell admin-data-health">
        <div>
          <span className="eyebrow">Data health</span>
          <h2>Is Footy fresh?</h2>
        </div>
        <div className="admin-health-grid">
          <article>
            <span>FPL bootstrap cache</span>
            <strong>{ageLabel(overview.freshness.bootstrap)}</strong>
            <small>{overview.freshness.bootstrap ?? "No stored timestamp"}</small>
          </article>
          <article>
            <span>Fixture cache</span>
            <strong>{ageLabel(overview.freshness.fixtures)}</strong>
            <small>{overview.freshness.fixtures ?? "No stored timestamp"}</small>
          </article>
          <article>
            <span>Player feed used now</span>
            <strong>{playerDb?.freshness ?? "UNAVAILABLE"}</strong>
            <small>
              {playerDb
                ? `${playerDb.processTeams} PL teams with Footy process data`
                : "Player database could not refresh"}
            </small>
          </article>
        </div>
      </section>

      <section className="shell admin-feature-section">
        <div className="admin-section-head">
          <div>
            <span className="eyebrow">Feature matrix</span>
            <h2>What works today?</h2>
          </div>
          <small>LIVE = available · BETA = active testing · RESEARCH = not shipped yet</small>
        </div>

        <div className="admin-feature-grid">
          {features.map((feature) => (
            <Link href={feature.href} className="admin-feature-card" key={feature.name}>
              <span className={`feature-status status-${feature.status.toLowerCase()}`}>
                {feature.status}
              </span>
              <strong>{feature.name}</strong>
              <p>{feature.description}</p>
              <small>Open feature →</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell admin-two-col">
        <div className="admin-panel">
          <div className="admin-section-head">
            <div>
              <span className="eyebrow">Recent leagues</span>
              <h2>Real product activity</h2>
            </div>
          </div>
          <div className="admin-list">
            {overview.recentLeagues.length ? (
              overview.recentLeagues.map((league) => (
                <Link href={`/league/${league.league_id}`} key={league.league_id}>
                  <div>
                    <strong>{league.league_name ?? `League ${league.league_id}`}</strong>
                    <small>ID {league.league_id} · {league.sync_status}</small>
                  </div>
                  <span>{league.connect_count} connects</span>
                </Link>
              ))
            ) : (
              <p className="admin-empty">No connected league activity yet.</p>
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-section-head">
            <div>
              <span className="eyebrow">Latest events</span>
              <h2>What users are doing</h2>
            </div>
          </div>
          <div className="admin-event-list">
            {overview.recentEvents.length ? (
              overview.recentEvents.map((event, index) => (
                <div key={`${event.created_at}-${index}`}>
                  <strong>{event.event_name}</strong>
                  <span>
                    {event.league_id ? `League ${event.league_id} · ` : ""}
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="admin-empty">No analytics events recorded yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="shell admin-test-plan">
        <span className="eyebrow">Owner test loop</span>
        <h2>Run the product like a customer.</h2>
        <div>
          <article>
            <b>01</b>
            <strong>Find a team</strong>
            <p>Confirm the real XI, bench, captain and mini-leagues load correctly.</p>
          </article>
          <article>
            <b>02</b>
            <strong>Open a league</strong>
            <p>Confirm the page focuses on that manager and identifies the correct rival battle.</p>
          </article>
          <article>
            <b>03</b>
            <strong>Generate analysis</strong>
            <p>Inspect fresh trends, Rival Arsenal, captain shortlist and league-specific transfers.</p>
          </article>
          <article>
            <b>04</b>
            <strong>Simulate it</strong>
            <p>Open Squad Lab, apply the suggested move to the 2D pitch and explore alternatives.</p>
          </article>
          <article>
            <b>05</b>
            <strong>Check Receipts</strong>
            <p>Verify the pre-deadline recommendation is frozen and scored afterwards.</p>
          </article>
        </div>
      </section>

      <footer className="shell footer">
        <p>Owner workspace for testing and observing the free product.</p>
        <p>OBSERVE → TEST → PROVE → IMPROVE</p>
      </footer>
    </main>
  );
}
