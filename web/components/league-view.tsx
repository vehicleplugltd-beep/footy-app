"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Standing = {
  id: number;
  entry_id: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  event_total: number;
  total: number;
};

type LeaguePayload = {
  league?: { id: number; name: string };
  standings?: {
    page?: number;
    has_next: boolean;
    results: Standing[];
  };
};

function rankDelta(row: Standing) {
  if (!row.last_rank || row.last_rank === row.rank) return 0;
  return row.last_rank - row.rank;
}

function gapLabel(points: number) {
  if (points <= 0) return "Level";
  return `${points} pt${points === 1 ? "" : "s"}`;
}

function getBattleMode(row: Standing, leader: Standing) {
  const gap = Math.max(0, leader.total - row.total);

  if (row.entry_id === leader.entry_id) {
    return {
      label: "PROTECT",
      className: "mode-protect",
      copy:
        gap === 0
          ? "You set the target. The decision layer should focus on the rivals closest to taking the lead, not on chasing unnecessary differentiation."
          : "Protect the lead against the nearest challengers.",
    };
  }

  if (gap <= 20) {
    return {
      label: "CHASE",
      className: "mode-chase",
      copy:
        "You are within one strong Gameweek of changing the race. The paid layer will rank moves against the managers directly above you.",
    };
  }

  return {
    label: "RECOVER",
    className: "mode-recover",
    copy:
      "The gap is meaningful, so the important question is which future decisions can create separation without simply gambling on low-probability punts.",
  };
}

