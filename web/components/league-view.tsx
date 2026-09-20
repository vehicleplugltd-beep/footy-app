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
    page: number;
    has_next: boolean;
    results: Standing[];
  };
};

function rankDelta(row: Standing) {
  if (!row.last_rank || row.last_rank === row.rank) return 0;
  return row.last_rank - row.rank;
}

export function LeagueView({ leagueId }: { leagueId: string }) {
  const [payload, setPayload] = useState<LeaguePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  const recap = useMemo(() => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.rank - b.rank);
    const leader = sorted[0];
    const second = sorted[1];
    const climber = [...rows].sort((a, b) => rankDelta(b) - rankDelta(a))[0];
    const weekly = [...rows].sort((a, b) => b.event_total - a.event_total)[0];
    return {
      leader,
      gap: second ? leader.total - second.total : 0,
      climber,
      climb: rankDelta(climber),
      weekly,
    };
  }, [rows]);

  async function share() {
    const title = payload?.league?.name
      ? `${payload.league.name} · Footy League Edge`
      : "Footy League Edge";
    const text = recap
      ? `${recap.leader.entry_name} leads by ${recap.gap} point${recap.gap === 1 ? "" : "s"}. See our mini-league on Footy.`
      : "See our FPL mini-league on Footy.";
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    window.alert("League link copied.");
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
          Share with the group
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
            The table is talking. The next Footy release adds the move that gives
            each manager the best chance of changing it.
          </p>
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
          {rows.slice(0, 50).map((row) => {
            const delta = rankDelta(row);
            return (
              <div className="league-row" key={row.entry_id}>
                <span className="league-rank">{row.rank}</span>
                <div>
                  <strong>{row.entry_name}</strong>
                  <small>{row.player_name}</small>
                </div>
                <span className={delta > 0 ? "rank-up" : delta < 0 ? "rank-down" : ""}>
                  {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : "—"}
                </span>
                <span>{row.event_total} GW</span>
                <strong>{row.total} pts</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="league-next">
        <div>
          <span className="eyebrow">Coming next</span>
          <h2>Don&apos;t just show the table. Change it.</h2>
          <p>
            The paid move ranker will compare your squad with your rivals and
            rank transfers and captain choices by how much they improve your
            chance of winning this league.
          </p>
        </div>
        <div className="league-next-cards">
          <article>
            <strong>Chase mode</strong>
            <p>Behind the leader? Find the moves that close the gap.</p>
          </article>
          <article>
            <strong>Protect mode</strong>
            <p>Top of the league? Cover the rivals most likely to catch you.</p>
          </article>
          <article>
            <strong>Rival chips</strong>
            <p>See who still has their chips and where their best windows are.</p>
          </article>
          <article>
            <strong>Receipts</strong>
            <p>Footy freezes its probabilities before the deadline and scores them later.</p>
          </article>
        </div>
      </section>
    </>
  );
}
