"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ManagerResponse } from "@/components/team-room/types";

type CounterPlay = NonNullable<ManagerResponse["counterplay"]>;
type Horizon = NonNullable<CounterPlay["horizon_results"]>["1"];
type Replacement = CounterPlay["what_if"]["options"]["replacement_pool"][number];
type SquadOption = CounterPlay["what_if"]["options"]["squad"][number];
type WhatIfScenario =
  | CounterPlay["what_if"]["next_gameweek"]
  | NonNullable<CounterPlay["what_if"]["horizons"]>["1"];

export function WhatIfPanel({
  counterPlay,
  counterHorizon,
  outId,
  inId,
  captainId,
  loading,
  error,
  replacementOptions,
  captainOptions,
  scenario,
  activeHorizon,
  onOutChange,
  onInChange,
  onCaptainChange,
  onRun,
  onReset,
}: {
  counterPlay: CounterPlay;
  counterHorizon: 1 | 3 | 5;
  outId: number | null;
  inId: number | null;
  captainId: number | null;
  loading: boolean;
  error: string | null;
  replacementOptions: Replacement[];
  captainOptions: SquadOption[];
  scenario: WhatIfScenario | null;
  activeHorizon: Horizon | null;
  onOutChange: (value: number | null) => void;
  onInChange: Dispatch<SetStateAction<number | null>>;
  onCaptainChange: Dispatch<SetStateAction<number | null>>;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <section className="team-room-block team-room-test-panel" id="what-if">
      <div className="counterplay-whatif-shell" aria-busy={loading}>
        <div className="counterplay-whatif-head">
          <div>
            <span>WHAT-IF LAB</span>
            <strong>Test your move without contaminating Footy’s call.</strong>
          </div>
          <small>
            Same {counterPlay.iterations.toLocaleString()}-run model ·{" "}
            {counterHorizon}GW state carry-forward.
          </small>
        </div>

        <div className="counterplay-whatif-controls">
          <label>
            <span>SELL / REMOVE</span>
            <select
              value={outId ?? ""}
              disabled={loading}
              onChange={(event) =>
                onOutChange(Number(event.target.value) || null)
              }
            >
              <option value="">No transfer</option>
              {counterPlay.what_if.options.squad
                .slice()
                .sort(
                  (a, b) =>
                    a.position.localeCompare(b.position) ||
                    a.name.localeCompare(b.name),
                )
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.position} · {player.name} · £
                    {player.price.toFixed(1)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>BUY / ADD</span>
            <select
              value={inId ?? ""}
              disabled={!outId || loading}
              onChange={(event) =>
                onInChange(Number(event.target.value) || null)
              }
            >
              <option value="">
                {outId
                  ? "Choose legal replacement"
                  : "Choose player out first"}
              </option>
              {replacementOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.team} · £{player.price.toFixed(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>CAPTAIN</span>
            <select
              value={captainId ?? ""}
              disabled={loading}
              onChange={(event) =>
                onCaptainChange(Number(event.target.value) || null)
              }
            >
              <option value="">Footy’s captain</option>
              {captainOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.team}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="counterplay-whatif-actions">
          <button
            type="button"
            onClick={onRun}
            disabled={loading || (!captainId && !(outId && inId))}
          >
            {loading ? "SIMULATING…" : "RUN WHAT-IF"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onReset}
            disabled={
              loading ||
              (!outId &&
                !captainId &&
                counterPlay.what_if.status !== "VALID")
            }
          >
            RESET
          </button>
          <small aria-live="polite">
            {error ??
              (counterPlay.what_if.status === "VALID"
                ? "Custom scenario simulated. Footy’s recommendation remains independent."
                : counterPlay.what_if.caveat)}
          </small>
        </div>

        {counterPlay.what_if.status === "VALID" && scenario ? (
          <div className="counterplay-whatif-result">
            <div>
              <span>YOUR PATH</span>
              <strong>{scenario.label}</strong>
              <small>
                {(scenario.objective_probability * 100).toFixed(1)}% objective ·{" "}
                {(scenario.probability_delta >= 0 ? "+" : "") +
                  (scenario.probability_delta * 100).toFixed(1)}
                pp vs HOLD
              </small>
            </div>
            <div>
              <span>FOOTY BEST</span>
              <strong>
                {activeHorizon?.recommended_scenario?.label ??
                  counterPlay.recommended_scenario?.label ??
                  "Hold structure"}
              </strong>
              <small>
                {activeHorizon?.recommended_scenario
                  ? (
                      activeHorizon.recommended_scenario.objective_probability *
                      100
                    ).toFixed(1) + "% objective"
                  : counterPlay.recommended_scenario
                    ? (
                        counterPlay.recommended_scenario.objective_probability *
                        100
                      ).toFixed(1) + "% objective"
                    : "No stronger path"}
              </small>
            </div>
            <div>
              <span>MODEL RANGE</span>
              <strong>
                {scenario.floor_5.toFixed(1)}–{scenario.ceiling_95.toFixed(1)}
              </strong>
              <small>empirical 5th–95th projected score</small>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
