"use client";

import { useRouter } from "next/navigation";

type LeagueOption = {
  id: number;
  name: string;
  rank: number | null;
};

export function TeamRoomLeagueSwitcher({
  teamId,
  currentLeagueId,
  leagues,
}: {
  teamId: number;
  currentLeagueId: number;
  leagues: LeagueOption[];
}) {
  const router = useRouter();

  return (
    <label className="team-room-league-switcher">
      <span>League</span>
      <select
        value={currentLeagueId}
        aria-label="Change mini-league"
        onChange={(event) => {
          const nextLeague = Number(event.target.value);
          if (!Number.isInteger(nextLeague) || nextLeague <= 0) return;
          router.push("/team/" + teamId + "?league=" + nextLeague);
        }}
      >
        {leagues.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
            {league.rank ? " · #" + league.rank : ""}
          </option>
        ))}
      </select>
      <small>Switch context without leaving Team Room</small>
    </label>
  );
}
