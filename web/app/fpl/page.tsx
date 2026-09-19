import Link from "next/link";
import { getFplHub, type RankedPlayer } from "@/lib/fpl";

export const dynamic = "force-dynamic";

function deadline(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function PlayerTable({
  title,
  subtitle,
  players,
}: {
  title: string;
  subtitle: string;
  players: RankedPlayer[];
}) {
  return (
    <section className="fpl-panel">
      <div className="section-head compact">
        <div>
          <span className="eyebrow">{subtitle}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="fpl-table-wrap">
        <table className="fpl-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>£</th>
              <th>EP</th>
              <th>Form</th>
              <th>Footy</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <strong>{player.name}</strong>
                  <small>
                    {player.team}
                    {player.opponent ? ` · vs ${player.opponent}` : ""}
                  </small>
                </td>
                <td>{player.position}</td>
                <td>{player.price.toFixed(1)}</td>
                <td>{player.expectedNext.toFixed(1)}</td>
                <td>{player.form.toFixed(1)}</td>
                <td className={player.processBoost >= 0 ? "positive" : "negative"}>
                  {pct(player.processBoost)}
                </td>
                <td><strong>{player.assistantScore.toFixed(2)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function FplPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const params = await searchParams;
  const teamId = params.team ? Number(params.team) : undefined;
  const hub = await getFplHub(teamId);

  return (
    <main>
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Betting tools</Link>
          <span className="status status-approved">FREE FPL</span>
        </div>
      </nav>

      <section className="hero shell fpl-hero">
        <div>
          <span className="eyebrow">Free FPL Assistant Manager</span>
          <h1>
            FPL advice powered by
            <br />
            underlying football data.
          </h1>
          <p>
            Official FPL player data is the anchor. Footy then adjusts the
            rankings using our own team xG/xGA, shots, SOT, set pieces, PPDA,
            deep completions and opponent process.
          </p>
        </div>

        <div className="hero-card fpl-deadline">
          <span className="eyebrow">Next deadline</span>
          <strong>{hub.nextEvent?.name ?? hub.currentEvent?.name ?? "Gameweek"}</strong>
          <p>
            {hub.nextEvent
              ? deadline(hub.nextEvent.deadline_time)
              : "Waiting for the next official FPL deadline."}
          </p>
          <small>
            Footy process coverage: {hub.processTeams} Premier League teams
          </small>
        </div>
      </section>

      <section className="shell fpl-team-search">
        <div>
          <span className="eyebrow">Analyse your squad</span>
          <h2>Enter your public FPL Team ID</h2>
          <p className="muted">
            Find the number in your FPL team URL. No password or FPL login is
            needed.
          </p>
        </div>
        <form method="get" className="team-id-form">
          <label>
            <span>FPL Team ID</span>
            <input
              name="team"
              inputMode="numeric"
              defaultValue={params.team ?? ""}
              placeholder="e.g. 2298472"
              required
            />
          </label>
          <button type="submit">Analyse my team</button>
        </form>
      </section>

      {hub.teamError ? (
        <div className="shell warning">{hub.teamError}</div>
      ) : null}

      {hub.teamAnalysis ? (
        <section className="shell section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Your squad</span>
              <h2>{hub.teamAnalysis.teamName}</h2>
              <p className="muted">
                {hub.teamAnalysis.managerName} · {hub.teamAnalysis.overallPoints} pts ·
                {" "}£{hub.teamAnalysis.bank.toFixed(1)}m bank
              </p>
            </div>
            <div className="captain-call">
              <span>Captain call</span>
              <strong>
                {hub.teamAnalysis.recommendedCaptain?.name ?? "—"}
              </strong>
              <small>
                Current: {hub.teamAnalysis.currentCaptain?.name ?? "—"}
              </small>
            </div>
          </div>

          <div className="transfer-cards">
            {hub.teamAnalysis.weakLinks.map(({ player, replacement, reason }) => (
              <article className="transfer-card" key={player.id}>
                <span className="eyebrow">Squad check</span>
                <h3>
                  {player.name}
                  <span> → </span>
                  {replacement?.name ?? "HOLD"}
                </h3>
                <p>{reason}</p>
                {replacement ? (
                  <div className="transfer-metrics">
                    <span>
                      £{player.price.toFixed(1)}m → £{replacement.price.toFixed(1)}m
                    </span>
                    <span>
                      Footy boost {pct(replacement.processBoost)}
                    </span>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="shell section fpl-grid">
        <PlayerTable
          title="Captain shortlist"
          subtitle="Ceiling"
          players={hub.captains}
        />
        <PlayerTable
          title="Transfer targets"
          subtitle="Next move"
          players={hub.transfers}
        />
      </section>

      <section className="shell section">
        <PlayerTable
          title="Value picks"
          subtitle="Points per £m"
          players={hub.values}
        />
      </section>

      <section className="shell section">
        <div className="panel">
          <span className="eyebrow">How Footy FPL works</span>
          <h2>Player data + team process + matchup</h2>
          <div className="fpl-method">
            <div>
              <strong>1. Official FPL</strong>
              <p>Price, position, availability, form, expected points and xGI.</p>
            </div>
            <div>
              <strong>2. Footy process</strong>
              <p>xG/xGA, shots/SOT, set pieces, pressing and deep completions.</p>
            </div>
            <div>
              <strong>3. Opponent adjustment</strong>
              <p>Attackers get an attack-v-defence matchup factor; defenders get the inverse.</p>
            </div>
            <div>
              <strong>4. Small-sample regression</strong>
              <p>Early-season team extremes are pulled back toward the league environment.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="shell footer">
        <p>
          Free FPL decision support. Official FPL data plus Footy&apos;s independent
          underlying-process layer.
        </p>
        <p>
          FPL DATA → TEAM PROCESS → MATCHUP → PLAYER RANKING
        </p>
      </footer>
    </main>
  );
}
