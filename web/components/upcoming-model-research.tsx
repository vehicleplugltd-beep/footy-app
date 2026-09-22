import type { BettingSelection } from "@/lib/betting";
import { decimalToFractional } from "@/lib/odds";

function formatKickoff(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

type ResearchFixture = {
  matchId: string;
  kickoffAt: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeXg: number | null;
  awayXg: number | null;
  outcomes: BettingSelection[];
};

function ResearchCard({ game }: { game: ResearchFixture }) {
  const validation = game.outcomes[0]?.validationStatus ?? "RESEARCH";
  const priceAvailable = game.outcomes.some((row) => row.bestPrice != null);

  return (
    <article className="research-fixture-card">
      <header>
        <span>{game.league} · {formatKickoff(game.kickoffAt)}</span>
        <strong>{game.homeTeam} <i>vs</i> {game.awayTeam}</strong>
        <small>{validation === "APPROVED" ? "Validated model" : `${validation} · research only`}</small>
      </header>
      <div className="research-outcome-grid">
        {(["home", "draw", "away"] as const).map((selection) => {
          const outcome = game.outcomes.find((row) => row.selection === selection);
          return (
            <div key={selection}>
              <span>{selection === "home" ? "HOME" : selection === "draw" ? "DRAW" : "AWAY"}</span>
              <strong>{outcome ? pct(outcome.modelProbability) : "—"}</strong>
              <small>Fair {outcome ? decimalToFractional(outcome.fairOdds) : "—"}</small>
            </div>
          );
        })}
      </div>
      <footer>
        <span>
          {game.homeXg != null && game.awayXg != null
            ? `Expected scoring: ${game.homeXg.toFixed(2)} – ${game.awayXg.toFixed(2)}`
            : "Chance-quality estimate unavailable"}
        </span>
        <small>{priceAvailable ? "Check the available odds and analysis before backing a selection." : "Waiting for a current bookmaker price for this match."}</small>
      </footer>
    </article>
  );
}

/** A distinct, visible research feed. Never infers BET from a model probability. */
export function UpcomingModelResearch({
  selections,
}: {
  selections: BettingSelection[];
}) {
  const byMatch = new Map<string, ResearchFixture>();
  for (const outcome of selections) {
    if (outcome.market !== "1X2") continue;
    const current = byMatch.get(outcome.matchId);
    if (current) {
      current.outcomes.push(outcome);
    } else {
      byMatch.set(outcome.matchId, {
        matchId: outcome.matchId,
        kickoffAt: outcome.kickoffAt,
        league: outcome.league,
        homeTeam: outcome.homeTeam,
        awayTeam: outcome.awayTeam,
        homeXg: outcome.homeXg,
        awayXg: outcome.awayXg,
        outcomes: [outcome],
      });
    }
  }
  const games = [...byMatch.values()]
    .filter((game) => game.outcomes.length === 3)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

  return (
    <section className="betting-section next-research shell" id="next-modelled">
      <div className="betting-section-head">
        <div>
          <span>NEXT / MODELLED FIXTURES</span>
          <h2>Upcoming matches under the microscope</h2>
        </div>
        <p>
          {games.length} upcoming matches assessed over the next 30 days. These are football assessments,
          not confirmed value bets.
        </p>
      </div>
      {games.length ? (
        <>
          <p className="research-context">
            Next modelled kick-off: <strong>{formatKickoff(games[0].kickoffAt)}</strong>.
            We only flag a bet once the analysis has passed our checks and the current
            bookmaker price is generous enough.
          </p>
          <div className="research-fixture-grid">
            {games.slice(0, 6).map((game) => (
              <ResearchCard key={game.matchId} game={game} />
            ))}
          </div>
          {games.length > 6 ? (
            <details className="research-more">
              <summary>Show all {games.length} modelled fixtures</summary>
              <div className="research-fixture-grid">
                {games.slice(6).map((game) => (
                  <ResearchCard key={game.matchId} game={game} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <div className="betting-empty">
          <strong>No complete upcoming match assessments are available yet.</strong>
          <p>We will not substitute coverage-only fixtures, old predictions, or invented odds.</p>
        </div>
      )}
    </section>
  );
}
