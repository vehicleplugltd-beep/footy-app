"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LeaguePreference({
  teamId,
  leagueId,
  validLeagueIds,
  view = "today",
}: {
  teamId: number;
  leagueId?: number;
  validLeagueIds: number[];
  view?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const key = `footy-preferred-league-${teamId}`;

    if (leagueId && validLeagueIds.includes(leagueId)) {
      window.localStorage.setItem(key, String(leagueId));
      return;
    }

    if (leagueId) return;

    const saved = Number(window.localStorage.getItem(key) || 0);
    if (saved > 0 && validLeagueIds.includes(saved)) {
      router.replace(`/team/${teamId}?league=${saved}&view=${view}`);
    }
  }, [leagueId, router, teamId, validLeagueIds, view]);

  return null;
}
