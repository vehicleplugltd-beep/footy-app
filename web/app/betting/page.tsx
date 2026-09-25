export const dynamic = "force-dynamic";

import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";
import { BettingBoard } from "@/components/betting-board";
import { DailyPredictions } from "@/components/daily-predictions";
import { BettingNav } from "@/components/betting-nav";
import { CORE_MODEL_LEAGUES, getBettingWorkspaceData } from "@/lib/betting";

export default async function BettingPage() {
  const data = await getBettingWorkspaceData();
  const core = new Set<string>(CORE_MODEL_LEAGUES);
  const games = data.todayGames.filter((game) => core.has(game.league));
  const selections = data.selections.filter((row) =>
    core.has(row.league) && ["1X2", "TOTAL_2.5", "BTTS"].includes(row.market),
  );
  const assessed = new Set(selections.map((row) => row.matchId)).size;
  const bets = selections.filter((row) => row.verdict === "BET").length;

  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="edge" />
      <section className="betting-hero shell">
        <div>
          <span className="betting-kicker">FOOTY EDGE · V1 · 18+</span>
          <h1>Today's value</h1>
          <p>Premier League and Championship. We assess verified underlying performance before comparing fair odds with current prices. Missing data means no selection.</p>
          <div className="betting-hero-actions">
            <a href="#singles">View market analysis</a>
            <Link href="/betting/my-bets">Track results</Link>
          </div>
        </div>
        <aside className="betting-live-card">
          <span>MODEL STATUS</span>
          <strong>{data.dataState === "LIVE" ? "Market assessment available" : "Research / data pending"}</strong>
          <div>
            <p><b>{assessed}</b><small>matches assessed</small></p>
            <p><b>{bets}</b><small>qualified selections</small></p>
          </div>
          <small>Model {data.modelVersion}{data.latestModelAt ? ` · updated ${new Date(data.latestModelAt).toLocaleString("en-GB")}` : ""}</small>
        </aside>
      </section>
      {!data.configured || assessed === 0 ? (
        <section className="betting-section shell" role="status">
          <div className="betting-data-warning">
            <strong>{!data.configured ? "Database connection unavailable." : "No eligible modelled fixtures right now."}</strong>
            <p>Only verified process, complete model output, validated markets and fresh matched bookmaker prices can produce a BET. We do not substitute fixture lists or odds for underlying data.</p>
          </div>
        </section>
      ) : null}
      <DailyPredictions games={games} />
      <div className="shell">
        <BettingBoard selections={selections} accas={[]} />
        <section className="betting-section betting-feedback-cta">
          <div>
            <span>PERFORMANCE</span>
            <h2>Track what happens after the selection.</h2>
            <p>Review settled results, ROI and price movement. This release is limited to 1X2, Over/Under 2.5 and BTTS.</p>
          </div>
          <Link href="/betting/my-bets">Open My Bets →</Link>
        </section>
      </div>
      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Footy provides analytics; it does not accept or place bets.</p>
        <p>DATA → PROCESS → PROBABILITY → FAIR PRICE → MARKET → EDGE</p>
      </footer>
    </main>
  );
}
