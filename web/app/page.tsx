import { BankrollCalculator, PriceChecker } from "@/components/tools";
import { getDashboardData } from "@/lib/footy";
import type { ValidationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function pct(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function kickoff(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function StatusPill({ status }: { status: ValidationStatus }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

export default async function Home() {
  const { board, validation, strategies, configured } =
    await getDashboardData();

  const status = validation?.status ?? "RESEARCH";
  const homeRule = strategies.find(
    (rule) => rule.strategy_id === "home-edge-v1",
  );

  return (
    <main>
      <nav className="nav shell">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </div>
        <div className="nav-right">
          <span className="live-dot" />
          Model board
          <StatusPill status={status} />
        </div>
      </nav>

      <section className="hero shell">
        <div>
          <span className="eyebrow">Football price intelligence</span>
          <h1>
            Stop asking who wins.
            <br />
            Ask whether the price is good enough.
          </h1>
          <p>
            Footy turns underlying football process into probabilities,
            fair odds and minimum take prices—then refuses to promote
            unvalidated edges.
          </p>
        </div>

        <div className="hero-card">
          <span className="eyebrow">Current production state</span>
          <strong>{status}</strong>
          <p>
            {validation?.notes ??
              "Validation evidence is still being accumulated."}
          </p>
        </div>
      </section>

      {!configured ? (
        <div className="shell warning">
          Supabase is not configured. Add the server-only environment
          variables from <code>web/.env.example</code>.
        </div>
      ) : null}

      <div className="shell notice">
        <strong>Live bookmaker feed not connected yet.</strong> The board
        shows Footy&apos;s independent fair prices and minimum take prices.
        Use the price checker with odds from your bookmaker.
      </div>

      <section className="shell section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Upcoming</span>
            <h2>Model board</h2>
          </div>
          <p>v7 result model · latest prediction per fixture · London time</p>
        </div>

        <div className="match-list">
          {board.length ? (
            board.map((match) => (
              <article className="match-card" key={match.match_id}>
                <header>
                  <div>
                    <span className="kickoff">
                      {kickoff(match.kickoff_at)}
                    </span>
                    <h3>
                      {match.home_team} <span>vs</span> {match.away_team}
                    </h3>
                  </div>
                  <StatusPill status={status} />
                </header>

                <div className="selection-grid">
                  {match.selections.map((selection) => (
                    <div
                      className="selection"
                      key={`${match.match_id}:${selection.selection}`}
                    >
                      <span>{selection.displaySelection}</span>
                      <strong>
                        {(selection.model_probability * 100).toFixed(1)}%
                      </strong>
                      <dl>
                        <div>
                          <dt>Fair</dt>
                          <dd>{selection.fair_odds.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt>Take at</dt>
                          <dd>
                            {selection.minimum_take_price.toFixed(2)}+
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              No future v7 fixtures with model outputs are available yet.
            </div>
          )}
        </div>
      </section>

      <section className="shell section split">
        <div className="panel">
          <span className="eyebrow">Tool 01</span>
          <h2>Price checker</h2>
          <p className="muted">
            Enter the odds you can actually get. Footy compares them with
            fair price and minimum take price, then applies the validation
            gate.
          </p>
          <PriceChecker board={board} validationStatus={status} />
        </div>

        <div className="panel">
          <span className="eyebrow">Tool 02</span>
          <h2>Bankroll guardrail</h2>
          <p className="muted">
            Quarter-Kelly sizing with a 1.5% bankroll cap. Unapproved
            markets automatically return a £0 production stake.
          </p>
          <BankrollCalculator validationStatus={status} />
        </div>
      </section>

      <section className="shell section evidence">
        <div className="section-head">
          <div>
            <span className="eyebrow">Evidence</span>
            <h2>Why the gate matters</h2>
          </div>
        </div>

        <div className="evidence-grid">
          <div className="evidence-card">
            <span>Validation sample</span>
            <strong>
              {validation?.sample_size?.toLocaleString("en-GB") ?? "—"}
            </strong>
            <small>historical predictions</small>
          </div>

          <div className="evidence-card">
            <span>Model log loss</span>
            <strong>
              {validation?.model_log_loss?.toFixed(4) ?? "—"}
            </strong>
            <small>lower is better</small>
          </div>

          <div className="evidence-card">
            <span>Close-price ROI</span>
            <strong>{pct(validation?.close_roi ?? null)}</strong>
            <small>
              {validation?.bookmaker_reference ?? "benchmark"}
            </small>
          </div>

          <div className="evidence-card">
            <span>Frozen home rule</span>
            <strong>
              {homeRule ? pct(homeRule.holdout_roi) : "—"}
            </strong>
            <small>
              {homeRule?.holdout_bets ?? 0} holdout bets ·{" "}
              {homeRule?.status ?? "—"}
            </small>
          </div>
        </div>
      </section>

      <footer className="shell footer">
        <p>
          <strong>Footy is decision support, not a profit guarantee.</strong>
          {" "}Betting involves risk and historical edge can disappear. 18+ only.
        </p>
        <p>
          DATA → PROCESS → PROBABILITY → FAIR PRICE → MARKET PRICE → EDGE
          → VALIDATION
        </p>
      </footer>
    </main>
  );
}
