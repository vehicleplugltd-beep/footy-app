import Link from "next/link";

export default function ProPage() {
  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/">League Edge</Link>
          <Link href="/results">Receipts</Link>
        </div>
      </nav>

      <section className="shell pass-hero">
        <span className="eyebrow">Footy League Edge · Founding passes</span>
        <h1>Pay for the decision layer.</h1>
        <p>
          The free product shows the league. The season pass tells you what to
          do about it: move ranking, chase/protect, rival chips and Receipts.
        </p>
      </section>

      <section className="shell edge-price-grid pass-grid">
        <article className="featured">
          <span>PLAYER PASS</span>
          <h3>£9.99 <small>founding price</small></h3>
          <p>One manager, this season. No auto-renew.</p>
          <ul>
            <li>Top five transfer/captain moves</li>
            <li>League-win probability change</li>
            <li>Chase / protect mode</li>
            <li>Rivals&apos; chip tracker</li>
            <li>Chip planner</li>
            <li>Receipts detail</li>
          </ul>
          <button type="button" disabled>Checkout opening soon</button>
        </article>

        <article>
          <span>LEAGUE PASS</span>
          <h3>£29 <small>founding price</small></h3>
          <p>Up to 12 managers plus commissioner tools.</p>
          <ul>
            <li>Player Pass features for 12 seats</li>
            <li>Commissioner dashboard</li>
            <li>League invite link</li>
            <li>Commissioner recap badge</li>
          </ul>
          <button type="button" disabled>Checkout opening soon</button>
        </article>
      </section>

      <section className="shell pass-note">
        <strong>One-off season pass.</strong>
        <p>
          No monthly subscription and no auto-renew. Footy will only turn on
          checkout when the promised paid features are ready to deliver.
        </p>
      </section>
    </main>
  );
}
