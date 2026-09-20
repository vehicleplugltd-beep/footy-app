"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function WatchPriceButton({
  matchId,
  eventName,
  selection,
  targetOdds,
}: {
  matchId: string;
  eventName: string;
  selection: string;
  targetOdds: number;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function watch() {
    setError(null);
    setState("saving");

    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      window.location.href = "/account?return=/";
      return;
    }

    const existing = await supabase
      .from("footy_price_alerts")
      .select("id")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .eq("market", "1X2")
      .eq("selection", selection)
      .is("bookmaker", null)
      .maybeSingle();

    if (existing.error) {
      setState("idle");
      setError(existing.error.message);
      return;
    }

    const response = existing.data
      ? await supabase
          .from("footy_price_alerts")
          .update({
            target_odds: targetOdds,
            enabled: true,
            was_above_target: false,
          })
          .eq("id", existing.data.id)
      : await supabase.from("footy_price_alerts").insert({
          user_id: user.id,
          match_id: matchId,
          event_name: eventName,
          market: "1X2",
          selection,
          bookmaker: null,
          target_odds: targetOdds,
          enabled: true,
        });

    if (response.error) {
      setState("idle");
      setError(response.error.message);
      return;
    }

    setState("saved");
  }

  return (
    <div className="watch-price-wrap">
      <button
        className="watch-price-button"
        type="button"
        onClick={watch}
        disabled={state !== "idle"}
      >
        {state === "saved"
          ? "Watching ✓"
          : state === "saving"
            ? "Saving…"
            : "Watch this price"}
      </button>
      {error ? <small>{error}</small> : null}
    </div>
  );
}
