"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLauncher() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [leagueId, setLeagueId] = useState("");

  function openTeam(event: FormEvent) {
    event.preventDefault();
    const id = teamId.replace(/\D/g, "");
    if (id) router.push(`/team/${id}`);
  }

  function openLeague(event: FormEvent) {
    event.preventDefault();
    const id = leagueId.replace(/\D/g, "");
    if (id) router.push(`/league/${id}`);
  }


  return (
    <div className="admin-launchers">
      <form onSubmit={openTeam}>
        <span>TEST TEAM FLOW</span>
        <div>
          <input
            inputMode="numeric"
            placeholder="FPL Team ID"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          />
          <button type="submit">Open team</button>
        </div>
      </form>

      <form onSubmit={openLeague}>
        <span>TEST LEAGUE FLOW</span>
        <div>
          <input
            inputMode="numeric"
            placeholder="Classic league ID"
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
          />
          <button type="submit">Open league</button>
        </div>
      </form>

    </div>
  );
}
