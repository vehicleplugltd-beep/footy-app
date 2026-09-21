"use client";

import Link from "next/link";
import type { FplPitchPlayer } from "@/lib/fpl-team";
import type { ScoutPlayerProfile } from "@/lib/fpl";
import type { ManagerResponse, Standing } from "@/components/team-room/types";

export type TeamRoomSquadRating = {
  pick: FplPitchPlayer;
  profile: ScoutPlayerProfile;
  now: number;
  future: number;
};

function ratingBand(value: number) {
  if (value >= 80) return "Elite";
  if (value >= 65) return "Strong";
  if (value >= 50) return "Okay";
  if (value >= 35) return "Concern";
  return "Weak";
}

export function TeamRoomSummary({
  loading,
  action,
  headline,
  leagueRank,
  leagueName,
  squadNow,
  squadFuture,
}: {
  loading: boolean;
  action: string;
  headline: string;
  leagueRank: number | null;
  leagueName: string;
  squadNow: number | null;
  squadFuture: number | null;
}) {
  return (
    <section className="team-room-scoreboard" aria-label="Team Room summary">
      <div className="team-room-scoreboard-primary">
        <span>NEXT ACTION</span>
        <strong>{loading ? "CHECKING" : action}</strong>
        <small>{loading ? "Building recommendation" : headline}</small>
      </div>
      <div>
        <span>LEAGUE RANK</span>
        <strong>#{leagueRank ?? "—"}</strong>
        <small>{leagueName}</small>
      </div>
      <div>
        <span>SQUAD NOW</span>
        <strong>{squadNow ?? "—"}</strong>
        <small>
          {squadNow != null
            ? ratingBand(squadNow) + " · current squad quality"
            : "Loading"}
        </small>
      </div>
      <div>
        <span>6GW OUTLOOK</span>
        <strong>{squadFuture ?? "—"}</strong>
        <small>
          {squadFuture != null
            ? ratingBand(squadFuture) + " · process + fixtures"
            : "Loading"}
        </small>
      </div>
    </section>
  );
}

type PhaseTone = "decision" | "plan" | "test" | "review";

export function TeamRoomPhaseHeading({
  step,
  label,
  title,
  caption,
  id,
  tone,
}: {
  step: number;
  label: string;
  title: string;
  caption: string;
  id?: string;
  tone: PhaseTone;
}) {
  const className = [
    "team-room-phase-heading",
    tone === "decision" ? "team-room-phase-heading-decision" : "",
    tone === "test" ? "team-room-phase-heading-test" : "",
    tone === "review" ? "team-room-phase-heading-review" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} id={id}>
      <div>
        <span>
          {step} / {label}
        </span>
        <strong>{title}</strong>
      </div>
      <small>{caption}</small>
    </div>
  );
}

export function TeamRoomReferenceDrawer({
  squadRatings,
  researchHref,
  resourceRows,
  teamId,
  onPlayerOpen,
  onManagerOpen,
}: {
  squadRatings: TeamRoomSquadRating[];
  researchHref: string;
  resourceRows: NonNullable<ManagerResponse["resource_map"]>;
  teamId: number;
  onPlayerOpen: (profile: ScoutPlayerProfile) => void;
  onManagerOpen: (standing: Standing) => void;
}) {
  return (
    <details className="team-room-reference-drawer" id="reference">
      <summary>
        <div>
          <span>REFERENCE</span>
          <strong>Squad ratings + opponent resources</strong>
        </div>
        <small>Supporting evidence kept outside the four-step decision flow.</small>
      </summary>
      <div className="team-room-reference-content">
        <section className="team-room-block" id="squad">
          <div className="team-room-block-head">
            <div>
              <span>SQUAD</span>
              <h2>Current team + player ratings</h2>
            </div>
            <small>
              Tap any player for EPA, fixtures, risks and source detail ·{" "}
              <Link href={researchHref + "#players"}>research every player →</Link>
            </small>
          </div>

          <div className="team-room-player-table">
            {squadRatings.map(({ pick, profile, now, future }) => (
              <button
                type="button"
                key={pick.id}
                className="team-room-player-row"
                onClick={() => onPlayerOpen(profile)}
                aria-label={"Open " + pick.name + " player profile"}
              >
                <div className="team-room-player-name">
                  <strong>{pick.name}</strong>
                  <small>
                    {pick.team} · {pick.position} · £{pick.price.toFixed(1)}m
                  </small>
                  <em>
                    {profile.reasons[0] ??
                      "Role, process and fixtures drive the rating."}
                  </em>
                </div>
                <div>
                  <span>Now</span>
                  <b>{now}</b>
                  <small>{ratingBand(now)}</small>
                </div>
                <div>
                  <span>6GW</span>
                  <b>{future}</b>
                  <small>
                    {profile.bestWindow.startName}–{profile.bestWindow.endName}
                  </small>
                </div>
                <div>
                  <span>EPA</span>
                  <b>
                    {profile.epa.epa >= 0 ? "+" : ""}
                    {profile.epa.epa.toFixed(2)}
                  </b>
                  <small>
                    {profile.epa.undervalued
                      ? "Undervalued"
                      : profile.player.selectedBy.toFixed(1) + "% owned"}
                  </small>
                </div>
                <div>
                  <span>Available</span>
                  <b>{profile.player.availability}%</b>
                  <small>{profile.player.news || "No current blocker"}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="team-room-block">
          <div className="team-room-block-head">
            <div>
              <span>OPPONENT RESOURCES</span>
              <h2>Chips, transfers and behaviour</h2>
            </div>
            <small>
              Public FPL history only · tap any manager for the full dossier
            </small>
          </div>

          <div className="team-room-rivals">
            {resourceRows.slice(0, 6).map(({ standing, history }) => (
              <button
                type="button"
                key={standing.entry_id}
                className={standing.entry_id === teamId ? "you" : ""}
                onClick={() => onManagerOpen(standing)}
                aria-label={"Open " + standing.entry_name + " opposition profile"}
              >
                <div>
                  <strong>{standing.entry_name}</strong>
                  <small>
                    #{standing.rank} · {history.activity}
                  </small>
                </div>
                <div>
                  <span>FT est.</span>
                  <b>{history.estimatedFreeTransfers}</b>
                </div>
                <div>
                  <span>Hits</span>
                  <b>-{history.totalHitCost}</b>
                </div>
                <div>
                  <span>Chips left</span>
                  <b>{history.currentHalfRemaining.length}</b>
                </div>
              </button>
            ))}
          </div>
          <a className="team-room-deep-link" href="#counterplay">
            See how rivals change the plan →
          </a>
        </section>
      </div>
    </details>
  );
}
