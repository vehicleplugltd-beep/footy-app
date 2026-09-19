import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";
import { decimalToFractional, minimumTakeToFractional } from "@/lib/odds";
import { getResultsData, type AccuracyPoint, type PublicCall } from "@/lib/results";

export const dynamic = "force-dynamic";

function pct(value: number | null, digits = 1) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function selectionLabel(call: PublicCall) {
  if (call.selection === "home") return call.home_team;
  if (call.selection === "away") return call.away_team;
  if (call.selection === "draw") return "Draw";
  return call.selection;
}

function kickoff(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function AccuracyChart({ data }: { data: AccuracyPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="results-chart-empty">
        The live accuracy curve starts after two settled published calls.
      </div>
    );
  }

  const width = 760;
  const height = 240;
  const pad = 24;
  const minY = Math.max(
    0,
    Math.min(...data.map((point) => point.accuracy)) - 8,
  );
  const maxY = Math.min(
    100,
    Math.max(...data.map((point) => point.accuracy)) + 8,
  );
  const spanY = Math.max(1, maxY - minY);

  const points = data
    .map((point, index) => {
      const x =
        pad +
        (index / Math.max(1, data.length - 1)) * (width - pad * 2);
      const y =
        height -
        pad -
        ((point.accuracy - minY) / spanY) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = data[data.length - 1];

  return (
    <div className="results-chart">
      <div className="results-chart-head">
        <div>
          <span className="eyebrow">Published model calls</span>
          <strong>{last.accuracy.toFixed(1)}% cumulative hit rate</strong>
        </div>
        <small>{data.length} settled calls</small>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cumulative published model-call accuracy"
      >
        <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} />
        <polyline points={points} />
      </svg>
      <div className="results-chart-foot">
        <span>{data[0]?.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

function ResultBadge({ call }: { call: PublicCall }) {
  const className =
    call.result_status === "WON"
      ? "result-win"
      : call.result_status === "LOST"
        ? "result-loss"
        : "result-open";

  return (
    <span className={`result-badge ${className}`}>
      {call.result_status}
    </span>
  );
}

export default async function ResultsPage() {
  const data = await getResultsData();
  const hitRate = data.modelCalls.hitRate;
  const streak = data.modelCalls.streak;

  return (
    <main>
      <BettingAgeGate />

      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Prices</Link>
          <Link className="nav-active" href="/results">Results</Link>
          <Link href="/pro">Pro</Link>
          <Link href="/account">Account</Link>
        </div>
      </nav>

      <section className="shell results-hero">
        <div>
          <span className="eyebrow">Transparent performance</span>
          <h1>Receipts, not screenshots.</h1>
          <p>
            Every public model call is frozen before kickoff and settled
            automatically from the match result. Losing calls stay visible.
            Profit figures only appear when Footy archived a real quoted price
            before kickoff.
          </p>
        </div>
        <div className="results-live-card">
          <span className="live-dot" />
          <div>
            <small>Automatic ledger</small>
            <strong>Twice-daily refresh</strong>
          </div>
        </div>
      </section>

      <section className="shell results-kpis">
        <article>
          <span>Published calls</span>
          <strong>{data.modelCalls.published}</strong>
          <small>{data.modelCalls.open} still open</small>
        </article>
        <article>
          <span>Settled</span>
          <strong>{data.modelCalls.settled}</strong>
          <small>
            {data.modelCalls.wins}W · {data.modelCalls.losses}L
          </small>
        </article>
        <article>
          <span>Hit rate</span>
          <strong>{hitRate === null ? "—" : `${(hitRate * 100).toFixed(1)}%`}</strong>
          <small>top 1X2 model call</small>
        </article>
        <article>
          <span>Current streak</span>
          <strong>
            {streak.count
              ? `${streak.count} ${streak.type === "WON" ? "W" : "L"}`
              : "—"}
          </strong>
          <small>settled calls only</small>
        </article>
      </section>

      <section className="shell results-main-grid">
        <AccuracyChart data={data.modelCalls.curve} />

        <aside className="results-proof-card">
          <span className="eyebrow">Value-tip performance</span>
          <h2>
            {data.valueTips.settledPriced
              ? pct(data.valueTips.roi)
              : "Waiting for priced tips"}
          </h2>
          <p>
            Yield is only calculated from published VALUE TIP records carrying
            an archived bookmaker price. We do not apply a closing price
            retrospectively after seeing the result.
          </p>
          <dl className="results-proof-list">
            <div>
              <dt>Published value tips</dt>
              <dd>{data.valueTips.published}</dd>
            </div>
            <div>
              <dt>Priced & settled</dt>
              <dd>{data.valueTips.settledPriced}</dd>
            </div>
            <div>
              <dt>Unit profit</dt>
              <dd>
                {data.valueTips.unitProfit === null
                  ? "—"
                  : data.valueTips.unitProfit.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Average CLV</dt>
              <dd>{pct(data.valueTips.averageClv, 2)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <span className="eyebrow">The ledger</span>
            <h2>Every published call</h2>
          </div>
          <div className="board-legend">
            <span><b>MODEL CALL</b> top model outcome</span>
            <span><b>VALUE TIP</b> approved signal with archived price</span>
          </div>
        </div>

        <div className="results-ledger">
          {data.recentCalls.length ? (
            data.recentCalls.map((call) => (
              <article className="results-row" key={call.id}>
                <div className="results-event">
                  <div className="results-row-top">
                    <span className="call-kind">
                      {call.source_kind === "MODEL_CALL" ? "MODEL CALL" : "VALUE TIP"}
                    </span>
                    <ResultBadge call={call} />
                  </div>
                  <strong>
                    {call.home_team} <i>v</i> {call.away_team}
                  </strong>
                  <small>{kickoff(call.kickoff_at)}</small>
                </div>

                <div className="results-pick">
                  <span>Selection</span>
                  <strong>{selectionLabel(call)}</strong>
                  <small>{(call.model_probability * 100).toFixed(1)}% model probability</small>
                </div>

                <div className="results-price">
                  <span>Fair</span>
                  <strong>{decimalToFractional(call.fair_odds)}</strong>
                  <small>
                    Take{" "}
                    {call.minimum_take_price
                      ? `${minimumTakeToFractional(call.minimum_take_price)}+`
                      : "—"}
                  </small>
                </div>

                <div className="results-score">
                  <span>Result</span>
                  <strong>
                    {call.home_goals === null || call.away_goals === null
                      ? "Pending"
                      : `${call.home_goals}–${call.away_goals}`}
                  </strong>
                  <small>{call.validation_status ?? "UNRATED"}</small>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              The public ledger has just been switched on. Upcoming calls will
              appear here automatically before kickoff.
            </div>
          )}
        </div>
      </section>

      <section className="shell section results-rules">
        <div>
          <span className="eyebrow">The rules</span>
          <h2>How we keep the record honest</h2>
        </div>
        <div className="results-rule-grid">
          <article>
            <strong>Frozen before kickoff</strong>
            <p>Selection, probability and fair price are immutable once published.</p>
          </article>
          <article>
            <strong>Losses stay visible</strong>
            <p>The ledger is append-and-settle, not a hand-edited winners gallery.</p>
          </article>
          <article>
            <strong>No fake ROI</strong>
            <p>Profit is shown only when a genuine bookmaker quote was archived pre-match.</p>
          </article>
          <article>
            <strong>Model versions shown</strong>
            <p>Performance belongs to the model that produced the call, not a moving target.</p>
          </article>
        </div>
      </section>

      <footer className="shell footer">
        <p>
          Footy provides betting information and analytics. Historical
          performance does not guarantee future results.
        </p>
        <p>PUBLISH → FREEZE → SETTLE → DISPLAY</p>
      </footer>
    </main>
  );
}
