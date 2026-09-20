import Link from "next/link";
import { getLeagueReceiptSummary } from "@/lib/league-receipts";

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function ReceiptsPage() {
  const summary = await getLeagueReceiptSummary();

  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/">League Edge</Link>
          <Link href="/">Find team</Link>
        </div>
      </nav>

      <section className="shell receipts-page-hero">
        <span className="eyebrow">Footy Receipts</span>
        <h1>Freeze it before the deadline. Score it afterwards.</h1>
        <p>
          Every generated top-three captain and transfer set is timestamped.
          The latest snapshot made before the deadline becomes the official
          Footy call. It cannot be replaced by hindsight.
        </p>
      </section>

      <section className="shell receipt-rules">
        <article><strong>1. Refresh</strong><p>Pull latest FPL data, availability, player movement and recent team process.</p></article>
        <article><strong>2. Freeze</strong><p>Keep the final pre-deadline top-three calls as the official receipt.</p></article>
        <article><strong>3. Score</strong><p>Read the public squad after deadline and test whether the manager followed a top-three move.</p></article>
        <article><strong>4. Publish</strong><p>Show adoption and calibration with misses left visible.</p></article>
      </section>

      <section className="shell receipts-scoreboard">
        <article>
          <span>Official calls</span>
          <strong>{summary.officialCalls}</strong>
          <small>latest pre-deadline manager snapshots</small>
        </article>
        <article>
          <span>Scored calls</span>
          <strong>{summary.scoredCalls}</strong>
          <small>Gameweeks with post-deadline squad evidence</small>
        </article>
        <article>
          <span>Top-three adoption</span>
          <strong>{pct(summary.adherenceRate)}</strong>
          <small>key product metric once scoring begins</small>
        </article>
        <article>
          <span>Captain / transfer</span>
          <strong>{summary.captainTop3} / {summary.transferTop3}</strong>
          <small>scored top-three matches by decision type</small>
        </article>
      </section>

      <div className="shell league-state">
        {summary.officialCalls
          ? "Receipts are being collected. Post-deadline scoring will turn these frozen calls into an adoption record."
          : "No official recommendation receipt exists yet. The first connected manager preview will create one automatically."}
      </div>
    </main>
  );
}
