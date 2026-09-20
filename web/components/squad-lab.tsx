"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RankedPlayer } from "@/lib/fpl";

type Mode = "FPL" | "DRAFT";
type SortKey = "score" | "form" | "value" | "xgi" | "trend";

type ResourceAdvice = {
  status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
  chip_edge: string[];
  chip_threats: string[];
  free_transfer_edge: number;
  recommendation: string;
};

type ResourceManager = {
  standing: { entry_id: number; entry_name: string; rank: number };
  history: {
    currentHalf: 1 | 2;
    currentHalfRemaining: string[];
    estimatedFreeTransfers: number;
    freeTransferEstimateEvent: number;
    freeTransferConfidence: "HIGH" | "MEDIUM";
    recentTransfers: number;
    recentHitCost: number;
    activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT";
  };
};

type LeagueStrategy = {
  mode: "PROTECT" | "CHASE" | "RECOVER";
  gap_to_leader: number;
  rival_name: string | null;
  caveat: string;
  captain_moves: Array<{
    player: RankedPlayer;
    rival_owns: boolean;
    league_score: number;
    rationale: string;
  }>;
  transfer_moves: Array<{
    out: RankedPlayer;
    in: RankedPlayer;
    raw_gain: number;
    league_score: number;
    rival_owns: boolean;
    process_adjustment: number;
    rationale: string;
  }>;
};