export function LeagueView({ leagueId }: { leagueId: string }) {
  const [payload, setPayload] = useState<LeaguePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/league/${leagueId}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "League not found. Check the classic league ID."
              : "The FPL feed did not return this league.",
          );
        }
        const data = (await response.json()) as LeaguePayload;
        if (!data.standings?.results?.length) {
          throw new Error("This league has no public standings to show.");
        }
        setPayload(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "We could not load this league right now.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [leagueId]);

  const rows = payload?.standings?.results ?? [];
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.rank - b.rank),
    [rows],
  );

  useEffect(() => {
    if (!selectedEntryId && sortedRows[0]) {
      setSelectedEntryId(sortedRows[0].entry_id);
    }
  }, [selectedEntryId, sortedRows]);

  const recap = useMemo(() => {
    if (!sortedRows.length) return null;
    const leader = sortedRows[0];
    const second = sortedRows[1];
    const climber = [...sortedRows].sort(
      (a, b) => rankDelta(b) - rankDelta(a),
    )[0];
    const weekly = [...sortedRows].sort(
      (a, b) => b.event_total - a.event_total,
    )[0];

    return {
      leader,
      gap: second ? leader.total - second.total : 0,
      climber,
      climb: rankDelta(climber),
      weekly,
    };
  }, [sortedRows]);

  const selected =
    sortedRows.find((row) => row.entry_id === selectedEntryId) ??
    sortedRows[0] ??
    null;

  const selectedIndex = selected
    ? sortedRows.findIndex((row) => row.entry_id === selected.entry_id)
    : -1;
  const rivalAbove = selectedIndex > 0 ? sortedRows[selectedIndex - 1] : null;
  const rivalBelow =
    selectedIndex >= 0 && selectedIndex < sortedRows.length - 1
      ? sortedRows[selectedIndex + 1]
      : null;
  const leader = sortedRows[0] ?? null;
  const battleMode =
    selected && leader ? getBattleMode(selected, leader) : null;
  const gapToLeader =
    selected && leader ? Math.max(0, leader.total - selected.total) : 0;
  const gapToAbove =
    selected && rivalAbove ? Math.max(0, rivalAbove.total - selected.total) : 0;
  const cushionBelow =
    selected && rivalBelow ? Math.max(0, selected.total - rivalBelow.total) : 0;

  async function share() {
    const title = payload?.league?.name
      ? `${payload.league.name} · Footy League Edge`
      : "Footy League Edge";
    const recapBits = recap
      ? [
          `${recap.leader.entry_name} leads by ${recap.gap} point${recap.gap === 1 ? "" : "s"}.`,
          `${recap.weekly.entry_name} top-scored with ${recap.weekly.event_total}.`,
          recap.climb > 0
            ? `${recap.climber.entry_name} climbed ${recap.climb} place${recap.climb === 1 ? "" : "s"}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "See our FPL mini-league on Footy.";
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({ title, text: recapBits, url });
      return;
    }
    await navigator.clipboard.writeText(`${recapBits} ${url}`);
    window.alert("League recap copied.");
  }

  if (loading) {
    return <div className="league-state">Loading your league…</div>;
  }

  if (error || !payload) {
    return (
      <div className="league-state error">
        <strong>We couldn&apos;t connect that league.</strong>
        <p>{error}</p>
        <p>
          Footy is serving the first leagues in beta. Check the numeric classic
          league ID and try again.
        </p>
        <Link href="/">Try another league</Link>
      </div>
    );
  }

  return (
    <>
      <section className="league-header">
        <div>
          <span className="eyebrow">Your mini-league</span>
          <h1>{payload.league?.name ?? `League ${leagueId}`}</h1>
          <p>
            Beat your league, not the world. Footy frames every decision around
            the people you actually want to beat.
          </p>
        </div>
        <button className="share-league-button" type="button" onClick={share}>
          Share weekly recap
        </button>
      </section>

      {recap ? (
        <section className="league-recap-card">
          <div className="recap-card-top">
            <span>FOOTY · WEEKLY RECAP</span>
            <strong>{payload.league?.name ?? "Mini-league"}</strong>
          </div>

          <div className="recap-hero">
            <span>Top of the pile</span>
            <strong>{recap.leader.entry_name}</strong>
            <p>
              {recap.leader.player_name} leads by{" "}
              <b>{recap.gap} point{recap.gap === 1 ? "" : "s"}</b>.
            </p>
          </div>

          <div className="recap-grid">
            <div>
              <span>Gameweek scorer</span>
              <strong>{recap.weekly.entry_name}</strong>
              <small>{recap.weekly.event_total} pts this Gameweek</small>
            </div>
            <div>
              <span>Biggest climber</span>
              <strong>{recap.climber.entry_name}</strong>
              <small>
                {recap.climb > 0
                  ? `up ${recap.climb} place${recap.climb === 1 ? "" : "s"}`
                  : "holding position"}
              </small>
            </div>
          </div>

          <p className="recap-banter">
            The recap tells you what happened. The command centre below tells
            you which mini-league battle matters next.
          </p>
        </section>
      ) : null}

      {selected && leader && battleMode ? (
        <section className="league-command-centre">
          <div className="league-command-head">
            <div>
              <span className="eyebrow">League command centre</span>
              <h2>Pick your manager. See your battle.</h2>
              <p>
                This layer uses only real standings data: rank, points, weekly
                movement and the gaps between rivals. Squad-level move ranking
                stays locked until that data is synced.
              </p>
            </div>
            <label className="manager-picker">
              <span>Viewing manager</span>
              <select
                value={selected.entry_id}
                onChange={(event) =>
                  setSelectedEntryId(Number(event.target.value))
                }
              >
                {sortedRows.map((row) => (
                  <option key={row.entry_id} value={row.entry_id}>
                    {row.rank}. {row.entry_name} — {row.player_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="manager-battle-card">
            <div className="manager-battle-top">
              <div>
                <span>Current battle</span>
                <h3>{selected.entry_name}</h3>
                <small>{selected.player_name}</small>
              </div>
              <span className={`battle-mode ${battleMode.className}`}>
                {battleMode.label}
              </span>
            </div>

            <div className="manager-battle-metrics">
              <div>
                <span>League rank</span>
                <strong>#{selected.rank}</strong>
              </div>
              <div>
                <span>Leader gap</span>
                <strong>
                  {selected.rank === 1 ? "Leading" : gapLabel(gapToLeader)}
                </strong>
              </div>
              <div>
                <span>Next rival</span>
                <strong>
                  {rivalAbove ? gapLabel(gapToAbove) : "You lead"}
                </strong>
              </div>
              <div>
                <span>Cushion below</span>
                <strong>
                  {rivalBelow ? gapLabel(cushionBelow) : "No rival below"}
                </strong>
              </div>
            </div>

            <p className="manager-battle-copy">{battleMode.copy}</p>
          </div>

          <div className="rival-pressure">
            <span>Top-six pressure map · tap a rival to inspect</span>
            <div className="rival-pressure-grid">
              {sortedRows.slice(0, 6).map((row) => {
                const delta = rankDelta(row);
                const behind = Math.max(0, leader.total - row.total);
                return (
                  <button
                    className={`rival-pressure-card ${selected.entry_id === row.entry_id ? "active" : ""}`}
                    key={row.entry_id}
                    type="button"
                    onClick={() => setSelectedEntryId(row.entry_id)}
                  >
                    <span>#{row.rank}</span>
                    <b>{row.entry_name}</b>
                    <small>
                      {row.rank === 1 ? "Leader" : `${behind} pts back`}
                      {delta > 0
                        ? ` · ↑${delta}`
                        : delta < 0
                          ? ` · ↓${Math.abs(delta)}`
                          : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="league-table-panel">
        <div className="league-table-head">
          <div>
            <span className="eyebrow">Standings</span>
            <h2>Who you actually need to beat</h2>
          </div>
          <span>{rows.length} managers shown</span>
        </div>

        <div className="league-table">
          {sortedRows.slice(0, 50).map((row) => {
            const delta = rankDelta(row);
            return (
              <div className="league-row" key={row.entry_id}>
                <span className="league-rank">{row.rank}</span>
                <div>
                  <strong>{row.entry_name}</strong>
                  <small>{row.player_name}</small>
                </div>
                <span
                  className={
                    delta > 0 ? "rank-up" : delta < 0 ? "rank-down" : ""
                  }
                >
                  {delta > 0
                    ? `↑${delta}`
                    : delta < 0
                      ? `↓${Math.abs(delta)}`
                      : "—"}
                </span>
                <span>{row.event_total} GW</span>
                <strong>{row.total} pts</strong>
              </div>
            );
          })}
        </div>
      </section>

      {selected && battleMode ? (
        <section className="decision-gate">
          <div className="decision-gate-copy">
            <span className="eyebrow">Player Pass preview</span>
            <h2>From “where am I?” to “what changes the race?”</h2>
            <p>
              The free layer can identify your league situation. The paid
              decision layer will add your squad, rival ownership, captaincy and
              chip state before ranking any actual move.
            </p>
            <Link href="/pro">See the founding Player Pass →</Link>
          </div>

          <div className="decision-gate-preview">
            <span>DECISION LAYER · DATA GATED</span>
            <div className="decision-context">
              <div>
                <span>Current mode</span>
                <strong>{battleMode.label}</strong>
              </div>
              <div>
                <span>Rival to solve first</span>
                <strong>
                  {rivalAbove?.entry_name ??
                    rivalBelow?.entry_name ??
                    "No direct rival"}
                </strong>
              </div>
            </div>

            <div className="locked-moves">
              <div className="locked-move">
                <span>Transfer ranking</span>
                <strong>Requires your current squad</strong>
                <small>
                  Compare each move against the rival gap, fixture horizon and
                  overlapping ownership.
                </small>
              </div>
              <div className="locked-move">
                <span>Captain leverage</span>
                <strong>Requires rival captain exposure</strong>
                <small>
                  Distinguish a sensible cover captain from a genuine chase
                  opportunity.
                </small>
              </div>
              <div className="locked-move">
                <span>Chip timing</span>
                <strong>Requires chip history + future fixtures</strong>
                <small>
                  Judge a chip by the mini-league swing it can create, not by a
                  generic “best Gameweek” label.
                </small>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
