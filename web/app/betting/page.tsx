import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";
import { BettingBoard } from "@/components/betting-board";
import { DailyPredictions } from "@/components/daily-predictions";
import { DecisionFeed } from "@/components/decision-feed";
import { BettingNav } from "@/components/betting-nav";
import { LeagueReadinessMap } from "@/components/league-readiness";
import { getBettingWorkspaceData } from "@/lib/betting";

function statusCopy(state: string) {
  if (state === "LIVE") return "Model + fresh bookmaker prices";
  if (state === "NO_FRESH_PRICES") return "Model ready · prices not fresh";
  if (state === "NO_CURRENT_MODEL") return "Fixtures found · model refresh required";
  return "Forward fixture refresh required";
}

export default async function BettingPage() {
  const data = await getBettingWorkspaceData();
  const betCount = data.selections.filter((row) => row.verdict === "BET").length;

  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="edge" />
      <DecisionFeed
        todayGames={data.todayGames}
        accas={data.accas}
      />

      <section className="betting-hero shell">
        <div>
          <span className="betting-kicker">FOOTY EDGE · 18+</span>
          <h1>Find the price error. Not the likely winner.</h1>
          <p>
            Underlying football process becomes a probability. Probability becomes
            a fair price. Only after that does Footy check the bookmaker market.
          </p>
          <div className="betting-hero-actions">
            <a href="#singles">Scan edges</a>
            <Link href="/betting/my-bets">Upload / track my bets</Link>
          </div>
        </div>

        <aside className="betting-live-card">
          <span>LIVE DECISION STATE</span>
          <strong>{statusCopy(data.dataState)}</strong>
          <div>
            <p><b>{data.matches.length}</b><small>upcoming fixtures</small></p>
            <p><b>{betCount}</b><small>BET singles</small></p>
            <p><b>{data.accas.length}</b><small>qualifying accas</small></p>
          </div>
          <small>
            Model {data.modelVersion}
            {data.latestModelAt
              ? ` · last model ${new Date(data.latestModelAt).toLocaleString("en-GB")}`
              : ""}
          </small>
        </aside>
      </section>

      <section className="betting-principles shell">
        <article>
          <span>DATA</span>
          <strong>Process before results</strong>
          <p>xG, npxG, xGA, shots, big chances, box activity, xGOT, territory and verified player data.</p>
        </article>
        <article>
          <span>MODEL</span>
          <strong>Probability before odds</strong>
          <p>Expected scoring and uncertainty are calculated before bookmaker prices are considered.</p>
        </article>
        <article>
          <span>PRICE</span>
          <strong>Take-price discipline</strong>
          <p>A likely outcome is still a PASS when the available price is too short.</p>
        </article>
        <article>
          <span>ACCA</span>
          <strong>No filler favourites</strong>
          <p>Doubles and trebles are built only from independently qualifying +EV legs.</p>
        </article>
      </section>

      <div className="shell">
        {data.dataState !== "LIVE" ? (
          <div className="betting-data-warning">
            <strong>Fixture coverage and betting qualification are separate.</strong>
            <p>
              Footy can show the global daily slate even when some competitions
              do not yet have a current model or verified bookmaker price. Those
              games stay labelled as coverage-only; stale model outputs are never
              promoted as live bets.
            </p>
          </div>
        ) : null}

        <DailyPredictions games={data.todayGames} />
        <LeagueReadinessMap leagues={data.leagueReadiness} />
        <BettingBoard selections={data.selections} accas={data.accas} />

        <section className="betting-section">
          <div className="betting-section-head">
            <div>
              <span>05 / MODEL GOVERNANCE</span>
              <h2>What is allowed to become a tip?</h2>
            </div>
          </div>
          <div className="validation-grid">
            {data.validations.length ? data.validations.map((row) => (
              <article key={`${row.league}:${row.market}`}>
                <span>{row.league} · {row.market}</span>
                <strong>{row.status}</strong>
                <small>{row.sample_size.toLocaleString()} validation samples</small>
                <p>{row.notes ?? "Validation evidence stored in the model ledger."}</p>
              </article>
            )) : (
              <article>
                <span>VALIDATION</span>
                <strong>RESEARCH</strong>
                <p>No current production validation row is available.</p>
              </article>
            )}
          </div>
        </section>

        <section className="betting-section betting-feedback-cta">
          <div>
            <span>YOUR DATA</span>
            <h2>Bring your own bets into the model loop.</h2>
            <p>
              Upload a CSV or enter singles and accas manually. Track ROI and CLV,
              settle results, and attach structured feedback when Footy&apos;s
              reasoning or data needs scrutiny.
            </p>
          </div>
          <Link href="/betting/my-bets">Open My Bets →</Link>
        </section>
      </div>

      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Footy provides analytics and decision support; it does not accept or place bets.</p>
        <p>DATA → PROCESS → PROBABILITY → FAIR PRICE → MARKET → EDGE</p>
      </footer>
    </main>
  );
}
