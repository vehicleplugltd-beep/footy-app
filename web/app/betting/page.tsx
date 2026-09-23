export const dynamic = "force-dynamic";

import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";
import { BettingBoard } from "@/components/betting-board";
import { DailyPredictions } from "@/components/daily-predictions";
import { DecisionFeed } from "@/components/decision-feed";
import { BettingNav } from "@/components/betting-nav";
import { LeagueReadinessMap } from "@/components/league-readiness";
import { UpcomingModelResearch } from "@/components/upcoming-model-research";
import { CORE_MODEL_LEAGUES, getBettingWorkspaceData } from "@/lib/betting";

function statusCopy(state: string) {
  if (state === "DATABASE_NOT_CONFIGURED") return "Data connection needs configuration";
  if (state === "LIVE") return "Match assessments and current bookmaker prices";
  if (state === "NO_FRESH_PRICES") return "Match assessments ready · awaiting current odds";
  if (state === "NO_CURRENT_MODEL") return "Fixtures found · analysis being updated";
  return "Upcoming fixture update required";
}

export default async function BettingPage() {
  const data = await getBettingWorkspaceData();
  const coreLeagues = new Set<string>(CORE_MODEL_LEAGUES);
  const coreTodayGames = data.todayGames.filter((game) => coreLeagues.has(game.league));
  const featuredGames = coreTodayGames;
  const betCount = data.selections.filter((row) => row.verdict === "BET").length;
  const modelledFixtures = new Set(data.selections.filter((row) => row.market === "1X2").map((row) => row.matchId)).size;

  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="edge" />
      <section className="betting-hero shell">
        <div>
          <span className="betting-kicker">FOOTY EDGE · 18+</span>
          <h1>Find value in the football, not just the result.</h1>
          <p>
            We study how teams create and concede chances, assess the matchup,
            then compare our fair price with the odds on offer.
          </p>
          <div className="betting-hero-actions">
            <a href="#singles">Explore the analysis</a>
            <Link href="/betting/my-bets">Upload / track my bets</Link>
          </div>
        </div>

        <aside className="betting-live-card">
          <span>TODAY'S MARKET CHECK</span>
          <strong>{statusCopy(data.dataState)}</strong>
          <div>
            <p><b>{modelledFixtures}</b><small>matches assessed</small></p>
            <p><b>{betCount}</b><small>value selections</small></p>
            <p><b>{data.accas.length}</b><small>qualifying multiples</small></p>
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
          <strong>Look beyond the scoreline</strong>
          <p>xG, npxG, xGA, shots, big chances, box activity, xGOT, territory and verified player data.</p>
        </article>
        <article>
          <span>MODEL</span>
          <strong>Study the matchup first</strong>
          <p>Our assessment of the game comes first. The bookmaker's price is checked afterwards.</p>
        </article>
        <article>
          <span>PRICE</span>
          <strong>Only take the right price</strong>
          <p>A strong football case is not enough when the odds are too short.</p>
        </article>
        <article>
          <span>ACCA</span>
          <strong>No filler selections</strong>
          <p>Every leg must offer value on its own.</p>
        </article>
      </section>

      {!data.configured ? (
        <section className="betting-section shell" role="status">
          <div className="betting-data-warning">
            <strong>Our match analysis is temporarily unavailable.</strong>
            <p>The server has no configured database connection. Fixture discovery alone cannot provide probabilities or verified betting prices. This is a service configuration issue, not a model verdict.</p>
          </div>
        </section>
      ) : null}
      {data.configured && modelledFixtures === 0 ? (
        <section className="betting-section shell" role="status">
          <div className="betting-data-warning">
            <strong>Our upcoming match assessments are not reaching this page.</strong>
            <p>The ten-league fixture feed is not a substitute for verified model output. The data pipeline or server-side read needs attention; no market will be promoted to BET from coverage-only fixtures.</p>
          </div>
        </section>
      ) : null}
      <UpcomingModelResearch selections={data.selections} />
      <DecisionFeed
        todayGames={featuredGames}
        accas={data.accas}
        upcomingModelledCount={new Set(data.selections.filter((row) => row.market === "1X2").map((row) => row.matchId)).size}
      />

      <div className="shell">
        {data.dataState !== "LIVE" ? (
          <div className="betting-data-warning">
            <strong>A fixture listing is not a betting recommendation.</strong>
            <p>
              Today focuses on our ten supported domestic leagues. We only flag a selection when the match
              assessment is complete and the bookmaker price is current. Otherwise, it stays on the watchlist.
            </p>
          </div>
        ) : null}

        <DailyPredictions games={featuredGames} />
        <details className="today-coverage-drawer">
          <summary>See data coverage and readiness across our supported domestic leagues</summary>
          <LeagueReadinessMap leagues={data.leagueReadiness.filter((row) => row.modelScope === "CORE")} />
        </details>
        <BettingBoard selections={data.selections} accas={data.accas} />

        <details className="betting-section today-coverage-drawer">
          <summary>How we check the reliability of our analysis</summary>
          <div className="betting-section-head">
            <div>
              <span>05 / MODEL GOVERNANCE</span>
              <h2>When is a selection ready to back?</h2>
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
        </details>

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
