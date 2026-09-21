import { BettingAgeGate } from "@/components/age-gate";
import { BettingNav } from "@/components/betting-nav";
import { MyBetsWorkspace } from "@/components/my-bets-workspace";

export default function MyBetsPage() {
  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="bets" />
      <section className="my-bets-hero shell">
        <span>MY BETS · PRIVATE WORKSPACE</span>
        <h1>Your bets become evidence.</h1>
        <p>
          Upload or enter singles and accas, settle outcomes, measure ROI and CLV,
          and feed structured observations back into Footy&apos;s model-quality loop.
        </p>
      </section>
      <div className="shell">
        <MyBetsWorkspace />
      </div>
      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Your betting records are user-owned and protected by row-level security.</p>
        <p>UPLOAD → RECONCILE → TRACK → REVIEW → IMPROVE</p>
      </footer>
    </main>
  );
}
