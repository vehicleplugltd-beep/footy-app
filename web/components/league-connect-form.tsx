"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LeagueConnectForm({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = leagueId.replace(/\D/g, "");
    if (!clean) return;
    router.push(`/league/${clean}`);
  }

  return (
    <form className={compact ? "league-connect compact" : "league-connect"} onSubmit={submit}>
      <label htmlFor={compact ? "league-id-compact" : "league-id"}>
        <span>Your classic mini-league ID</span>
        <div>
          <input
            id={compact ? "league-id-compact" : "league-id"}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 123456"
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            aria-label="Classic mini-league ID"
          />
          <button type="submit">See my league</button>
        </div>
      </label>
      {!compact ? (
        <small>No FPL password. We only use the public league ID.</small>
      ) : null}
    </form>
  );
}
