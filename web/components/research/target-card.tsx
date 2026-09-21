"use client";

import type { ScoutPlayerProfile } from "@/lib/fpl";

function playerProcess(profile: ScoutPlayerProfile) {
  return profile.evidence?.regressedXgiPer90 ?? profile.player.xgiPer90;
}

export function ResearchTargetCard({
  profile,
  horizon,
  onOpen,
}: {
  profile: ScoutPlayerProfile;
  horizon: "SHORT" | "LONG";
  onOpen: (profile: ScoutPlayerProfile) => void;
}) {
  const score = horizon === "SHORT" ? profile.score3 : profile.score8;
  const reason =
    horizon === "SHORT"
      ? profile.reasons[0] ??
        "Current role, process and fixtures keep the player high in the near-term model."
      : profile.bestWindow.index > 0
        ? "Best three-Gameweek window opens " +
          profile.bestWindow.startName +
          "–" +
          profile.bestWindow.endName +
          "; the longer horizon is stronger than the immediate window."
        : profile.reasons[0] ??
          "The player holds a strong model score across the longer horizon.";

  return (
    <article className="research-target-card">
      <div className="research-target-head">
        <div>
          <span>{horizon === "SHORT" ? "NEXT 3GW" : "8GW / BEST WINDOW"}</span>
          <h3>{profile.player.name}</h3>
          <small>
            {profile.player.team} · {profile.player.position} · £
            {profile.player.price.toFixed(1)}m
          </small>
        </div>
        <b
          className={
            "confidence-" + profile.decisionConfidence.toLowerCase()
          }
        >
          {profile.decisionConfidence}
        </b>
      </div>

      <p>{reason}</p>

      <div className="research-target-metrics research-target-metrics-primary">
        <div>
          <span>{horizon === "SHORT" ? "3GW" : "8GW"}</span>
          <strong>{score.toFixed(1)}</strong>
        </div>
        <div>
          <span>Reg xGI/90</span>
          <strong>{playerProcess(profile).toFixed(2)}</strong>
        </div>
        <div>
          <span>EPA</span>
          <strong>
            {profile.epa.epa >= 0 ? "+" : ""}
            {profile.epa.epa.toFixed(2)}
          </strong>
        </div>
        <div>
          <span>xMins</span>
          <strong>{profile.epa.expectedMinutes.toFixed(0)}</strong>
        </div>
      </div>

      <small className="research-risk">
        <b>Failure mode:</b>{" "}
        {profile.risks[0] ??
          "Late role, minutes or team-news changes can move the call."}
      </small>

      <details className="research-target-details">
        <summary>
          <span>UNDERLYING DETAIL</span>
          <strong>Role, ownership and risk profile</strong>
          <small>Open when you need the full evidence card.</small>
        </summary>
        <div className="research-target-metrics research-target-metrics-secondary">
          <div>
            <span>xG/90</span>
            <strong>
              {(
                profile.evidence?.regressedXgPer90 ?? profile.player.xgPer90
              ).toFixed(2)}
            </strong>
          </div>
          <div>
            <span>xA/90</span>
            <strong>
              {(
                profile.evidence?.regressedXaPer90 ?? profile.player.xaPer90
              ).toFixed(2)}
            </strong>
          </div>
          <div>
            <span>Ownership</span>
            <strong>{profile.player.selectedBy.toFixed(1)}%</strong>
          </div>
          <div>
            <span>Set pieces</span>
            <strong>{profile.player.setPieceRole ?? "—"}</strong>
          </div>
          <div>
            <span>Risk</span>
            <strong>{profile.riskProfile.downsideRisk}/100</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{profile.riskProfile.assetType}</strong>
          </div>
          <div>
            <span>Floor</span>
            <strong>{profile.riskProfile.floor.toFixed(1)}</strong>
          </div>
          <div>
            <span>Ceiling</span>
            <strong>{profile.riskProfile.ceiling.toFixed(1)}</strong>
          </div>
        </div>
        <small className="research-source-note">
          Underlying: regressed xG/xA, expected minutes, team process,
          fixtures, price/value and official ownership. Unverified inputs are
          not inferred.
        </small>
      </details>

      <button type="button" onClick={() => onOpen(profile)}>
        Open full dossier →
      </button>
    </article>
  );
}
