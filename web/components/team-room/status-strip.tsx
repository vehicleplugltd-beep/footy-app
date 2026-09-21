"use client";

import type { ManagerResponse } from "@/components/team-room/types";

export function TeamRoomStatusStrip({
  freshness,
  retrievedAt,
  counterPlay,
  decisionQuality,
}: {
  freshness: "LIVE_FPL" | "CACHED_FALLBACK" | null | undefined;
  retrievedAt: string | null | undefined;
  counterPlay: ManagerResponse["counterplay"] | null;
  decisionQuality: ManagerResponse["decision_quality"] | null;
}) {
  const empirical =
    counterPlay?.volatility_calibration.status === "EMPIRICAL";

  return (
    <div
      className="team-room-status-row"
      aria-label="Model and data status"
      aria-live="polite"
    >
      <span className="team-room-live-pill">
        <i />
        {freshness === "LIVE_FPL" ? "LIVE FPL" : "FPL DATA"}
      </span>
      <span className="team-room-status-time">
        {retrievedAt
          ? "Updated " +
            new Date(retrievedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Loading live intelligence"}
      </span>
      {empirical ? (
        <span className="team-room-status-proof">
          EMPIRICAL ·{" "}
          {counterPlay.volatility_calibration.sample_count.toLocaleString()}
        </span>
      ) : counterPlay ? (
        <span className="team-room-status-proof fallback">TAIL FALLBACK</span>
      ) : null}
      {decisionQuality?.pending ? (
        <a className="team-room-status-audit" href="#audit">
          GW{decisionQuality.pending.event} AUDIT ARMED
        </a>
      ) : null}
    </div>
  );
}
