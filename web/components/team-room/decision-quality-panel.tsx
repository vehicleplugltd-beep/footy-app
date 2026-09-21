"use client";

import type { ManagerResponse } from "@/components/team-room/types";

type DecisionQuality = NonNullable<ManagerResponse["decision_quality"]>;

export function DecisionQualityPanel({
  decisionQuality,
}: {
  decisionQuality: DecisionQuality;
}) {
  return (
    <section className="team-room-block decision-quality-panel" id="audit">
      <div className="team-room-block-head">
        <div>
          <span>DECISION QUALITY</span>
          <h2>
            {decisionQuality.status === "ACTIVE"
              ? decisionQuality.summary?.deadlines +
                " tracked deadline" +
                (decisionQuality.summary?.deadlines === 1 ? "" : "s")
              : decisionQuality.status === "ACCUMULATING"
                ? "Building the clean history"
                : "Audit temporarily unavailable"}
          </h2>
        </div>
        <small>Process EV and outcome variance are scored separately</small>
      </div>

      {decisionQuality.status === "ACTIVE" && decisionQuality.summary ? (
        <>
          <div className="decision-quality-grid">
            <div>
              <span>CAPTAIN REGRET</span>
              <strong>
                {decisionQuality.summary.average_captain_expected_regret == null
                  ? "—"
                  : decisionQuality.summary.average_captain_expected_regret.toFixed(1)}
              </strong>
              <small>average frozen expected points given up</small>
            </div>
            <div>
              <span>TOP PATH</span>
              <strong>
                {(decisionQuality.summary.top_path_alignment * 100).toFixed(0)}%
              </strong>
              <small>deadlines matching Footy’s frozen top action</small>
            </div>
            <div>
              <span>OBJECTIVE REGRET</span>
              <strong>
                {decisionQuality.summary.average_counterplay_objective_regret_pp ==
                null
                  ? "—"
                  : decisionQuality.summary.average_counterplay_objective_regret_pp.toFixed(
                      1,
                    ) + "pp"}
              </strong>
              <small>
                {decisionQuality.summary.counterplay_comparable_deadlines} comparable
                CounterPlay path
                {decisionQuality.summary.counterplay_comparable_deadlines === 1
                  ? ""
                  : "s"}
              </small>
            </div>
            <div>
              <span>OUTCOME VARIANCE</span>
              <strong>
                {decisionQuality.summary.negative_variance_deadlines}
              </strong>
              <small>captain outcomes ≥2 below frozen expectation</small>
            </div>
          </div>

          <div className="decision-quality-observations">
            <span>WHAT THE SAMPLE ACTUALLY SAYS</span>
            {decisionQuality.summary.observations.map((item, index) => (
              <p key={"decision-observation-" + index}>{item}</p>
            ))}
          </div>

          <details className="decision-quality-history-disclosure">
            <summary>
              <span>DEADLINE HISTORY</span>
              <strong>
                Inspect {decisionQuality.completed.length} frozen audit
                {decisionQuality.completed.length === 1 ? "" : "s"}
              </strong>
              <small>Process, regret and realised variance by Gameweek.</small>
            </summary>
            <div className="decision-quality-history">
              {decisionQuality.completed.map((item) => (
                <article key={item.event}>
                  <header>
                    <b>GW{item.event}</b>
                    <small>
                      {item.receipt.posture ?? item.battle_mode ?? "—"} ·{" "}
                      {item.receipt.source.replaceAll("_", " ")} ·{" "}
                      {item.receipt.calibration_status === "EMPIRICAL"
                        ? "empirical"
                        : "fallback"}
                    </small>
                  </header>
                  <div>
                    <span>Captain process</span>
                    <strong>{item.captain.process.replaceAll("_", " ")}</strong>
                    <small>
                      {item.captain.model_player_name
                        ? "Model: " + item.captain.model_player_name
                        : "No comparable captain receipt"}
                    </small>
                  </div>
                  <div>
                    <span>Captain variance</span>
                    <strong>
                      {item.captain.actual_vs_model_expectation == null
                        ? "—"
                        : (item.captain.actual_vs_model_expectation >= 0
                            ? "+"
                            : "") +
                          item.captain.actual_vs_model_expectation.toFixed(1)}
                    </strong>
                    <small>actual raw points vs deadline expectation</small>
                  </div>
                  <div>
                    <span>Path process</span>
                    <strong>{item.transfers.process.replaceAll("_", " ")}</strong>
                    <small>
                      {item.transfers.top_path_label
                        ? "Frozen top: " + item.transfers.top_path_label
                        : "No comparable frozen top path"}
                    </small>
                  </div>
                  <div>
                    <span>Objective regret</span>
                    <strong>
                      {item.transfers.objective_regret == null
                        ? "—"
                        : (item.transfers.objective_regret * 100).toFixed(1) +
                          "pp"}
                    </strong>
                    <small>
                      {item.transfers.active_chip
                        ? item.transfers.active_chip + " · "
                        : ""}
                      {item.transfers.hit_cost
                        ? "-" + item.transfers.hit_cost + " hit"
                        : "no hit cost"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="decision-quality-empty">
          <strong>
            {decisionQuality.pending
              ? "GW" + decisionQuality.pending.event + " audit is armed."
              : "Decision Quality v2 starts with GW" +
                decisionQuality.tracked_from_event +
                "."}
          </strong>
          {decisionQuality.pending ? (
            <>
              <p>
                Frozen{" "}
                {new Date(
                  decisionQuality.pending.generated_at,
                ).toLocaleString()}{" "}
                · {decisionQuality.pending.source.replaceAll("_", " ")} ·{" "}
                {decisionQuality.pending.posture ?? "inferred posture"}
              </p>
              <p>
                Top path:{" "}
                {decisionQuality.pending.top_path ??
                  "hold / no material move"}{" "}
                ·{" "}
                {decisionQuality.pending.empirical
                  ? (decisionQuality.pending.calibration_samples?.toLocaleString() ??
                      "empirical") + " calibration samples"
                  : "volatility fallback"}
              </p>
            </>
          ) : (
            <p>
              Earlier Gameweeks are deliberately not reconstructed with hindsight.
              Footy scores only genuine frozen pre-deadline receipts against the
              manager’s eventual choice.
            </p>
          )}
        </div>
      )}

      <p className="decision-quality-caveat">{decisionQuality.caveat}</p>
    </section>
  );
}
