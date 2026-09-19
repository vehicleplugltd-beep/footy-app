import Link from "next/link";
import { BettingAgeGate } from "@/components/age-gate";

export default function ProPage() {
  return (
    <main>
      <BettingAgeGate />
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/account">Account</Link>
          <span className="status status-watch">FOUNDING BETA</span>
        </div>
      </nav>

      <section className="shell pricing-hero">
        <span className="eyebrow">Footy Pro</span>
        <h1>Pay for better betting information, not hype.</h1>
        <p>
          The paid product is being built around live price intelligence:
          fair odds, Minimum Take Price, validated value-tip feeds, bookmaker
          line-shopping, alerts and transparent evidence showing how the
          model compares with the closing market.
        </p>
      </section>

      <section className="shell pricing-grid">
        <article className="pricing-card">
          <span className="eyebrow">Free</span>
          <h2>£0</h2>
          <p>Use Footy before deciding whether the full terminal is worth it.</p>
          <ul>
            <li>Fair-price board</li>
            <li>Manual price checker</li>
            <li>Model-validation status</li>
            <li>Private saved-tip watchlist</li>
            <li>Basic model-performance history</li>
            <li>Free FPL Assistant remains separate</li>
          </ul>
          <Link className="secondary-cta" href="/account">Create free account</Link>
        </article>

        <article className="pricing-card featured">
          <span className="eyebrow">Founding Pro target</span>
          <h2>£9.99 <small>/ month</small></h2>
          <p>
            No payment is being taken yet. Join the founding waitlist while we
            validate the payment provider and finish the live odds layer.
          </p>
          <ul>
            <li>Live value scanner</li>
            <li>William Hill + best-market prices</li>
            <li>Price-crossing alerts</li>
            <li>Validated value-tip feeds only</li>
            <li>Advanced model-performance analytics</li>
            <li>CLV / model performance dashboard</li>
            <li>Advanced filters and exports</li>
          </ul>
          <Link className="primary-cta" href="/account">Join the Pro waitlist</Link>
        </article>
      </section>

      <section className="shell section">
        <div className="panel">
          <span className="eyebrow">Commercial rule</span>
          <h2>We do not sell “guaranteed winners”.</h2>
          <p className="muted">
            Footy Pro will charge for analytics, price intelligence and research workflow.
            We do not accept, place or settle bets. Models can be downgraded when
            validation deteriorates, and an unapproved market cannot become a
            customer-facing VALUE TIP simply because the raw EV looks large.
          </p>
        </div>
      </section>

      <footer className="shell footer">
        <p><strong>18+ only.</strong> Footy provides betting information and analytics; we do not accept or place bets.</p>
        <p>FAIR PRICE → TAKE PRICE → MARKET → EDGE → TRACK</p>
      </footer>
    </main>
  );
}
