"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FixturePrediction,
  ScoutIntelligencePayload,
  ScoutPlayerProfile,
  ScoutTeamProfile,
} from "@/lib/fpl";
import {
  PlayerIntelDrawer,
  TeamIntelDrawer,
} from "@/components/intelligence-drawers";

function confidenceRank(value: ScoutPlayerProfile["decisionConfidence"]) {
  return value === "HIGH" ? 2 : value === "MEDIUM" ? 1 : 0;
}

function playerProcess(profile: ScoutPlayerProfile) {
  return profile.evidence?.regressedXgiPer90 ?? profile.player.xgiPer90;
}

function TargetCard({
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
        ? `Best three-Gameweek window opens ${profile.bestWindow.startName}–${profile.bestWindow.endName}; the longer horizon is stronger than the immediate window.`
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
        <b className={"confidence-" + profile.decisionConfidence.toLowerCase()}>
          {profile.decisionConfidence}
        </b>
      </div>
      <p>{reason}</p>
      <div className="research-target-metrics">
        <div><span>{horizon === "SHORT" ? "3GW" : "8GW"}</span><strong>{score.toFixed(1)}</strong></div>
        <div><span>Reg xGI/90</span><strong>{playerProcess(profile).toFixed(2)}</strong></div>
        <div><span>xG/90</span><strong>{profile.evidence?.regressedXgPer90.toFixed(2) ?? profile.player.xgPer90.toFixed(2)}</strong></div>
        <div><span>xA/90</span><strong>{profile.evidence?.regressedXaPer90.toFixed(2) ?? profile.player.xaPer90.toFixed(2)}</strong></div>
        <div><span>EPA</span><strong>{profile.epa.epa >= 0 ? "+" : ""}{profile.epa.epa.toFixed(2)}</strong></div>
        <div><span>xMins</span><strong>{profile.epa.expectedMinutes.toFixed(0)}</strong></div>
        <div><span>Ownership</span><strong>{profile.player.selectedBy.toFixed(1)}%</strong></div>
        <div><span>Set pieces</span><strong>{profile.player.setPieceRole ?? "—"}</strong></div>
        <div><span>Risk</span><strong>{profile.riskProfile.downsideRisk}/100</strong></div>
        <div><span>Type</span><strong>{profile.riskProfile.assetType}</strong></div>
        <div><span>Floor</span><strong>{profile.riskProfile.floor.toFixed(1)}</strong></div>
        <div><span>Ceiling</span><strong>{profile.riskProfile.ceiling.toFixed(1)}</strong></div>
      </div>
      <small className="research-risk">
        <b>Risk:</b> {profile.risks[0] ?? "Late role, minutes or team-news changes can move the call."}
      </small>
      <small className="research-source-note">
        Underlying: regressed xG/xA, expected minutes, team process, fixtures, price/value
        and official ownership. Player NPxG and true EO are not inferred when unavailable.
      </small>
      <button type="button" onClick={() => onOpen(profile)}>
        Full reasoning & underlying data →
      </button>
    </article>
  );
}

function FixtureCard({
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
        <button type="button" disabled={!homeTeam} onClick={() => homeTeam && onOpenTeam(homeTeam)}>
          <strong>{prediction.homeTeam}</strong>
          <small>{prediction.homeExpectedGoals.toFixed(2)} xG</small>
        </button>
        <div>
          <span>MODEL SCORE</span>
          <b>{prediction.mostLikelyScore}</b>
          <small>{prediction.confidence} confidence</small>
        </div>
        <button type="button" disabled={!awayTeam} onClick={() => awayTeam && onOpenTeam(awayTeam)}>
          <strong>{prediction.awayTeam}</strong>
          <small>{prediction.awayExpectedGoals.toFixed(2)} xG</small>
        </button>
      </div>

      <div className="fixture-probabilities" aria-label="Model outcome probabilities">
        <div><span>Home</span><strong>{pct(prediction.homeWinProbability)}%</strong></div>
        <div><span>Draw</span><strong>{pct(prediction.drawProbability)}%</strong></div>
        <div><span>Away</span><strong>{pct(prediction.awayWinProbability)}%</strong></div>
      </div>
      <div className="fixture-clean-sheets" aria-label="Model clean sheet probabilities">
        <span>{prediction.homeShort} xCS <b>{pct(prediction.homeCleanSheetProbability)}%</b></span>
        <span>{prediction.awayShort} xCS <b>{pct(prediction.awayCleanSheetProbability)}%</b></span>
      </div>

      <p>{prediction.reason}</p>

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
      <small className="fixture-forecast-risk">
        <b>Failure mode:</b>{" "}
        {prediction.confidence === "LOW"
          ? "one or both teams have incomplete reconciled process evidence, so the forecast is deliberately low-confidence."
          : "future team news, injuries, rotation and genuine process changes can move the scoring rates; Footy re-runs the forecast with fresh data."}
      </small>
    </article>
  );
}

