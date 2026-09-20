"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ScoutIntelligencePayload,
  ScoutPlayerProfile,
  ScoutTeamProfile,
} from "@/lib/fpl";

type Tab = "PICKS" | "PLAYERS" | "TEAMS";
type PickFilter = "ALL" | "BUY_NOW" | "WATCH" | "FUTURE_TARGET";

function statusLabel(status: ScoutPlayerProfile["status"]) {
  return status === "BUY_NOW"
    ? "BUY NOW"
    : status === "FUTURE_TARGET"
      ? "FUTURE TARGET"
      : "WATCH";
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function PlayerProfile({
  profile,
  onTeam,
}: {
  profile: ScoutPlayerProfile;
  onTeam: (teamName: string) => void;
}) {
  const player = profile.player;

  return (
    <article className="scout-profile">
      <header className="scout-profile-head">
        <div>
          <span className={`scout-status scout-${profile.status.toLowerCase().replaceAll("_", "-")}`}>
            {statusLabel(profile.status)}
          </span>
          <h3>{player.name}</h3>
          <p>
            {player.teamName} · {player.position} · £{player.price.toFixed(1)}m
          </p>
        </div>
        <button type="button" onClick={() => onTeam(player.teamName)}>
          View {player.team} →
        </button>
      </header>

      <div className="scout-profile-metrics">
        <div><span>xGI/90</span><strong>{player.xgiPer90.toFixed(2)}</strong></div>
        <div><span>xG/90</span><strong>{player.xgPer90.toFixed(2)}</strong></div>
        <div><span>xA/90</span><strong>{player.xaPer90.toFixed(2)}</strong></div>
        <div><span>Form</span><strong>{player.form.toFixed(1)}</strong></div>
        <div><span>Starts</span><strong>{player.starts}</strong></div>
        <div><span>Minutes</span><strong>{player.minutes}</strong></div>
        <div><span>Owned</span><strong>{player.selectedBy.toFixed(1)}%</strong></div>
        <div><span>Available</span><strong>{player.availability}%</strong></div>
      </div>

      <div className="scout-window">
        <div>
          <span>3GW</span>
          <strong>{profile.score3.toFixed(1)}</strong>
        </div>
        <div>
          <span>6GW</span>
          <strong>{profile.score6.toFixed(1)}</strong>
        </div>
        <div>
          <span>8GW</span>
          <strong>{profile.score8.toFixed(1)}</strong>
        </div>
        <div className="scout-window-best">
          <span>BEST 3GW WINDOW</span>
          <strong>{profile.bestWindow.startName} → {profile.bestWindow.endName}</strong>
        </div>
      </div>

      <div className="scout-horizon" aria-label="Eight Gameweek outlook">
        {profile.horizon.map((item) => (
          <div key={item.eventId}>
            <span>{item.name}</span>
            <strong>{item.opponent ?? "—"} {item.homeAway !== "—" ? `(${item.homeAway})` : ""}</strong>
            <small>FDR {item.difficulty} · score {item.score.toFixed(1)}</small>
          </div>
        ))}
      </div>

      <div className="scout-reason-grid">
        <section>
          <span>WHY FOOTY LIKES HIM</span>
          {profile.reasons.length ? (
            profile.reasons.map((reason) => <p key={reason}>{reason}</p>)
          ) : (
            <p>No single signal is dominating; the ranking comes from the combined model.</p>
          )}
        </section>
        <section>
          <span>WHAT CAN GO WRONG</span>
          {profile.risks.map((risk) => <p key={risk}>{risk}</p>)}
          {player.news ? <p><b>Official news:</b> {player.news}</p> : null}
        </section>
      </div>
    </article>
  );
}

function TeamProfile({
  team,
  onPlayer,
}: {
  team: ScoutTeamProfile;
  onPlayer: (playerId: number) => void;
}) {
  const process = team.process;

  return (
    <article className="scout-profile">
      <header className="scout-profile-head">
        <div>
          <span className="scout-team-kicker">CLUB PROFILE</span>
          <h3>{team.team}</h3>
          <p>{team.outlook} · 6GW average FDR {team.averageDifficulty.toFixed(1)}</p>
        </div>
        <strong className="scout-confidence">
          {process ? `${pct(process.sourceConfidence)} data confidence` : "Process data unavailable"}
        </strong>
      </header>

      {process ? (
        <>
          <div className="scout-profile-metrics team-metrics">
            <div><span>xG</span><strong>{process.metrics.xg.toFixed(2)}</strong></div>
            <div><span>npxG</span><strong>{process.metrics.npxg.toFixed(2)}</strong></div>
            <div><span>xGA</span><strong>{process.metrics.xga.toFixed(2)}</strong></div>
            <div><span>npxGA</span><strong>{process.metrics.npxga.toFixed(2)}</strong></div>
            <div><span>SOT</span><strong>{process.metrics.shotsOnTarget.toFixed(1)}</strong></div>
            <div><span>SOT conc.</span><strong>{process.metrics.sotConceded.toFixed(1)}</strong></div>
            <div><span>Set xG</span><strong>{process.metrics.setPieceXg.toFixed(2)}</strong></div>
            <div><span>PPDA</span><strong>{process.metrics.ppda.toFixed(1)}</strong></div>
          </div>
          <div className="scout-team-trend">
            <span>Attack index <b>{process.attackIndex.toFixed(2)}</b></span>
            <span>Defence index <b>{process.defenceIndex.toFixed(2)}</b></span>
            <span>Attack trend <b>{process.attackTrend >= 0 ? "+" : ""}{pct(process.attackTrend)}</b></span>
            <span>Defence trend <b>{process.defenceTrend >= 0 ? "+" : ""}{pct(process.defenceTrend)}</b></span>
          </div>
        </>
      ) : null}

      <div className="scout-horizon">
        {team.fixtures.map((fixture) => (
          <div key={fixture.eventId}>
            <span>{fixture.name}</span>
            <strong>{fixture.opponentShort} ({fixture.homeAway})</strong>
            <small>FDR {fixture.difficulty}</small>
          </div>
        ))}
      </div>

      <section className="scout-team-players">
        <span>PLAYERS BENEFITING FROM THE RUN</span>
        <div>
          {team.topPlayers.map((player) => (
            <button type="button" key={player.id} onClick={() => onPlayer(player.id)}>
              <b>{player.name}</b>
              <small>{player.position} · £{player.price.toFixed(1)}m · 6GW {player.score6.toFixed(1)}</small>
            </button>
          ))}
        </div>
      </section>
    </article>
  );
}

export function ScoutRoom() {
  const ref = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [data, setData] = useState<ScoutIntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("PICKS");
  const [filter, setFilter] = useState<PickFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || requested) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: "450px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [requested]);

  useEffect(() => {
    if (!requested || data || error) return;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/scout", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Scout intelligence unavailable.");
        }
        setData(body);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Scout intelligence unavailable.");
      }
    }

    void load();
    return () => controller.abort();
  }, [data, error, requested]);

  const selectedPlayer = useMemo(
    () => data?.players.find((item) => item.player.id === selectedPlayerId) ?? null,
    [data, selectedPlayerId],
  );
  const selectedTeamProfile = useMemo(
    () => data?.teams.find((item) => item.team === selectedTeam) ?? null,
    [data, selectedTeam],
  );

  const filteredPicks = useMemo(() => {
    if (!data) return [];
    return data.picks.filter((profile) => filter === "ALL" || profile.status === filter);
  }, [data, filter]);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.players
      .filter((profile) =>
        !needle ||
        profile.player.name.toLowerCase().includes(needle) ||
        profile.player.teamName.toLowerCase().includes(needle) ||
        profile.player.position.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [data, search]);

  function openPlayer(playerId: number) {
    setSelectedPlayerId(playerId);
    setTab("PLAYERS");
  }

  function openTeam(teamName: string) {
    setSelectedTeam(teamName);
    setTab("TEAMS");
  }

  return (
    <div ref={ref} className="scout-room">
      {!requested ? (
        <button type="button" className="build-test-load" onClick={() => setRequested(true)}>
          Open Scout Room
        </button>
      ) : !data && !error ? (
        <div className="build-test-loading">
          <strong>Scanning players, clubs and the next eight Gameweeks…</strong>
          <span />
        </div>
      ) : error ? (
        <div className="lab-message">{error}</div>
      ) : data ? (
        <>
          <div className="scout-toolbar">
            <div>
              <span>LIVE INTELLIGENCE</span>
              <strong>{data.horizonGameweeks}-Gameweek scouting horizon</strong>
              <small>
                {data.freshness === "LIVE_FPL" ? "Live FPL" : "Latest FPL snapshot"}
                {" · "}
                {new Date(data.dataRetrievedAt).toLocaleString([], {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <nav aria-label="Scout views">
              {(["PICKS", "PLAYERS", "TEAMS"] as Tab[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={tab === item ? "active" : ""}
                  onClick={() => setTab(item)}
                >
                  {item === "PICKS" ? "Potential picks" : item === "PLAYERS" ? "Players" : "Teams"}
                </button>
              ))}
            </nav>
          </div>

          {tab === "PICKS" ? (
            <div className="scout-view">
              <div className="scout-filter-row">
                <div>
                  <span>UPCOMING PICKS</span>
                  <h3>Who Footy is scouting — and when.</h3>
                </div>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as PickFilter)}
                  aria-label="Filter potential picks"
                >
                  <option value="ALL">All timings</option>
                  <option value="BUY_NOW">Buy now</option>
                  <option value="WATCH">Watch</option>
                  <option value="FUTURE_TARGET">Future target</option>
                </select>
              </div>

              <div className="scout-pick-list">
                {filteredPicks.map((profile) => (
                  <article key={profile.player.id}>
                    <div className="scout-pick-main">
                      <span className={`scout-status scout-${profile.status.toLowerCase().replaceAll("_", "-")}`}>
                        {statusLabel(profile.status)}
                      </span>
                      <button type="button" onClick={() => openPlayer(profile.player.id)}>
                        {profile.player.name}
                      </button>
                      <small>
                        {profile.player.team} · {profile.player.position} · £{profile.player.price.toFixed(1)}m
                      </small>
                    </div>
                    <div>
                      <span>BEST WINDOW</span>
                      <strong>{profile.bestWindow.startName} → {profile.bestWindow.endName}</strong>
                      <small>3GW {profile.bestWindow.score.toFixed(1)} · 6GW {profile.score6.toFixed(1)}</small>
                    </div>
                    <div className="scout-pick-reason">
                      <span>WHY</span>
                      <strong>{profile.reasons[0] ?? "Strong combined model profile."}</strong>
                      <small>{profile.risks[0] ?? "No major current blocker."}</small>
                    </div>
                    <button type="button" className="scout-open" onClick={() => openPlayer(profile.player.id)}>
                      Profile →
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "PLAYERS" ? (
            <div className="scout-view scout-split">
              <div className="scout-directory">
                <div className="scout-search">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search player, team or position"
                    aria-label="Search players"
                  />
                </div>
                <div className="scout-directory-list">
                  {filteredPlayers.map((profile) => (
                    <button
                      type="button"
                      key={profile.player.id}
                      className={selectedPlayerId === profile.player.id ? "active" : ""}
                      onClick={() => setSelectedPlayerId(profile.player.id)}
                    >
                      <span>
                        <b>{profile.player.name}</b>
                        <small>{profile.player.team} · {profile.player.position}</small>
                      </span>
                      <em>{statusLabel(profile.status)}</em>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {selectedPlayer ? (
                  <PlayerProfile profile={selectedPlayer} onTeam={openTeam} />
                ) : (
                  <div className="scout-empty">
                    <strong>Select a player</strong>
                    <p>Open the full dossier: process, role, risks and eight-Gameweek outlook.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === "TEAMS" ? (
            <div className="scout-view scout-split">
              <div className="scout-directory">
                <div className="scout-directory-list">
                  {data.teams.map((team) => (
                    <button
                      type="button"
                      key={team.teamId}
                      className={selectedTeam === team.team ? "active" : ""}
                      onClick={() => setSelectedTeam(team.team)}
                    >
                      <span>
                        <b>{team.team}</b>
                        <small>{team.outlook} · FDR {team.averageDifficulty.toFixed(1)}</small>
                      </span>
                      <em>{team.process ? team.process.attackIndex.toFixed(2) : "—"}</em>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {selectedTeamProfile ? (
                  <TeamProfile team={selectedTeamProfile} onPlayer={openPlayer} />
                ) : (
                  <div className="scout-empty">
                    <strong>Select a club</strong>
                    <p>See process, trends, fixtures and the players best placed to benefit.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
