"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function extractTeamId(value: string) {
  const entryMatch = value.match(/\/entry\/(\d+)/i);
  if (entryMatch?.[1]) return entryMatch[1];
  const numericMatch = value.match(/\b(\d{2,})\b/);
  return numericMatch?.[1] ?? "";
}

export function TeamConnectForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [teamRef, setTeamRef] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const teamId = extractTeamId(teamRef);
    if (!teamId) return;
    router.push(`/team/${teamId}`);
  }

  return (
    <form className={compact ? "league-connect compact" : "league-connect"} onSubmit={submit}>
      <label htmlFor={compact ? "team-id-compact" : "team-id"}>
        <span>Your FPL Team ID</span>
        <div>
          <input
            id={compact ? "team-id-compact" : "team-id"}
            inputMode="text"
            placeholder="e.g. 123456 or paste your FPL team URL"
            value={teamRef}
            onChange={(event) => setTeamRef(event.target.value)}
            aria-label="FPL Team ID or FPL team URL"
          />
          <button type="submit">Find my team</button>
        </div>
      </label>
      {!compact ? (
        <small>No FPL password. Use the number after /entry/ in your public FPL team URL.</small>
      ) : null}
    </form>
  );
}
