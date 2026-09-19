"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "footy-betting-age-18";

export function BettingAgeGate() {
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setAccepted(window.localStorage.getItem(STORAGE_KEY) === "yes");
    setChecked(true);
  }, []);

  if (!checked || accepted) return null;

  return (
    <div className="age-gate-backdrop" role="dialog" aria-modal="true">
      <div className="age-gate-card">
        <span className="eyebrow">18+ betting area</span>
        <h2>Confirm you are 18 or over</h2>
        <p>
          Footy betting tools are for adults only. Betting involves risk and
          there is no guarantee of profit.
        </p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "yes");
            setAccepted(true);
          }}
        >
          I am 18 or over
        </button>
        <Link href="/fpl">Under 18? Use the free FPL assistant instead</Link>
      </div>
    </div>
  );
}
