"use client";

import type { FplPitchPlayer } from "@/lib/fpl-team";
import type { ScoutPlayerProfile } from "@/lib/fpl";
import type { ManagerResponse, Standing } from "@/components/team-room/types";

type PortfolioPlan = NonNullable<ManagerResponse["portfolio_plan"]>;
type Strategy = NonNullable<ManagerResponse["league_strategy"]>;
type TransferMove = NonNullable<Strategy["transfer_moves"]>[number];
type CaptainMove = NonNullable<Strategy["captain_moves"]>[number];

export function DecisionPanel({
  loading,
  portfolioPlan,
  transfer,
  captain,
  actionQuip,
  transferWhy,
  transferEvidence,
  transferConfidence,
  transferFailure,
  weakPlayers,
  leagueRank,
  leagueName,
  standingsWindow,
  teamId,
  targetName,
  gapAbove,
  chaserName,
  gapBelow,
  resourceStatus,
  resourceRecommendation,
  captainQuip,
  onManagerOpen,
}: {
  loading: boolean;
  portfolioPlan: PortfolioPlan | null;
  transfer: TransferMove | null;
  captain: CaptainMove | null;
  actionQuip: string;
  transferWhy: string;
  transferEvidence: string;
  transferConfidence: string | null;
  transferFailure: string;
  weakPlayers: Array<{
    pick: FplPitchPlayer;
    profile: ScoutPlayerProfile;
    future: number;
  }>;
  leagueRank: number | null;
  leagueName: string;
  standingsWindow: Standing[];
  teamId: number;
  targetName: string | null;
  gapAbove: number | null;
  chaserName: string | null;
  gapBelow: number | null;
  resourceStatus: string | null;
  resourceRecommendation: string | null;
  captainQuip: string | null;
  onManagerOpen: (standing: Standing) => void;
}) {
  return (
    <section className="team-room-command-grid" id="decision">
      <article className="team-room-block team-room-command-card">
        <div className="team-room-block-head">
          <div>
            <span>FOOTY SUGGESTS</span>
            <h2>
              {loading
                ? "Building your plan…"
                : portfolioPlan?.headline ??
                  (transfer
                    ? transfer.out.name + " → " + transfer.in.name
                    : "Hold the transfer")}
            </h2>
          </div>
        </div>

        <blockquote className="footy-quip compact">{actionQuip}</blockquote>

        <div className="team-room-suggestion">
          <div>
            <span>PORTFOLIO ACTION</span>
            <strong>
              {loading
                ? "CHECKING"
                : portfolioPlan?.action.replaceAll("_", " ") ??
                  (transfer
                    ? transfer.out.name + " → " + transfer.in.name
                    : "HOLD")}
            </strong>
            <small>
              {loading
                ? "Comparing football edge, FT option value, squad structure and timing."
                : portfolioPlan
                  ? (portfolioPlan.free_transfers == null
                      ? "FT bank uncertain"
                      : portfolioPlan.free_transfers + "/5 FT") +
                    " · portfolio " +
                    portfolioPlan.portfolio.score +
                    "/100 · " +
                    portfolioPlan.portfolio.status +
                    " · game theory " +
                    portfolioPlan.game_theory.band.toLowerCase()
                  : transfer
                    ? "+" +
                      transfer.raw_gain.toFixed(1) +
                      " now · min +" +
                      (transfer.minimum_gain ?? 0).toFixed(1) +
                      " · +" +
                      (transfer.horizon_gain ?? 0).toFixed(1) +
                      " horizon"
                    : "No replacement clears the value and timing threshold."}
            </small>
          </div>

          <div>
            <span>CAPTAIN</span>
            <strong>
              {loading ? "CHECKING" : captain?.player.name ?? "No change"}
            </strong>
            <small>
              {loading
                ? "Comparing captain output, ownership and league pressure."
                : captain?.rationale ?? "Expected output remains the priority."}
            </small>
            {captainQuip ? (
              <em className="team-room-inline-quip">{captainQuip}</em>
            ) : null}
          </div>

          <div>
            <span>RESOURCE</span>
            <strong>
              {loading ? "CHECKING" : resourceStatus ?? "—"}
            </strong>
            <small>
              {loading
                ? "Reading free-transfer, chip and rival flexibility."
                : resourceRecommendation ?? "No resource warning."}
            </small>
          </div>
        </div>

        {loading ? (
          <div className="team-room-model-loading" role="status">
            <span>MODEL CHECK</span>
            <strong>
              Building the decision from live player, process and league
              evidence…
            </strong>
          </div>
        ) : (
          <div className="team-room-decision-proof">
            <div>
              <span>WHY</span>
              <strong>{transferWhy}</strong>
            </div>
            <div>
              <span>EVIDENCE</span>
              <strong
                className={
                  transferConfidence
                    ? "confidence-" + transferConfidence.toLowerCase()
                    : ""
                }
              >
                {transferEvidence}
              </strong>
            </div>
            <div>
              <span>FAILURE MODE</span>
              <strong>{transferFailure}</strong>
            </div>
          </div>
        )}

        {weakPlayers.length ? (
          <details className="team-room-pressure-points">
            <summary>
              <span>SQUAD PRESSURE</span>
              <strong>{weakPlayers.length} players to monitor</strong>
              <small>Open only if you want the weakest forward-looking spots.</small>
            </summary>
            <div className="team-room-watch">
              {weakPlayers.map((item) => (
                <p key={item.pick.id}>
                  <b>{item.pick.name}</b> — future rating {item.future}; best
                  window {item.profile.bestWindow.startName}–
                  {item.profile.bestWindow.endName}.
                </p>
              ))}
            </div>
          </details>
        ) : null}

        <a className="team-room-primary" href="#what-if">
          Test an alternative →
        </a>
      </article>

      <article className="team-room-block team-room-pressure-card">
        <div className="team-room-block-head">
          <div>
            <span>LEAGUE BATTLE</span>
            <h2>Pressure around you</h2>
          </div>
        </div>

        <div className="team-room-pressure">
          <div>
            <span>ABOVE</span>
            <strong>{targetName ?? "Leader"}</strong>
            <small>{gapAbove ?? "—"} pts away</small>
          </div>
          <div>
            <span>YOU</span>
            <strong>#{leagueRank ?? "—"}</strong>
            <small>{leagueName}</small>
          </div>
          <div>
            <span>BELOW</span>
            <strong>{chaserName ?? "—"}</strong>
            <small>{gapBelow ?? "—"} pts behind</small>
          </div>
        </div>

        <div className="team-room-standings">
          {standingsWindow.map((row) => (
            <button
              type="button"
              key={row.entry_id}
              className={row.entry_id === teamId ? "you" : ""}
              onClick={() => onManagerOpen(row)}
              aria-label={"Open " + row.entry_name + " opposition profile"}
            >
              <span>#{row.rank}</span>
              <strong>{row.entry_name}</strong>
              <small>
                {row.total} pts · GW {row.event_total}
              </small>
            </button>
          ))}
        </div>

        <a className="team-room-deep-link" href="#counterplay">
          Use league pressure in the plan →
        </a>
      </article>
    </section>
  );
}
