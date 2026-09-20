import Link from "next/link";

export default function ReceiptsPage() {
  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/">League Edge</Link>
          <Link href="/pro">Season passes</Link>
        </div>
      </nav>

      <section className="shell receipts-page-hero">
        <span className="eyebrow">Footy Receipts</span>
        <h1>Freeze it before the deadline. Score it afterwards.</h1>
        <p>
          Every league-win probability and top-ranked move will be timestamped
          before the FPL deadline. After final scoring, Footy records what
          happened. Misses stay visible.
        </p>
      </section>

      <section className="shell receipt-rules">
        <article><strong>1. Compute</strong><p>League-specific probabilities and moves.</p></article>
        <article><strong>2. Freeze</strong><p>Immutable snapshot before the deadline.</p></article>
        <article><strong>3. Score</strong><p>Compare with the final Gameweek outcome.</p></article>
        <article><strong>4. Publish</strong><p>Season-long calibration, including misses.</p></article>
      </section>

      <div className="shell league-state">
        Receipts will start appearing automatically as connected leagues reach
        their next deadline.
      </div>
    </main>
  );
}
