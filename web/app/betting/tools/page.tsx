import { BettingAgeGate } from "@/components/age-gate";
import { BettingNav } from "@/components/betting-nav";
import { BetLab } from "@/components/bet-lab";

export default function BettingToolsPage() {
  return (
    <main className="betting-app">
      <BettingAgeGate />
      <BettingNav active="tools" />

      <section className="results-hero shell">
        <span>BET LAB</span>
        <h1>Know the price. Know the risk. Then decide.</h1>
        <p>
          Calculate returns, translate odds, test fair value, build accas, inspect
          CLV and see a conservative bankroll reference without leaving Footy.
        </p>
      </section>

      <div className="shell">
        <BetLab />
      </div>

      <footer className="betting-footer shell">
        <p><strong>18+ only.</strong> Calculators are analytical tools, not a guarantee of profit.</p>
        <p>PRICE → EDGE → RISK → DECISION</p>
      </footer>
    </main>
  );
}
