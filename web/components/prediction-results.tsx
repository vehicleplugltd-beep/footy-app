import type { PredictionReceipt, PredictionResultsData } from "@/lib/betting";
import { decimalToFractional, minimumTakeToFractional } from "@/lib/odds";

function pct(value: number | null, digits = 1) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(digits)}%`;
}

function signed(value: number | null, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReceiptCard({ receipt }: { receipt: PredictionReceipt }) {
  const priced = receipt.quotedOdds != null;
  const qualifiedBet =
    receipt.validationStatus === "APPROVED" &&
    receipt.quotedOdds != null &&
    receipt.minimumTakePrice != null &&
    receipt.quotedOdds >= receipt.minimumTakePrice;
  const correct = receipt.resultStatus === "WON";
  const locked = new Date(receipt.publishedAt).getTime() < new Date(receipt.kickoffAt).getTime();

  return (
    <article className="receipt-card">
      <header>
        <div>
          <span>{receipt.market} · {receipt.validationStatus}</span>
          <h3>{receipt.homeTeam} <i>vs</i> {receipt.awayTeam}</h3>
          <small>Kick-off {dateTime(receipt.kickoffAt)}</small>
        </div>
        <strong className={correct ? "receipt-correct" : "receipt-wrong"}>
          {qualifiedBet
            ? (correct ? "QUALIFIED BET WON" : "QUALIFIED BET LOST")
            : (correct ? "PREDICTION CORRECT" : "PREDICTION INCORRECT")}
        </strong>
      </header>

      <div className="receipt-score">
        <span>FINAL</span>
        <strong>
          {receipt.homeGoals == null || receipt.awayGoals == null
            ? "Result unavailable"
            : `${receipt.homeTeam} ${receipt.homeGoals} — ${receipt.awayGoals} ${receipt.awayTeam}`}
        </strong>
      </div>

      <div className="receipt-call">
        <div>
          <span>FOOTY CALLED</span>
          <strong>{receipt.displaySelection}</strong>
          <small>{pct(receipt.modelProbability)} model probability</small>
        </div>
        <p><span>Fair</span><b>{decimalToFractional(receipt.fairOdds)}</b><small>{receipt.fairOdds.toFixed(2)}</small></p>
        <p><span>Take from</span><b>{receipt.minimumTakePrice ? minimumTakeToFractional(receipt.minimumTakePrice) + "+" : "—"}</b><small>{receipt.minimumTakePrice?.toFixed(2) ?? "—"}</small></p>
        <p><span>Quoted</span><b>{receipt.quotedOdds ? decimalToFractional(receipt.quotedOdds) : "—"}</b><small>{receipt.quotedBookmaker ?? "not price-qualified"}</small></p>
        <p><span>Close</span><b>{receipt.closingOdds ? decimalToFractional(receipt.closingOdds) : "—"}</b><small>{receipt.closingOdds?.toFixed(2) ?? "not recorded"}</small></p>
      </div>

      <footer>
        <div>
          <span>{locked ? "LOCKED BEFORE KICK-OFF" : "TIMESTAMP CHECK"}</span>
          <strong>Published {dateTime(receipt.publishedAt)}</strong>
        </div>
        <p>
          {qualifiedBet
            ? `CLV ${pct(receipt.clv, 2)} · unit P/L ${signed(receipt.unitProfit)}`
            : priced
              ? "A price was captured, but the frozen call did not qualify as a bet; excluded from betting ROI/CLV."
              : "No bookmaker price was frozen, so this call is excluded from betting ROI/CLV."}
        </p>
      </footer>
    </article>
  );
}

export function PredictionResults({ data }: { data: PredictionResultsData }) {
  const { summary } = data;
  return (
    <>
      <section className="receipt-summary">
        <article><span>Predictions graded</span><strong>{summary.predictions}</strong><small>all published calls</small></article>
        <article><span>Correct</span><strong>{summary.correct}</strong><small>{summary.incorrect} incorrect</small></article>
        <article><span>Prediction accuracy</span><strong>{pct(summary.accuracy)}</strong><small>not the same as ROI</small></article>
        <article><span>Qualified bets</span><strong>{summary.pricedBets}</strong><small>approved + cleared frozen take price</small></article>
        <article><span>Bet ROI</span><strong>{pct(summary.roi)}</strong><small>{summary.units == null ? "no priced sample" : `${signed(summary.units)} units`}</small></article>
        <article><span>Average CLV</span><strong>{pct(summary.averageClv, 2)}</strong><small>priced bets only</small></article>
      </section>

      <div className="results-trust-note">
        <strong>No cherry-picking.</strong>
        <p>
          A model prediction stays in the record whether it wins or loses. Betting
          performance is reported separately and only when the frozen pre-kickoff
          call was approved and the captured price cleared its minimum take.
        </p>
      </div>

      <section className="receipt-list">
        {data.receipts.length ? data.receipts.map((receipt) => (
          <ReceiptCard key={receipt.callKey} receipt={receipt} />
        )) : (
          <div className="betting-empty">
            <strong>No settled predictions yet.</strong>
            <p>Published pre-match calls will appear here automatically after settlement.</p>
          </div>
        )}
      </section>
    </>
  );
}
