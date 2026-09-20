import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";
import { PriceChecker } from "@/components/tools";
import { getDashboardData } from "@/lib/footy";
import type { ValidationStatus } from "@/lib/types";
import { decimalToFractional, minimumTakeToFractional } from "@/lib/odds";
import { getResultsData } from "@/lib/results";

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
  const [{ board, validation, strategies, configured }, results] =
    await Promise.all([getDashboardData(), getResultsData()]);

  const status = validation?.status ?? "RESEARCH";
  const homeRule = strategies.find(
    (rule) => rule.strategy_id === "home-edge-v1",
  );

  const shortlist = board
    .map((match) => {
      const pick = [...match.selections].sort(
        (a, b) => b.model_probability - a.model_probability,
      )[0];
      return pick ? { match, pick } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.pick.model_probability - a.pick.model_probability)
    .slice(0, 3);

  const watchCount = board.length;

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
          <Link className="nav-pro-link" href="/results">Results</Link>
          <Link className="nav-pro-link" href="/pro">Footy Pro</Link>
          <Link className="nav-pro-link" href="/account">Account</Link>
          <span className="live-dot" />
          <StatusPill status={status} />
        </div>
      </nav>

      {board.length ? (
        <div className="market-ticker" aria-label="Footy rolling price ticker">
          <div className="ticker-label">
            <span className="live-dot" />
            FOOTY PRICES
          </div>
          <div className="ticker-viewport">
            <div className="ticker-track">
              {[...board.flatMap((match) =>
                match.selections.map((selection) => ({
                  key: `${match.match_id}:${selection.selection}`,
                  fixture: `${match.home_team} v ${match.away_team}`,
                  selection: selection.displaySelection,
                  fair: decimalToFractional(selection.fair_odds),
                  take: minimumTakeToFractional(selection.minimum_take_price),
                })),
              ), ...board.flatMap((match) =>
                match.selections.map((selection) => ({
                  key: `copy:${match.match_id}:${selection.selection}`,
                  fixture: `${match.home_team} v ${match.away_team}`,
                  selection: selection.displaySelection,
                  fair: decimalToFractional(selection.fair_odds),
                  take: minimumTakeToFractional(selection.minimum_take_price),
                })),
              )].map((item) => (
                <span className="ticker-item" key={item.key}>
                  <strong>{item.fixture}</strong>
                  <b>{item.selection}</b>
                  <span>Fair {item.fair}</span>
                  <span className="ticker-take">Take {item.take}+</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <section className="hero shell consumer-hero">
        <div>
          <span className="eyebrow">Football tips without the tipster nonsense</span>
          <h1>
            Today&apos;s football.
            <br />
            <span>Simplified.</span>
          </h1>
          <p>
            Footy crunches the numbers, works out what the odds should be, and
            tells you the price worth waiting for. No forcing a pick just because
            there&apos;s a game on.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href="#today-shortlist">
              Show me today&apos;s shortlist
            </a>
            <Link className="secondary-cta" href="/fpl">
              Free FPL Assistant
            </Link>
          </div>
          <div className="consumer-trust-row">
            <span>✓ Every public call tracked</span>
            <span>✓ Losses stay visible</span>
            <span>✓ Fractional odds</span>
          </div>
        </div>

        <aside className="today-glance">
          <div className="today-glance-top">
            <span className="live-dot" />
            <span>FOOTY TODAY</span>
          </div>
          <strong>{board.length} matches scanned</strong>
          <div className="today-glance-grid">
            <div>
              <span>Price watches</span>
              <b>{watchCount}</b>
            </div>
            <div>
              <span>Forced tips</span>
              <b>0</b>
            </div>
          </div>
          <p>
            {status === "APPROVED"
              ? "The model is approved, but the bookmaker price still has to clear Footy’s take price."
              : "The model is still on WATCH, so Footy shows the interesting prices without pretending they are proven value tips."}
          </p>
          <Link href="/results">See the public record →</Link>
        </aside>
      </section>

      <section className="shell home-proof-strip">
        <div>
          <span className="eyebrow">Live record</span>
          <strong>
            {results.modelCalls.hitRate === null
              ? "Building the record"
              : `${(results.modelCalls.hitRate * 100).toFixed(1)}% hit rate`}
          </strong>
          <small>
            {results.modelCalls.settled} settled · {results.modelCalls.open} open
          </small>
        </div>
        <p>
          Every published model call is frozen before kickoff and settled
          automatically. No deleting the ugly ones.
        </p>
        <Link className="proof-link" href="/results">
          See every result →
        </Link>
      </section>

      <section className="shell consumer-shortlist" id="today-shortlist">
        <div className="consumer-section-head">
          <div>
            <span className="eyebrow">Today&apos;s shortlist</span>
            <h2>What Footy likes most</h2>
            <p>
              These are the strongest 1X2 model leans. The important number is
              the price beside <b>Wait for</b> — shorter than that and Footy says
              leave it alone.
            </p>
          </div>
          <a href="#price-checker">Check your bookmaker price ↓</a>
        </div>

        <div className="consumer-pick-grid">
          {shortlist.length ? (
            shortlist.map(({ match, pick }, index) => (
              <article
                className={`consumer-pick-card ${index === 0 ? "featured-pick" : ""}`}
                key={match.match_id}
              >
                <div className="consumer-pick-top">
                  <span className="pick-rank">
                    {index === 0 ? "🔥 Strongest lean" : `#${index + 1} today`}
                  </span>
                  <span className="pick-status">
                    {status === "APPROVED" ? "PRICE CHECK" : "WATCHLIST"}
                  </span>
                </div>

                <span className="consumer-fixture">
                  {match.home_team} v {match.away_team}
                </span>
                <h3>{pick.displaySelection}</h3>

                <div className="consumer-price-call">
                  <span>Wait for</span>
                  <strong>
                    {minimumTakeToFractional(pick.minimum_take_price)}+
                  </strong>
                </div>

                <p className="consumer-explain">
                  Footy gives {pick.displaySelection} a{" "}
                  <b>{(pick.model_probability * 100).toFixed(0)}% chance</b>.
                  Fair price is about{" "}
                  <b>{decimalToFractional(pick.fair_odds)}</b>. If your bookie
                  is shorter than the take price, move on.
                </p>

                <div className="consumer-card-footer">
                  <span>{kickoff(match.kickoff_at)}</span>
                  <a href="#price-checker">Check price →</a>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              No Footy shortlist is available right now.
            </div>
          )}
        </div>
      </section>

      <section className="shell everyday-strip">
        <article>
          <span>🔥</span>
          <div>
            <strong>What we like</strong>
            <small>The strongest model lean, in plain English.</small>
          </div>
        </article>
        <article>
          <span>💷</span>
          <div>
            <strong>What price we need</strong>
            <small>A clear fractional number — not vague “value”.</small>
          </div>
        </article>
        <article>
          <span>🚫</span>
          <div>
            <strong>When to walk away</strong>
            <small>Too short is too short, even on the likely winner.</small>
          </div>
        </article>
        <article>
          <span>📊</span>
          <div>
            <strong>How we&apos;re doing</strong>
            <small>Every published call stays on the results page.</small>
          </div>
        </article>
      </section>

      {!configured ? (
        <div className="shell warning">
          Supabase is not configured. Add the server-only environment
          variables from <code>web/.env.example</code>.
        </div>
      ) : null}

      <div className="shell notice consumer-notice">
        <strong>One rule:</strong> don&apos;t chase a team — chase the right price.
        Footy can like an outcome and still tell you to leave it alone if the odds
        are too short.
      </div>

      <details className="shell advanced-board">
        <summary>
          <div>
            <span className="eyebrow">Want the numbers?</span>
            <strong>Open the full model board</strong>
          </div>
          <span>Probabilities · Fair odds · Take prices</span>
        </summary>
        <div className="advanced-board-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">Advanced view</span>
            <h2>Full model board</h2>
          </div>
          <div className="board-legend">
            <span><b>Fair</b> model price</span>
            <span><b>Take</b> minimum interesting price</span>
            <span>Fractional odds · London time</span>
          </div>
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
                          <dd>{decimalToFractional(selection.fair_odds)}</dd>
                        </div>
                        <div>
                          <dt>Take at</dt>
                          <dd>
                            {minimumTakeToFractional(selection.minimum_take_price)}+
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
        </div>

      </details>

      <section className="shell section split" id="price-checker">
        <div className="panel">
          <span className="eyebrow">Got a price?</span>
          <h2>Ask Footy if it&apos;s big enough.</h2>
          <p className="muted">
            Type the fractional odds from your bookmaker — 7/4, 6/5, EVS etc.
            Footy tells you whether the price is interesting or too short.
          </p>
          <PriceChecker board={board} validationStatus={status} />
        </div>

        <div className="panel">
          <span className="eyebrow">Keep it simple</span>
          <h2>Three answers. That&apos;s it.</h2>
          <p className="muted">
            VALUE TIP means the price and evidence clear Footy&apos;s bar. WATCH
            means interesting, but not strong enough yet. PASS means don&apos;t
            force it at the price you entered.
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
            <span className="eyebrow">For the number nerds</span>
            <h2>Show me the proof underneath</h2>
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
            The paid product is heading toward a clean betting-information
            terminal: live bookmaker prices, best-price shopping, value alerts,
            saved tip watchlists, closing-line analysis and validated tip feeds.
          </p>
        </div>
        <div className="pro-feature-grid">
          <span>Live value scanner</span>
          <span>William Hill + best market</span>
          <span>Price alerts</span>
          <span>Saved tip watchlist</span>
          <span>Closing-price dashboard</span>
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
