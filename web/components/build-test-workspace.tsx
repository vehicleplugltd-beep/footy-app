"use client";

import { useEffect, useRef, useState } from "react";
import { SquadLab } from "@/components/squad-lab";
import type { PlayerDatabasePayload } from "@/lib/fpl";

export function BuildTestWorkspace({
  teamId,
  leagueId,
  teamName,
  initialPlayerIds,
}: {
  teamId: number;
  leagueId?: number;
  teamName: string;
  initialPlayerIds: number[];
}) {
  const [data, setData] = useState<PlayerDatabasePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      { rootMargin: "350px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [requested]);

  useEffect(() => {
    if (!requested || data || error) return;

    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/player-db", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Player database unavailable.");
        }
        setData(body);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Player database unavailable.",
        );
      }
    }

    void load();
    return () => controller.abort();
  }, [data, error, requested]);

  return (
    <div ref={ref}>
      {!requested ? (
        <button
          type="button"
          className="build-test-load"
          onClick={() => setRequested(true)}
        >
          Load Build &amp; Test
        </button>
      ) : !data && !error ? (
        <div className="build-test-loading">
          <strong>Loading player database and Footy process data…</strong>
          <span />
        </div>
      ) : error ? (
        <div className="lab-message">{error}</div>
      ) : data ? (
        <SquadLab
          players={data.players}
          dataRetrievedAt={data.dataRetrievedAt}
          freshness={data.freshness}
          processTeams={data.processTeams}
          initialPlayerIds={initialPlayerIds}
          teamId={teamId}
          leagueId={leagueId}
          teamName={teamName}
        />
      ) : null}
    </div>
  );
}
