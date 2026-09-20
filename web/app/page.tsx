import Link from "next/link";
import { TeamConnectForm } from "@/components/team-connect-form";

export default function Home() {
  return (
    <main className="league-edge-app minimal-home">
      <nav className="nav shell minimal-nav">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </div>
        <div className="nav-links">
          <Link href="/results">Receipts</Link>
        </div>
      </nav>

      <section className="shell minimal-home-hero">
        <div className="minimal-home-copy">
          <span>FPL DECISIONS, MADE CLEAR</span>
          <h1>Know who to beat. Know what to do next.</h1>
          <p>
            Footy turns your real squad, mini-league position, rival resources
            and underlying football data into one clear plan.
          </p>
          <TeamConnectForm />
          <small>No FPL password. Team ID or public FPL team URL only.</small>
        </div>

        <aside className="minimal-home-example">
          <span>TODAY</span>
          <small>Sunday League Legends</small>
          <h2>
            Sell Player A for Player B. Captain Player C. Keep your Free Hit.
          </h2>
          <div>
            <p><b>Why:</b> stronger model edge</p>
            <p><b>Data:</b> better underlying xGI + fixture</p>
            <p><b>League:</b> creates separation from your nearest rival</p>
          </div>
        </aside>
      </section>

      <section className="shell minimal-home-flow">
        <article>
          <span>1</span>
          <strong>Connect your team</strong>
          <p>Footy finds the squad and mini-leagues already linked to it.</p>
        </article>
        <article>
          <span>2</span>
          <strong>Choose the battle</strong>
          <p>The advice changes depending on the league you want to win.</p>
        </article>
        <article>
          <span>3</span>
          <strong>Get one clear plan</strong>
          <p>Transfer, captain and resource advice with the facts behind it.</p>
        </article>
      </section>

      <section className="shell minimal-home-trust">
        <div>
          <span>UNDER THE HOOD</span>
          <h2>Simple on the surface. Serious underneath.</h2>
        </div>
        <div>
          <p>Underlying team process and player xGI</p>
          <p>Fixtures, availability and expected output</p>
          <p>Rival ownership, chips, hits and free transfers</p>
          <p>Receipts that keep old recommendations visible</p>
        </div>
      </section>

      <footer className="shell footer minimal-footer">
        <p>Free while Footy is being tested.</p>
        <p>CONNECT → DECIDE → UNDERSTAND → TEST</p>
      </footer>
    </main>
  );
}
