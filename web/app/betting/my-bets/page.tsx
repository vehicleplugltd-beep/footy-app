import { BettingAgeGate } from "@/components/age-gate";
import { BettingNav } from "@/components/betting-nav";
import { MyBetsWorkspace } from "@/components/my-bets-workspace";
import { getBettingWorkspaceData } from "@/lib/betting";

export default async function MyBetsPage() {
  const data = await getBettingWorkspaceData();
  const modelMarkets = data.selections.map((selection) => ({
    id: `${selection.matchId}:${selection.market}:${selection.selection}`,
    matchId: selection.matchId,
    eventName: `${selection.homeTeam} vs ${selection.awayTeam}`,
    market: selection.market,
    selection: selection.displaySelection,
    modelVersion: selection.modelVersion,
    modelProbability: selection.modelProbability,
    fairOdds: selection.fairOdds,
    minimumTakePrice: selection.minimumTakePrice,
  }));

  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="bets" />
      <section className="my-bets-hero shell">
        <span>MY BETS · PRIVATE WORKSPACE</span>
        <h1>Your bets become evidence.</h1>
        <p>
          Upload or enter singles and accas, settle outcomes, measure ROI and CLV,
          compare your taken price with Footy&apos;s model, and feed structured
          observations back into the model-quality loop.
        </p>
      </section>
      <div className="shell">
        <MyBetsWorkspace modelMarkets={modelMarkets} />
      </div>
      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Your betting records are user-owned and protected by row-level security.</p>
        <p>UPLOAD → RECONCILE → TRACK → REVIEW → IMPROVE</p>
      </footer>
    </main>
  );
}