export function ResearchHub({
  initialPlayerId,
  initialClub,
}: {
  initialPlayerId?: number;
  initialClub?: string;
}) {
  const [data, setData] = useState<ScoutIntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<ScoutPlayerProfile | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<ScoutTeamProfile | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [club, setClub] = useState("ALL");
  const [sort, setSort] = useState("SIX");
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (initialPlayerId) {
      const profile = data.players.find(
        (item) => item.player.id === initialPlayerId,
      );
      if (profile) {
        setSelectedTeam(null);
        setSelectedPlayer(profile);
        return;
      }
    }
    if (initialClub) {
      const team = data.teams.find(
        (item) =>
          item.team.toLowerCase() === initialClub.toLowerCase() ||
          item.shortName.toLowerCase() === initialClub.toLowerCase(),
      );
      if (team) {
        setSelectedPlayer(null);
        setSelectedTeam(team);
      }
    }
  }, [data, initialClub, initialPlayerId]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/scout?forecast=all", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Research data unavailable.");
        setData(body);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Research data unavailable.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const shortTerm = useMemo(() => {
    if (!data) return [];
    return [...data.picks]
      .filter(
        (profile) =>
          profile.player.availability >= 75 &&
          profile.player.startReliability >= 0.76 &&
          profile.horizon.length > 0,
      )
      .sort(
        (a, b) =>
          confidenceRank(b.decisionConfidence) - confidenceRank(a.decisionConfidence) ||
          b.score3 - a.score3 ||
          b.epa.epa - a.epa.epa,
      );
  }, [data]);

  const longTerm = useMemo(() => {
    if (!data) return [];
    return [...data.players]
      .filter(
        (profile) =>
          profile.player.availability >= 75 &&
          profile.player.startReliability >= 0.7 &&
          profile.horizon.length >= 3 &&
          profile.status === "FUTURE_TARGET" &&
          profile.decisionConfidence !== "LOW",
      )
      .sort(
        (a, b) =>
          confidenceRank(b.decisionConfidence) - confidenceRank(a.decisionConfidence) ||
          b.score8 - a.score8 ||
          b.bestWindow.score - a.bestWindow.score ||
          b.epa.epa - a.epa.epa,
      );
  }, [data]);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const list = data.players.filter((profile) => {
      if (position !== "ALL" && profile.player.position !== position) return false;
      if (club !== "ALL" && profile.player.teamName !== club) return false;
      if (
        q &&
        !profile.player.name.toLowerCase().includes(q) &&
        !profile.player.teamName.toLowerCase().includes(q)
      ) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "THREE") return b.score3 - a.score3;
      if (sort === "EIGHT") return b.score8 - a.score8;
      if (sort === "EPA") return b.epa.epa - a.epa.epa;
      if (sort === "VALUE") return b.epa.epaPerMillion - a.epa.epaPerMillion;
      return b.score6 - a.score6;
    });
  }, [club, data, position, query, sort]);

  const fixtureGroups = useMemo(() => {
    if (!data) return [];
    const groups = new Map<number, FixturePrediction[]>();
    for (const prediction of data.fixturePredictions ?? []) {
      const list = groups.get(prediction.eventId) ?? [];
      list.push(prediction);
      groups.set(prediction.eventId, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  if (error) {
    return <div className="research-state error">{error}</div>;
  }

  if (!data) {
    return <div className="research-state">Building the full research layer…</div>;
  }

  const teamById = new Map(data.teams.map((team) => [team.teamId, team]));
  const shownPlayers = showAllPlayers ? filteredPlayers : filteredPlayers.slice(0, 60);

  return (
    <div className="research-hub">
      <header className="research-hero">
        <span>FOOTY RESEARCH</span>
        <h1>Every player. Every club. Every upcoming fixture.</h1>
        <p>
          HQ tells you what matters. Research shows the complete evidence: short-term
          targets, long-term targets, the full player universe, club process and
          Gameweek-by-Gameweek fixture forecasts.
        </p>
        <nav className="research-jump">
          <a href="#short-term">Short term</a>
          <a href="#long-term">Long term</a>
          <a href="#players">All players</a>
          <a href="#clubs">All clubs</a>
          <a href="#fixtures">Fixture forecasts</a>
        </nav>
      </header>

      <section id="short-term" className="research-section">
        <div className="research-section-head">
          <div>
            <span>SHORT TERM · NEXT 3 GAMEWEEKS</span>
            <h2>Players the current data puts near the front of the queue.</h2>
          </div>
          <small>
            {shortTerm.length} shortlisted players · role + minutes + regressed process +
            immediate fixtures + EPA. This section shows the complete Scout shortlist.
          </small>
        </div>
        <div className="research-target-grid">
          {shortTerm.map((profile) => (
            <TargetCard
              key={profile.player.id}
              profile={profile}
              horizon="SHORT"
              onOpen={setSelectedPlayer}
            />
          ))}
        </div>
      </section>

      <section id="long-term" className="research-section">
        <div className="research-section-head">
          <div>
            <span>LONG TERM · 8GW HORIZON</span>
            <h2>Players whose value survives beyond the next deadline.</h2>
          </div>
          <small>
            {longTerm.length} future-window signals · eight-Gameweek score, best three-Gameweek
            window, role-adjusted process, availability and replacement-level EPA.
          </small>
        </div>
        <div className="research-target-grid">
          {longTerm.map((profile) => (
            <TargetCard
              key={profile.player.id}
              profile={profile}
              horizon="LONG"
              onOpen={setSelectedPlayer}
            />
          ))}
        </div>
      </section>

      <section id="players" className="research-section">
        <div className="research-section-head">
          <div>
            <span>FULL PLAYER DIRECTORY</span>
            <h2>Search every player Footy has modelled.</h2>
          </div>
          <small>{filteredPlayers.length} matching players · every row opens the full dossier</small>
        </div>

        <div className="research-filters">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player or club…"
            aria-label="Search player or club"
          />
          <select value={position} onChange={(event) => setPosition(event.target.value)}>
            <option value="ALL">All positions</option>
            <option value="GKP">Goalkeepers</option>
            <option value="DEF">Defenders</option>
            <option value="MID">Midfielders</option>
            <option value="FWD">Forwards</option>
          </select>
          <select value={club} onChange={(event) => setClub(event.target.value)}>
            <option value="ALL">All clubs</option>
            {data.teams.map((team) => (
              <option key={team.teamId} value={team.team}>{team.team}</option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="SIX">Sort: 6GW</option>
            <option value="THREE">Sort: 3GW</option>
            <option value="EIGHT">Sort: 8GW</option>
            <option value="EPA">Sort: EPA</option>
            <option value="VALUE">Sort: EPA / £m</option>
          </select>
        </div>

        <div className="research-player-list">
          {shownPlayers.map((profile) => (
            <button
              type="button"
              key={profile.player.id}
              className="research-player-row"
              onClick={() => setSelectedPlayer(profile)}
            >
              <div className="research-player-main">
                <span>{profile.status.replaceAll("_", " ")}</span>
                <strong>{profile.player.name}</strong>
                <small>
                  {profile.player.team} · {profile.player.position} · £
                  {profile.player.price.toFixed(1)}m · {profile.player.availability}% available
                </small>
                <p>{profile.reasons[0] ?? "Modelled from current role, process and fixtures."}</p>
                <em>{profile.risks[0] ?? "No specific failure mode currently dominates."}</em>
              </div>
              <div><span>3GW</span><b>{profile.score3.toFixed(1)}</b></div>
              <div><span>6GW</span><b>{profile.score6.toFixed(1)}</b></div>
              <div><span>8GW</span><b>{profile.score8.toFixed(1)}</b></div>
              <div><span>Reg xGI/90</span><b>{playerProcess(profile).toFixed(2)}</b></div>
              <div><span>EPA</span><b>{profile.epa.epa >= 0 ? "+" : ""}{profile.epa.epa.toFixed(2)}</b></div>
              <div><span>Confidence</span><b>{profile.decisionConfidence}</b></div>
              <div><span>Risk</span><b>{profile.riskProfile.downsideRisk}</b></div>
              <div><span>Type</span><b>{profile.riskProfile.assetType}</b></div>
            </button>
          ))}
        </div>

        {filteredPlayers.length > 60 ? (
          <div className="research-more">
            <button type="button" onClick={() => setShowAllPlayers((value) => !value)}>
              {showAllPlayers
                ? "Show first 60"
                : `Show all ${filteredPlayers.length} players`}
            </button>
          </div>
        ) : null}
      </section>

      <section id="clubs" className="research-section">
        <div className="research-section-head">
          <div>
            <span>FULL CLUB DIRECTORY</span>
            <h2>All 20 clubs with fixture and underlying-process context.</h2>
          </div>
          <small>Tap any club for its full process profile, fixtures and every modelled asset.</small>
        </div>

        <div className="research-club-grid">
          {data.teams.map((team) => {
            const process = team.process;
            return (
              <button
                type="button"
                key={team.teamId}
                className="research-club-card"
                onClick={() => setSelectedTeam(team)}
              >
                <div>
                  <span>{team.outlook}</span>
                  <h3>{team.team}</h3>
                  <small>6GW FDR {team.averageDifficulty.toFixed(1)}</small>
                </div>
                <p>
                  {process
                    ? process.attackIndex >= 1.06
                      ? "Attack process is above league baseline; player value depends on role and fixture timing."
                      : process.defenceIndex >= 1.06
                        ? "Defensive process is above league baseline; clean-sheet assets deserve closer inspection."
                        : "Process is closer to league baseline, so role, price and fixtures carry more weight."
                    : "Verified team-process evidence is incomplete; fixture information is shown without inventing tactical claims."}
                </p>
                <div className="research-club-metrics">
                  <span>ATT <b>{process?.attackIndex.toFixed(2) ?? "—"}</b></span>
                  <span>DEF <b>{process?.defenceIndex.toFixed(2) ?? "—"}</b></span>
                  <span>xG <b>{process?.metrics.xg.toFixed(2) ?? "—"}</b></span>
                  <span>xGA <b>{process?.metrics.xga.toFixed(2) ?? "—"}</b></span>
                  <span>SOT <b>{process?.metrics.shotsOnTarget.toFixed(1) ?? "—"}</b></span>
                  <span>xA <b>{process?.metrics.xa.toFixed(2) ?? "—"}</b></span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section id="fixtures" className="research-section">
        <div className="research-section-head">
          <div>
            <span>GAMEWEEK FIXTURE FORECASTS</span>
            <h2>Data-based probabilities for every upcoming league fixture.</h2>
          </div>
          <small>
            {fixtureGroups.length} remaining scheduled Gameweeks · expected goals + Poisson
            outcome distribution, adjusted by regressed team attack/defence process and recent
            trend. Player scouting stays on an 8GW horizon; fixture forecasting continues across
            the remaining schedule. These are model estimates, not certainties.
          </small>
        </div>

        <div className="fixture-gameweeks">
          {fixtureGroups.map(([eventId, predictions]) => (
            <section key={eventId} className="fixture-gameweek">
              <header>
                <span>{predictions[0]?.eventName ?? "Gameweek " + eventId}</span>
                <small>{predictions.length} fixtures · tap a club for full process detail</small>
              </header>
              <div className="fixture-forecast-grid">
                {predictions.map((prediction) => (
                  <FixtureCard
                    key={
                      prediction.eventId +
                      "-" +
                      prediction.homeTeamId +
                      "-" +
                      prediction.awayTeamId
                    }
                    prediction={prediction}
                    teamById={teamById}
                    onOpenTeam={setSelectedTeam}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <PlayerIntelDrawer
        profile={selectedPlayer}
        teams={data.teams}
        onClose={() => setSelectedPlayer(null)}
        onOpenTeam={(team) => {
          setSelectedPlayer(null);
          setSelectedTeam(team);
        }}
      />
      <TeamIntelDrawer
        team={selectedTeam}
        players={data.players}
        onClose={() => setSelectedTeam(null)}
        onOpenPlayer={(profile) => {
          setSelectedTeam(null);
          setSelectedPlayer(profile);
        }}
      />
    </div>
  );
}
