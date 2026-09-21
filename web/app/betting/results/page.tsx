import { BettingAgeGate } from "@/components/age-gate";
import { BettingNav } from "@/components/betting-nav";
import { PredictionResults } from "@/components/prediction-results";
import { getPredictionResultsData } from "@/lib/betting";

export default async function BettingResultsPage() {
  const data = await getPredictionResultsData();

  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="results" />

      <section className="results-hero shell">
        <span>FOOTY RECEIPTS</span>
        <h1>What we said. When we said it. What happened.</h1>
        <p>
          Every frozen prediction stays visible after kick-off. Results are not
          retrofitted, and prediction accuracy is kept separate from betting ROI.
        </p>
      </section>

      <div className="shell">
        <PredictionResults data={data} />
      </div>

      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Historical results do not guarantee future performance.</p>
        <p>PUBLISH → LOCK → SETTLE → CALIBRATE</p>
      </footer>
    </main>
  );
}