const POSITION_LIMITS: Record<string, number> = {
  GKP: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

function buildXI(players: RankedPlayer[]) {
  if (players.length < 11) return new Set(players.map((player) => player.id));
  const byPosition = (position: string) =>
    players
      .filter((player) => player.position === position)
      .sort((a, b) => b.assistantScore - a.assistantScore);

  const chosen: RankedPlayer[] = [];
  chosen.push(...byPosition("GKP").slice(0, 1));
  chosen.push(...byPosition("DEF").slice(0, 3));
  chosen.push(...byPosition("MID").slice(0, 2));
  chosen.push(...byPosition("FWD").slice(0, 1));

  const ids = new Set(chosen.map((player) => player.id));
  const counts = new Map<string, number>();
  chosen.forEach((player) =>
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1),
  );

  const rest = players
    .filter((player) => !ids.has(player.id) && player.position !== "GKP")
    .sort((a, b) => b.assistantScore - a.assistantScore);

  for (const player of rest) {
    if (chosen.length >= 11) break;
    const max = POSITION_LIMITS[player.position] ?? 5;
    if ((counts.get(player.position) ?? 0) >= max) continue;
    chosen.push(player);
    ids.add(player.id);
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  return ids;
}

function signal(player: RankedPlayer) {
  if (player.availability < 75) return "DOUBT";
  if (player.processBoost >= 0.06) return "PROCESS ↑";
  if (player.transfersNet >= 50000) return "RISING";
  if (player.form >= 6) return "HOT";
  return "STEADY";
}

function PitchCard({ player }: { player: RankedPlayer }) {
  return (
    <div className="lab-pitch-player">
      <div className="lab-shirt">{player.team}</div>
      <Link href={"/research?player=" + player.id}>{player.name}</Link>
      <small>{player.assistantScore.toFixed(1)} · £{player.price.toFixed(1)}</small>
    </div>
  );
}

export function SquadLab({
  players,
  dataRetrievedAt,
  freshness,
  processTeams,
  initialPlayerIds = [],
  teamId,
  leagueId,
  teamName,
}: {
  players: RankedPlayer[];
  dataRetrievedAt: string;
  freshness: "LIVE_FPL" | "CACHED_FALLBACK";
  processTeams: number;
  initialPlayerIds?: number[];
  teamId?: number;
  leagueId?: number;
  teamName?: string;
}) {
  const [mode, setMode] = useState<Mode>("FPL");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [team, setTeam] = useState("ALL");
  const [maxPrice, setMaxPrice] = useState(15);
  const [sort, setSort] = useState<SortKey>("score");
  const [showAllPool, setShowAllPool] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialPlayerIds);
  const [message, setMessage] = useState<string | null>(null);
  const [leagueStrategy, setLeagueStrategy] = useState<LeagueStrategy | null>(null);
  const [resourceAdvice, setResourceAdvice] = useState<ResourceAdvice | null>(null);
  const [resourceMap, setResourceMap] = useState<ResourceManager[]>([]);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(Boolean(teamId && leagueId));

  useEffect(() => {
    if (initialPlayerIds.length) return;
    const saved = window.localStorage.getItem("footy-squad-lab");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { mode?: Mode; ids?: number[] };
      if (parsed.mode === "FPL" || parsed.mode === "DRAFT") setMode(parsed.mode);
      if (Array.isArray(parsed.ids)) setSelectedIds(parsed.ids);
    } catch {}
  }, [initialPlayerIds]);

  useEffect(() => {
    window.localStorage.setItem(
      "footy-squad-lab",
      JSON.stringify({ mode, ids: selectedIds }),
    );
  }, [mode, selectedIds]);

  useEffect(() => {
    if (!teamId || !leagueId) return;
    const controller = new AbortController();
    async function loadStrategy() {
      try {
        setStrategyLoading(true);
        setStrategyError(null);
        const response = await fetch(
          `/api/league/${leagueId}/manager/${teamId}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "League strategy unavailable.");
        setLeagueStrategy(body.league_strategy ?? null);
        setResourceAdvice(body.resource_advice ?? null);
        setResourceMap(body.resource_map ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStrategyError(error instanceof Error ? error.message : "League strategy unavailable.");
      } finally {
        if (!controller.signal.aborted) setStrategyLoading(false);
      }
    }
    void loadStrategy();
    return () => controller.abort();
  }, [leagueId, teamId]);

  const teams = useMemo(
    () => [...new Set(players.map((player) => player.team))].sort(),
    [players],
  );
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => players.find((player) => player.id === id))
        .filter((player): player is RankedPlayer => Boolean(player)),
    [players, selectedIds],
  );

  const spent = selected.reduce((sum, player) => sum + player.price, 0);
  const startingIds = useMemo(() => buildXI(selected), [selected]);
  const starters = selected.filter((player) => startingIds.has(player.id));
  const bench = selected.filter((player) => !startingIds.has(player.id));

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return players
      .filter((player) => {
        if (
          text &&
          !player.name.toLowerCase().includes(text) &&
          !player.team.toLowerCase().includes(text)
        ) return false;
        if (position !== "ALL" && player.position !== position) return false;
        if (team !== "ALL" && player.team !== team) return false;
        if (mode === "FPL" && player.price > maxPrice) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "form") return b.form - a.form;
        if (sort === "value") return b.valueScore - a.valueScore;
        if (sort === "xgi") return b.xgiPer90 - a.xgiPer90;
        if (sort === "trend") return b.transfersNet - a.transfersNet;
        return b.assistantScore - a.assistantScore;
      });
  }, [maxPrice, mode, players, position, query, sort, team]);

  function addPlayer(player: RankedPlayer) {
    setMessage(null);
    if (selectedIds.includes(player.id)) return;
    if (selected.length >= 15) return setMessage("Your mock squad already has 15 players.");

    const positionCount = selected.filter((item) => item.position === player.position).length;
    if (positionCount >= (POSITION_LIMITS[player.position] ?? 15)) {
      return setMessage(`Position limit reached for ${player.position}.`);
    }

    if (mode === "FPL") {
      const clubCount = selected.filter((item) => item.team === player.team).length;
      if (clubCount >= 3) return setMessage(`Maximum three ${player.team} players in FPL mode.`);
      if (spent + player.price > 100) return setMessage("That move takes the mock squad above £100m.");
    }
    setSelectedIds((ids) => [...ids, player.id]);
  }

  function simulateTransfer(outId: number, inId: number) {
    setSelectedIds((ids) => {
      const without = ids.filter((id) => id !== outId && id !== inId);
      return [...without, inId];
    });
    setMessage("Scenario applied to the pitch. This does not change your real FPL team.");
  }

  function resetLiveTeam() {
    setSelectedIds(initialPlayerIds);
    setMessage("Reset to the live public squad.");
  }

  const positions = ["GKP", "DEF", "MID", "FWD"];

  return (
    <div className="squad-lab">
      <section className="lab-toolbar">
        <div>
          <span className="eyebrow">Footy Player Database + Squad Lab</span>
          <h1>{teamName ? `What if ${teamName} did this?` : "Search the player pool. Build the team."}</h1>
          <p>
            Official FPL data is fused with Footy&apos;s underlying football process,
            then league context can adjust strong moves for the rivals you need to beat.
          </p>
        </div>
        <div className="lab-freshness">
          <span>{freshness === "LIVE_FPL" ? "LIVE FPL FEED" : "CACHED FALLBACK"}</span>
          <strong>{new Date(dataRetrievedAt).toLocaleString()}</strong>
          <small>{processTeams} PL teams with Footy process data</small>
        </div>
      </section>

      {teamId && leagueId ? (
        <section className="league-sim-card">
          <div>
            <span className="eyebrow">League Simulation Mode</span>
            <h2>
              {strategyLoading
                ? "Reading the mini-league battle…"
                : leagueStrategy
                  ? `${leagueStrategy.mode} against ${leagueStrategy.rival_name ?? "the nearest rival"}`
                  : "League context unavailable"}
            </h2>
            {leagueStrategy ? (
              <p>
                {leagueStrategy.gap_to_leader
                  ? `${leagueStrategy.gap_to_leader} points to the leader. `
                  : "You are setting the target. "}
                Footy starts with expected output, then adds only a controlled
                rival-context adjustment.
              </p>
            ) : null}
            {resourceAdvice ? (
              <div className="lab-resource-advice">
                <span>{resourceAdvice.status} RESOURCE POSITION</span>
                <strong>{resourceAdvice.recommendation}</strong>
                <small>
                  FT edge {resourceAdvice.free_transfer_edge >= 0 ? "+" : ""}
                  {resourceAdvice.free_transfer_edge}
                  {resourceAdvice.chip_edge.length
                    ? ` · Your chip edge: ${resourceAdvice.chip_edge.join(", ")}`
                    : ""}
                  {resourceAdvice.chip_threats.length
                    ? ` · Rival chip edge: ${resourceAdvice.chip_threats.join(", ")}`
                    : ""}
                </small>
              </div>
            ) : null}
            {strategyError ? <p className="lab-message">{strategyError}</p> : null}
          </div>

          {resourceMap.length ? (
            <div className="lab-resource-strip">
              {resourceMap.map(({ standing, history }) => (
                <article key={standing.entry_id}>
                  <span>#{standing.rank} {standing.entry_name}</span>
                  <strong>{history.estimatedFreeTransfers} FT</strong>
                  <small>
                    H{history.currentHalf}: {history.currentHalfRemaining.join(", ") || "no chips"}
                    {" · "}{history.activity.toLowerCase()}
                  </small>
                </article>
              ))}
            </div>
          ) : null}

          {leagueStrategy ? (
            <div className="league-sim-moves">
              {leagueStrategy.transfer_moves.map((move, index) => (
                <article key={move.out.id}>
                  <span>MOVE {index + 1}</span>
                  <strong>{move.out.name} → {move.in.name}</strong>
                  <small>{move.rationale}</small>
                  <b>Raw model gain +{move.raw_gain.toFixed(1)} · League score {move.league_score.toFixed(1)}</b>
                  <button type="button" onClick={() => simulateTransfer(move.out.id, move.in.id)}>
                    Simulate on pitch
                  </button>
                </article>
              ))}
              {!leagueStrategy.transfer_moves.length ? (
                <article><strong>HOLD</strong><small>No transfer currently clears the model threshold.</small></article>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="lab-mode">
        <button className={mode === "FPL" ? "active" : ""} type="button" onClick={() => setMode("FPL")}>
          FPL MOCK · £100m + club limits
        </button>
        <button className={mode === "DRAFT" ? "active" : ""} type="button" onClick={() => setMode("DRAFT")}>
          DRAFT BOARD · no budget cap
        </button>
        {initialPlayerIds.length ? (
          <button type="button" onClick={resetLiveTeam}>Reset live team</button>
        ) : null}
      </div>

      <section className="lab-grid">
        <div className="lab-database-panel">
          <div className="lab-filters">
            <input placeholder="Search player or club…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={position} onChange={(event) => setPosition(event.target.value)}>
              <option value="ALL">All positions</option>
              {positions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={team} onChange={(event) => setTeam(event.target.value)}>
              <option value="ALL">All clubs</option>
              {teams.map((item) => <option key={item}>{item}</option>)}
            </select>
            {mode === "FPL" ? (
              <select value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}>
                <option value={15}>Any price</option>
                <option value={12}>≤ £12.0m</option>
                <option value={10}>≤ £10.0m</option>
                <option value={8}>≤ £8.0m</option>
                <option value={6.5}>≤ £6.5m</option>
                <option value={5}>≤ £5.0m</option>
              </select>
            ) : null}
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="score">Footy score</option>
              <option value="form">FPL form</option>
              <option value="value">Value score</option>
              <option value="xgi">xGI / 90</option>
              <option value="trend">Transfer trend</option>
            </select>
          </div>

          <div className="player-db-head">
            <span>{filtered.length} matching players</span>
            <Link href="/research#players">Full player research →</Link>
          </div>

          <div className="player-db-list">
            {(showAllPool ? filtered : filtered.slice(0, 160)).map((player) => {
              const picked = selectedIds.includes(player.id);
              return (
                <div className="player-db-row-shell" key={player.id}>
                  <button
                    type="button"
                    className={picked ? "player-db-row selected" : "player-db-row"}
                    onClick={() =>
                      picked
                        ? setSelectedIds((ids) => ids.filter((id) => id !== player.id))
                        : addPlayer(player)
                    }
                    aria-label={
                      (picked ? "Remove " : "Add ") + player.name + " from scenario"
                    }
                  >
                    <div className="player-db-name">
                      <b>{player.name}</b>
                      <small>{player.team} · {player.position} · {signal(player)}</small>
                    </div>
                    <div><span>Footy</span><strong>{player.assistantScore.toFixed(1)}</strong></div>
                    <div><span>Form</span><strong>{player.form.toFixed(1)}</strong></div>
                    <div><span>xGI/90</span><strong>{player.xgiPer90.toFixed(2)}</strong></div>
                    <div><span>Process</span><strong>{player.processBoost >= 0 ? "+" : ""}{(player.processBoost * 100).toFixed(0)}%</strong></div>
                    <div><span>ATT/DEF</span><strong>{player.teamAttackIndex.toFixed(2)} / {player.teamDefenceIndex.toFixed(2)}</strong></div>
                    <div><span>Next</span><strong>{player.opponent ?? "—"}</strong></div>
                    <div><span>Price</span><strong>£{player.price.toFixed(1)}</strong></div>
                    <div><span>Own</span><strong>{player.selectedBy.toFixed(1)}%</strong></div>
                    <i>{picked ? "−" : "+"}</i>
                  </button>
                  <Link
                    className="player-db-profile"
                    href={"/research?player=" + player.id}
                  >
                    Analysis →
                  </Link>
                </div>
              );
            })}
          </div>

          {filtered.length > 160 ? (
            <button
              type="button"
              className="player-db-show-all"
              onClick={() => setShowAllPool((value) => !value)}
            >
              {showAllPool ? "Show first 160" : "Show all " + filtered.length + " players"}
            </button>
          ) : null}
        </div>

        <aside className="lab-squad-panel">
          <div className="lab-squad-summary">
            <div><span>Players</span><strong>{selected.length}/15</strong></div>
            <div><span>{mode === "FPL" ? "Current cost" : "Mode"}</span><strong>{mode === "FPL" ? `£${spent.toFixed(1)}m` : "Draft"}</strong></div>
            <div><span>Squad score</span><strong>{selected.reduce((s,p)=>s+p.assistantScore,0).toFixed(1)}</strong></div>
          </div>

          {message ? <p className="lab-message">{message}</p> : null}

          <div className="lab-pitch">
            <div className="lab-pitch-mark halfway" />
            <div className="lab-pitch-mark circle" />
            {positions.map((pos) => (
              <div className="lab-pitch-row" key={pos}>
                {starters.filter((player) => player.position === pos).map((player) => (
                  <PitchCard key={player.id} player={player} />
                ))}
              </div>
            ))}
          </div>

          <div className="lab-bench">
            <span>BENCH / EXTRA PICKS</span>
            <div>
              {bench.map((player) => <PitchCard key={player.id} player={player} />)}
              {!bench.length ? <small>Complete the squad to see the automatic XI and bench.</small> : null}
            </div>
          </div>

          <div className="lab-position-check">
            {positions.map((pos) => (
              <div key={pos}>
                <span>{pos}</span>
                <strong>{selected.filter((p) => p.position === pos).length}/{POSITION_LIMITS[pos]}</strong>
              </div>
            ))}
          </div>
          <p className="lab-local-note">
            Scenarios are private to this browser and never change your real FPL team.
          </p>
        </aside>
      </section>
    </div>
  );
}
