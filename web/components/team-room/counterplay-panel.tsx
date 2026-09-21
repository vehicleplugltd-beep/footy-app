"use client";

import Link from "next/link";
import type {
  CounterPosture,
  ManagerResponse,
} from "@/components/team-room/types";

type CounterPlay = NonNullable<ManagerResponse["counterplay"]>;
type HorizonResult = NonNullable<
  NonNullable<CounterPlay["horizon_results"]>["1"]
>;

export function CounterPlayPanel({
  counterPlay,
  activePosture,
  postureLoading,
  postureError,
  activeHorizon,
  horizon,
  researchHref,
  onPostureChange,
  onHorizonChange,
}: {
  counterPlay: CounterPlay;
  activePosture: CounterPosture;
  postureLoading: boolean;
  postureError: string | null;
  activeHorizon: HorizonResult | null;
  horizon: 1 | 3 | 5;
  researchHref: string;
  onPostureChange: (posture: CounterPosture) => void;
  onHorizonChange: (horizon: 1 | 3 | 5) => void;
}) {
  return (
    <section className="team-room-block counterplay-panel" id="counterplay">
      <div className="team-room-block-head">
        <div>
          <span>COUNTERPLAY</span>
          <h2>
            {activePosture} ·{" "}
            {activeHorizon?.recommended_scenario?.label ??
              counterPlay.recommended_scenario?.label ??
              "Hold structure"}
          </h2>
        </div>
        <small>
          {counterPlay.iterations.toLocaleString()} correlated simulations ·{" "}
          {counterPlay.managers_in_local_matrix} league squads
        </small>
      </div>

      <div
        className="counterplay-posture-shell"
        aria-busy={postureLoading}
      >
        <div className="counterplay-posture-copy">
          <span>RISK POSTURE</span>
          <strong>What are you optimising for?</strong>
          <small>
            Footy infers {counterPlay.strategy_mode}. Changing posture changes
            the league objective and future path thresholds, not the
            football-quality gate.
          </small>
        </div>
        <div
          className="counterplay-posture-toggle"
          aria-label="CounterPlay posture"
        >
          {(["PROTECT", "HYBRID", "ATTACK"] as const).map((posture) => (
            <button
              key={posture}
              type="button"
              className={activePosture === posture ? "active" : ""}
              aria-pressed={activePosture === posture}
              disabled={postureLoading}
              onClick={() => onPostureChange(posture)}
            >
              <b>{posture}</b>
              <small>
                {posture === "PROTECT"
                  ? "Defend control"
                  : posture === "ATTACK"
                    ? "Maximise upside"
                    : "Balance both sides"}
              </small>
            </button>
          ))}
        </div>
        <div className="counterplay-posture-status" aria-live="polite">
          {postureLoading
            ? "Re-running correlated simulations…"
            : postureError
              ? postureError
              : counterPlay.posture_source === "USER"
                ? "Using your selected posture."
                : "Using Footy’s inferred posture."}
        </div>
      </div>

      <div className="counterplay-primary-context">
        <p className="counterplay-objective">{counterPlay.objective}</p>
        <div
          className={
            "counterplay-impact counterplay-impact-" +
            counterPlay.game_theory_impact.band.toLowerCase()
          }
        >
          <span>GAME THEORY</span>
          <strong>{counterPlay.game_theory_impact.band}</strong>
          <p>{counterPlay.game_theory_impact.explanation}</p>
        </div>
      </div>

      {counterPlay.horizon_results && activeHorizon ? (
        <div className="counterplay-horizon-shell">
          <div className="counterplay-horizon-head">
            <div>
              <span>STATEFUL PATH</span>
              <strong>{activeHorizon.horizon}GW command plan</strong>
            </div>
            <small>
              Transfers, captaincy, FT, cash, hits and supported chips are
              re-evaluated at each deadline.
            </small>
          </div>
          <div
            className="counterplay-horizon-toggle"
            aria-label="CounterPlay horizon"
          >
            {([1, 3, 5] as const).map((option) => {
              const key = String(option) as "1" | "3" | "5";
              if (!counterPlay.horizon_results?.[key]) return null;
              return (
                <button
                  key={option}
                  type="button"
                  className={horizon === option ? "active" : ""}
                  aria-pressed={horizon === option}
                  title={
                    "Model the next " +
                    option +
                    " Gameweek" +
                    (option === 1 ? "" : "s")
                  }
                  onClick={() => onHorizonChange(option)}
                >
                  {option}GW
                </button>
              );
            })}
          </div>

          <div className="counterplay-horizon-summary">
            <div>
              <span>OBJECTIVE</span>
              <strong>
                {activeHorizon.recommended_scenario
                  ? (
                      activeHorizon.recommended_scenario.objective_probability *
                      100
                    ).toFixed(1) + "%"
                  : "—"}
              </strong>
              <small>
                {activeHorizon.recommended_scenario
                  ? (activeHorizon.recommended_scenario.probability_delta >= 0
                      ? "+"
                      : "") +
                    (
                      activeHorizon.recommended_scenario.probability_delta * 100
                    ).toFixed(1) +
                    "pp vs hold"
                  : "No path edge"}
              </small>
            </div>
            <div className="counterplay-horizon-summary-primary">
              <span>BEST PATH</span>
              <strong>
                {activeHorizon.recommended_scenario?.label ?? "Hold structure"}
              </strong>
              <small>{activeHorizon.event_names.join(" → ")}</small>
            </div>
            <div>
              <span>END STATE</span>
              <strong>
                {activeHorizon.recommended_scenario
                  ? activeHorizon.recommended_scenario.resource_path
                      .ending_free_transfers +
                    " FT · £" +
                    activeHorizon.recommended_scenario.resource_path.ending_bank.toFixed(
                      1,
                    )
                  : "—"}
              </strong>
              <small>
                {activeHorizon.recommended_scenario
                  ? activeHorizon.recommended_scenario.resource_path.hit_cost +
                    " pts projected hits"
                  : "No resource path"}
              </small>
            </div>
            <div>
              <span>5TH–95TH</span>
              <strong>
                {activeHorizon.recommended_scenario
                  ? activeHorizon.recommended_scenario.floor_5.toFixed(1) +
                    "–" +
                    activeHorizon.recommended_scenario.ceiling_95.toFixed(1)
                  : "—"}
              </strong>
              <small>cumulative model score band</small>
            </div>
          </div>

          {activeHorizon.recommended_scenario ? (
            <>
              <div className="counterplay-primary-reason">
                <span>WHY THIS PATH</span>
                <p>
                  {counterPlay.recommended_scenario?.reason ??
                    "This path gives the strongest current league objective after football-quality gating."}
                </p>
              </div>
              <div className="counterplay-path-weeks">
                {activeHorizon.recommended_scenario.resource_path.weeks.map(
                  (week) => (
                    <article key={week.event_id}>
                      <div>
                        <b>{week.event_name}</b>
                        <small>
                          {week.transfers.length
                            ? week.transfers
                                .map(
                                  (move) =>
                                    move.out.name + " → " + move.in.name,
                                )
                                .join(" · ")
                            : "Bank / hold"}
                        </small>
                      </div>
                      <div>
                        <span>C {week.captain?.name ?? "—"}</span>
                        <span>
                          {week.free_transfers_after} FT · £
                          {week.bank_after.toFixed(1)}
                          {week.hit_cost ? " · -" + week.hit_cost : ""}
                        </span>
                        {week.chip ? <span>{week.chip}</span> : null}
                      </div>
                    </article>
                  ),
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <details className="counterplay-deep-dive">
        <summary>
          <span>ADVANCED COUNTERPLAY</span>
          <strong>Calibration, scenarios, threats & rival responses</strong>
          <small>
            Open when you want the evidence underneath the command plan.
          </small>
        </summary>

        <div
          className={
            "counterplay-calibration-status " +
            (counterPlay.volatility_calibration.status === "EMPIRICAL"
              ? "empirical"
              : "fallback")
          }
        >
          <span>
            {counterPlay.volatility_calibration.status === "EMPIRICAL"
              ? "EMPIRICAL TAILS"
              : "TAIL FALLBACK"}
          </span>
          <strong>
            {counterPlay.volatility_calibration.status === "EMPIRICAL"
              ? counterPlay.volatility_calibration.sample_count.toLocaleString() +
                " historical player-GW samples"
              : "Historical calibration temporarily unavailable"}
          </strong>
          <small>
            5th–95th ranges are direct simulation quantiles, not a symmetric
            normal approximation.
          </small>
        </div>

        <div className="counterplay-layout">
          <section>
            <span>SCENARIOS</span>
            <div className="counterplay-scenarios">
              {counterPlay.scenarios.map((scenario) => (
                <article key={scenario.id}>
                  <div>
                    <b>{scenario.label}</b>
                    <small>{scenario.style}</small>
                  </div>
                  <strong>
                    {(scenario.objective_probability * 100).toFixed(1)}%
                  </strong>
                  <small>
                    {(scenario.probability_delta >= 0 ? "+" : "") +
                      (scenario.probability_delta * 100).toFixed(1)}
                    pp · mean {scenario.mean_score.toFixed(1)}
                  </small>
                  <p>{scenario.reason}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <span>PRIMARY RIVAL THREATS</span>
            <div className="counterplay-threats">
              {counterPlay.primary_threats.slice(0, 8).map((threat) => (
                <Link
                  key={threat.rival_entry_id + "-" + threat.player.id}
                  href={researchHref + "&player=" + threat.player.id}
                >
                  <div>
                    <b>{threat.player.name}</b>
                    <small>
                      {threat.rival_name} · {threat.player.team}
                    </small>
                  </div>
                  <strong>{threat.threat_score}/100</strong>
                  <small>
                    ceiling {threat.ceiling_proxy.toFixed(1)} · local starter{" "}
                    {threat.local_exposure
                      ? threat.local_exposure.starter_ownership.toFixed(0) + "%"
                      : "—"}
                  </small>
                </Link>
              ))}
            </div>
            {counterPlay.primary_threats.length > 8 ? (
              <details className="counterplay-full-list">
                <summary>
                  View all {counterPlay.primary_threats.length} rival threat
                  assets
                </summary>
                <div className="counterplay-threats">
                  {counterPlay.primary_threats.map((threat) => (
                    <Link
                      key={
                        "all-" +
                        threat.rival_entry_id +
                        "-" +
                        threat.player.id
                      }
                      href={researchHref + "&player=" + threat.player.id}
                    >
                      <div>
                        <b>{threat.player.name}</b>
                        <small>
                          {threat.rival_name} · {threat.player.team}
                        </small>
                      </div>
                      <strong>{threat.threat_score}/100</strong>
                      <small>
                        ceiling {threat.ceiling_proxy.toFixed(1)} · local starter{" "}
                        {threat.local_exposure
                          ? threat.local_exposure.starter_ownership.toFixed(0) +
                            "%"
                          : "—"}
                      </small>
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <div className="counterplay-layout secondary">
          <section>
            <span>LOCAL LEAGUE EXPOSURE</span>
            <div className="counterplay-exposure">
              {counterPlay.local_exposure.slice(0, 12).map((item) => (
                <Link
                  key={item.player_id}
                  href={researchHref + "&player=" + item.player_id}
                >
                  <b>{item.player?.name ?? "Player " + item.player_id}</b>
                  <small>
                    squad {item.squad_ownership.toFixed(0)}% · starters{" "}
                    {item.starter_ownership.toFixed(0)}% · captains{" "}
                    {item.captain_share.toFixed(0)}%
                  </small>
                  <strong>
                    {item.effective_exposure.toFixed(0)}% local exposure
                  </strong>
                </Link>
              ))}
            </div>
            {counterPlay.local_exposure.length > 12 ? (
              <details className="counterplay-full-list">
                <summary>
                  View all {counterPlay.local_exposure.length} league-owned
                  players
                </summary>
                <div className="counterplay-exposure">
                  {counterPlay.local_exposure.map((item) => (
                    <Link
                      key={"all-exposure-" + item.player_id}
                      href={researchHref + "&player=" + item.player_id}
                    >
                      <b>{item.player?.name ?? "Player " + item.player_id}</b>
                      <small>
                        squad {item.squad_ownership.toFixed(0)}% · starters{" "}
                        {item.starter_ownership.toFixed(0)}% · captains{" "}
                        {item.captain_share.toFixed(0)}%
                      </small>
                      <strong>
                        {item.effective_exposure.toFixed(0)}% local exposure
                      </strong>
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          <section>
            <span>RIVAL TRANSFER VECTORS</span>
            <div className="counterplay-vectors">
              {counterPlay.rival_vectors.map((rival) => (
                <article key={rival.entry_id}>
                  <header>
                    <b>{rival.name}</b>
                    <small>
                      gap {rival.gap >= 0 ? "+" : ""}
                      {rival.gap} · £{rival.bank.toFixed(1)}m bank ·{" "}
                      {rival.estimated_free_transfers == null
                        ? "FT unknown"
                        : rival.estimated_free_transfers + "/5 FT"}
                    </small>
                  </header>
                  <small className="counterplay-rival-meta">
                    {rival.activity ?? "resource style unknown"} ·{" "}
                    {rival.recent_transfers == null
                      ? "recent transfers unknown"
                      : rival.recent_transfers + " moves / last 4"}{" "}
                    · confidence{" "}
                    {(rival.response_confidence * 100).toFixed(0)}%
                  </small>
                  <small className="counterplay-rival-meta">
                    {rival.remaining_chips.length
                      ? rival.remaining_chips.join(", ") + " available"
                      : "no tracked chips remaining in current half"}
                    {rival.response_uncertainty ===
                    "ELEVATED_CHIP_OPTIONALITY"
                      ? " · chip optionality widens response uncertainty"
                      : rival.response_uncertainty === "DIFFUSE"
                        ? " · response weights are diffuse"
                        : ""}
                  </small>
                  {rival.transfer_vectors.length ? (
                    rival.transfer_vectors.map((vector, vectorIndex) => (
                      <div
                        className="counterplay-vector-row"
                        key={rival.entry_id + "-" + vectorIndex}
                      >
                        <p>
                          {vector.label} ·{" "}
                          <b>
                            {(vector.model_share * 100).toFixed(0)}% relative
                            response weight
                          </b>
                        </p>
                        <small>
                          {vector.drivers.slice(0, 3).join(" · ")}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p>No current response vector is available.</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </details>

      <details className="counterplay-caveats">
        <summary>Simulation assumptions & limitations</summary>
        {counterPlay.caveats.map((item, index) => (
          <p key={"counter-caveat-" + index}>{item}</p>
        ))}
      </details>
    </section>
  );
}
