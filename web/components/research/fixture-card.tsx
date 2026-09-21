"use client";

import type {
  FixturePrediction,
  ScoutTeamProfile,
} from "@/lib/fpl";

export function ResearchFixtureCard({
  prediction,
  teamById,
  onOpenTeam,
}: {
  prediction: FixturePrediction;
  teamById: Map<number, ScoutTeamProfile>;
  onOpenTeam: (team: ScoutTeamProfile) => void;
}) {
  const pct = (value: number) => Math.round(value * 100);
  const homeTeam = teamById.get(prediction.homeTeamId);
  const awayTeam = teamById.get(prediction.awayTeamId);

  return (
    <article className="fixture-forecast-card">
      <div className="fixture-forecast-head">
        <button
          type="button"
          disabled={!homeTeam}
          onClick={() => homeTeam && onOpenTeam(homeTeam)}
        >
          <strong>{prediction.homeTeam}</strong>
          <small>{prediction.homeExpectedGoals.toFixed(2)} xG</small>
        </button>
        <div>
          <span>MODEL SCORE</span>
          <b>{prediction.mostLikelyScore}</b>
          <small>{prediction.confidence} confidence</small>
        </div>
        <button
          type="button"
          disabled={!awayTeam}
          onClick={() => awayTeam && onOpenTeam(awayTeam)}
        >
          <strong>{prediction.awayTeam}</strong>
          <small>{prediction.awayExpectedGoals.toFixed(2)} xG</small>
        </button>
      </div>

      <div
        className="fixture-probabilities"
        aria-label="Model outcome probabilities"
      >
        <div>
          <span>Home</span>
          <strong>{pct(prediction.homeWinProbability)}%</strong>
        </div>
        <div>
          <span>Draw</span>
          <strong>{pct(prediction.drawProbability)}%</strong>
        </div>
        <div>
          <span>Away</span>
          <strong>{pct(prediction.awayWinProbability)}%</strong>
        </div>
      </div>

      <div
        className="fixture-clean-sheets"
        aria-label="Model clean sheet probabilities"
      >
        <span>
          {prediction.homeShort} xCS{" "}
          <b>{pct(prediction.homeCleanSheetProbability)}%</b>
        </span>
        <span>
          {prediction.awayShort} xCS{" "}
          <b>{pct(prediction.awayCleanSheetProbability)}%</b>
        </span>
      </div>

      <p>{prediction.reason}</p>

      <details className="fixture-evidence-disclosure">
        <summary>
          <span>MATCHUP EVIDENCE</span>
          <strong>Attack, defence, trend and source confidence</strong>
        </summary>
        <div className="fixture-evidence">
          <span>
            ATT {prediction.evidence.homeAttackIndex?.toFixed(2) ?? "—"} vs DEF{" "}
            {prediction.evidence.awayDefenceIndex?.toFixed(2) ?? "—"}
          </span>
          <span>
            ATT {prediction.evidence.awayAttackIndex?.toFixed(2) ?? "—"} vs DEF{" "}
            {prediction.evidence.homeDefenceIndex?.toFixed(2) ?? "—"}
          </span>
          <span>
            xG/xGA {prediction.evidence.homeXg?.toFixed(2) ?? "—"}/
            {prediction.evidence.homeXga?.toFixed(2) ?? "—"} vs{" "}
            {prediction.evidence.awayXg?.toFixed(2) ?? "—"}/
            {prediction.evidence.awayXga?.toFixed(2) ?? "—"}
          </span>
          <span>
            ATT trend{" "}
            {prediction.evidence.homeAttackTrend == null
              ? "—"
              : (prediction.evidence.homeAttackTrend >= 0 ? "+" : "") +
                Math.round(prediction.evidence.homeAttackTrend * 100) +
                "%"}
            {" / "}
            {prediction.evidence.awayAttackTrend == null
              ? "—"
              : (prediction.evidence.awayAttackTrend >= 0 ? "+" : "") +
                Math.round(prediction.evidence.awayAttackTrend * 100) +
                "%"}
          </span>
          <span>
            DEF trend{" "}
            {prediction.evidence.homeDefenceTrend == null
              ? "—"
              : (prediction.evidence.homeDefenceTrend >= 0 ? "+" : "") +
                Math.round(prediction.evidence.homeDefenceTrend * 100) +
                "%"}
            {" / "}
            {prediction.evidence.awayDefenceTrend == null
              ? "—"
              : (prediction.evidence.awayDefenceTrend >= 0 ? "+" : "") +
                Math.round(prediction.evidence.awayDefenceTrend * 100) +
                "%"}
          </span>
          <span>
            Baseline {prediction.evidence.homeScoringPrior.toFixed(2)} /{" "}
            {prediction.evidence.awayScoringPrior.toFixed(2)} xG
          </span>
          <span>
            Source {Math.round(prediction.evidence.sourceConfidence * 100)}%
          </span>
        </div>
      </details>

      <small className="fixture-forecast-risk">
        <b>Failure mode:</b>{" "}
        {prediction.confidence === "LOW"
          ? "one or both teams have incomplete reconciled process evidence, so the forecast is deliberately low-confidence."
          : "future team news, injuries, rotation and genuine process changes can move the scoring rates; Footy re-runs with fresh data."}
      </small>
    </article>
  );
}
