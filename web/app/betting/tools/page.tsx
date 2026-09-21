import { BettingAgeGate } from "@/components/age-gate";
import { BettingNav } from "@/components/betting-nav";
import { BetLab } from "@/components/bet-lab";
import { getBettingWorkspaceData } from "@/lib/betting";

export default async function BettingToolsPage() {
  const data = await getBettingWorkspaceData();
  const modelMarkets = data.selections.map((selection) => ({
    id: `${selection.matchId}:${selection.market}:${selection.selection}`,
    eventName: `${selection.homeTeam} vs ${selection.awayTeam}`,
    market: selection.market,
    selection: selection.displaySelection,
    modelProbability: selection.modelProbability,
    fairOdds: selection.fairOdds,
    minimumTakePrice: selection.minimumTakePrice,
    validationStatus: selection.validationStatus,
    verdict: selection.verdict,
    williamHillOdds: selection.williamHillPrice?.decimal_odds ?? null,
  }));

  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="tools" />

      <section className="results-hero shell">
        <span>BET LAB</span>
        <h1>Know the price. Know the risk. Then decide.</h1>
        <p>
          Calculate returns, translate odds, test fair value, diagnose accas,
          inspect CLV and compare any bookmaker offer against Footy&apos;s current
          model without leaving the app.
        </p>
      </section>

      <div className="shell">
        <BetLab modelMarkets={modelMarkets} />
      </div>

      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Calculators are analytical tools, not a guarantee of profit.</p>
        <p>PRICE → EDGE → RISK → DECISION</p>
      </footer>
    </main>
  );
}
