import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";
import { PriceChecker } from "@/components/tools";
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
      <BettingAgeGate />
      <nav className="nav shell">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </div>
        <div className="nav-right">
          <Link className="nav-fpl-link" href="/fpl">Free FPL Assistant</Link>
          <Link className="nav-pro-link" href="/pro">Footy Pro</Link>
          <Link className="nav-pro-link" href="/account">Account</Link>
          <span className="live-dot" />
          <StatusPill status={status} />
        </div>
      </nav>

      <section className="hero shell betting-hero">
        <div>
          <span className="eyebrow">Betting intelligence for serious punters</span>
          <h1>
            Beat the bookies by
            <br />
            beating the price.
          </h1>
          <p>
            Footy is built to help punters find mispriced odds, demand a better
            entry price, stake with discipline and track whether the edge is
            actually holding up over time.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href="#price-checker">Check a price</a>
            <Link className="secondary-cta" href="/fpl">Use Free FPL Assistant</Link>
          </div>
        </div>

        <div className="hero-card betting-positioning">
          <span className="eyebrow">The Footy rule</span>
          <strong>Price first.</strong>
          <p>
            A team can be likely to win and still be a bad bet. Footy models the
            football first, sets a fair price, adds an uncertainty margin, then
            compares that with the bookmaker.
          </p>
          <div className="hero-proof">
            <span>Current 1X2 model</span>
            <StatusPill status={status} />
          </div>
        </div>
      </section>

      <section className="shell product-promise">
        <article>
          <span className="promise-number">01</span>
          <h3>Find the edge</h3>
          <p>Independent probabilities built from underlying football process—not odds-led narratives.</p>
        </article>
        <article>
          <span className="promise-number">02</span>
          <h3>Know your price</h3>
          <p>Fair odds and a stricter Minimum Take Price tell you exactly when to bet and when to pass.</p>
        </article>
        <article>
          <span className="promise-number">03</span>
          <h3>Filter the noise</h3>
          <p>Validation gates stop a large-looking raw edge being presented as a tip before the evidence supports it.</p>
        </article>
        <article>
          <span className="promise-number">04</span>
          <h3>Prove the edge</h3>
          <p>Historical tip performance and closing-line movement decide whether an edge survives—not screenshots or winning streaks.</p>
        </article>
      </section>

      {!configured ? (
        <div className="shell warning">
          Supabase is not configured. Add the server-only environment
          variables from <code>web/.env.example</code>.
        </div>
      ) : null}

      <div className="shell notice">
        <strong>Footy Pro is in live beta.</strong> Today you can use the fair-price
        board, Minimum Take Price checker and bankroll guardrail. Live bookmaker
        line-shopping, alerts and automatic bet tracking are the next paid features.
      </div>

      <section className="shell section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Upcoming</span>
            <h2>Today&apos;s pricing board</h2>
          </div>
          <p>Independent v7 fair prices · latest prediction per fixture · London time</p>
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

      <section className="shell section split" id="price-checker">
        <div className="panel">
          <span className="eyebrow">Tool 01 · Find value</span>
          <h2>Is the bookmaker price good enough?</h2>
          <p className="muted">
            Enter the odds you can actually get. Footy compares them with our
            fair price and Minimum Take Price, calculates the raw EV, then applies
            the historical validation gate before calling it actionable.
          </p>
          <PriceChecker board={board} validationStatus={status} />
        </div>

        <div className="panel">
          <span className="eyebrow">Tool 02 · Read the signal</span>
          <h2>Know what Footy is actually telling you</h2>
          <p className="muted">
            Footy is an information service. An APPROVED value tip means the
            model price, market price and historical validation all clear our
            threshold. WATCH means the idea is interesting but not strong
            enough to promote. PASS means the price is not good enough.
          </p>
          <div className="signal-guide">
            <div><strong>VALUE TIP</strong><span>Historically approved information signal.</span></div>
            <div><strong>WATCH</strong><span>Interesting price or concept; evidence is not strong enough yet.</span></div>
            <div><strong>PASS</strong><span>No sufficient value after uncertainty and validation.</span></div>
          </div>
        </div>
      </section>

      <section className="shell section evidence">
        <div className="section-head">
          <div>
            <span className="eyebrow">Evidence</span>
            <h2>Show me the evidence</h2>
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

      <section className="shell section pro-roadmap">
        <div className="pro-roadmap-copy">
          <span className="eyebrow">Footy Pro</span>
          <h2>Built for punters who care about long-run profit.</h2>
          <p>
            The paid product is heading toward a full betting terminal: live
            bookmaker prices, best-price shopping, value alerts, bet tracking,
            CLV, bankroll history and only historically validated betting feeds.
          </p>
        </div>
        <div className="pro-feature-grid">
          <span>Live +EV scanner</span>
          <span>William Hill + best market</span>
          <span>Price alerts</span>
          <span>Saved tip watchlist</span>
          <span>CLV dashboard</span>
          <span>Model performance history</span>
        </div>
      </section>

      <footer className="shell footer">
        <p>
          <strong>Footy provides betting information and analytics, not wagering services.</strong>
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
