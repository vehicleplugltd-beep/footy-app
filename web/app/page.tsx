import Link from "next/link";
import { LeagueConnectForm } from "@/components/league-connect-form";

export default function Home() {
  return (
    <main className="league-edge-app">
      <nav className="nav shell">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </div>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Season passes</a>
          <Link href="/results">Receipts</Link>
        </div>
      </nav>

      <section className="shell league-edge-hero">
        <div className="league-edge-copy">
          <span className="eyebrow">Footy League Edge</span>
          <h1>
            Beat your mini-league.
            <br />
            <span>Not the world.</span>
          </h1>
          <p>
            Paste your classic league ID. Footy shows who is winning, why, and
            what each manager should do next to beat the people they actually
            care about.
          </p>
          <LeagueConnectForm />
          <div className="league-edge-proof">
            <span>✓ No FPL password</span>
            <span>✓ Automatic weekly sync</span>
            <span>✓ Group-chat recap</span>
          </div>
        </div>

        <aside className="sample-recap">
          <div className="sample-recap-head">
            <span>FOOTY · WEEKLY RECAP</span>
            <strong>Sunday League Legends</strong>
          </div>
          <div className="sample-leader">
            <span>Top of the pile</span>
            <strong>Bench Warmers FC</strong>
            <p>Lewis leads by <b>14 points</b>.</p>
          </div>
          <div className="sample-recap-grid">
            <div>
              <span>Gameweek scorer</span>
              <strong>Expected Toulouse</strong>
              <small>82 pts</small>
            </div>
            <div>
              <span>Biggest climber</span>
              <strong>No Kane No Gain</strong>
              <small>↑ 3 places</small>
            </div>
          </div>
          <p className="sample-banter">
            Lewis has the bragging rights. Everyone else has a deadline to do
            something about it.
          </p>
          <div className="sample-watermark">footy · league edge</div>
        </aside>
      </section>

      <section className="shell league-edge-promise">
        <article>
          <span>01</span>
          <strong>Your league first</strong>
          <p>Your rivals, your gap and your next move.</p>
        </article>
        <article>
          <span>02</span>
          <strong>Show the why</strong>
          <p>Every recommendation explains the rivals and fixtures behind it.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Group-chat ready</strong>
          <p>A recap designed to be shared every Gameweek.</p>
        </article>
        <article>
          <span>04</span>
          <strong>Honest numbers</strong>
          <p>Predictions are frozen before deadlines and checked afterwards.</p>
        </article>
      </section>

      <section className="shell league-edge-section" id="how-it-works">
        <div className="league-edge-section-head">
          <span className="eyebrow">How it works</span>
          <h2>Connect once. Footy does the rest.</h2>
        </div>
        <div className="league-edge-steps">
          <article>
            <span>1</span>
            <h3>Paste your league ID</h3>
            <p>Footy connects to the public classic-league data. No login needed.</p>
          </article>
          <article>
            <span>2</span>
            <h3>We track the battle</h3>
            <p>Standings, squads, captains, chips and Gameweek movement sync automatically.</p>
          </article>
          <article>
            <span>3</span>
            <h3>We rank your moves</h3>
            <p>Transfers, captaincy and chips are judged by how they change your chance of winning this league.</p>
          </article>
          <article>
            <span>4</span>
            <h3>Share the recap</h3>
            <p>After final scoring, Footy builds the weekly league recap automatically.</p>
          </article>
        </div>
      </section>

      <section className="shell decision-preview">
        <div>
          <span className="eyebrow">League-specific decisions</span>
          <h2>The right move depends on who you&apos;re chasing.</h2>
          <p>
            Overall rank treats everyone the same. Footy doesn&apos;t. A manager
            18 points behind needs a different decision from the leader protecting
            a 35-point gap.
          </p>
        </div>
        <div className="decision-preview-grid">
          <article>
            <span>CHASER</span>
            <strong>Close the gap</strong>
            <p>Higher-upside transfers and captain pivots when you need ground.</p>
          </article>
          <article>
            <span>LEADER</span>
            <strong>Protect the lead</strong>
            <p>Cover the rivals most likely to overtake you and their key players.</p>
          </article>
          <article>
            <span>CHIPS</span>
            <strong>Time them against rivals</strong>
            <p>See who still has chips and which windows can swing your league.</p>
          </article>
        </div>
      </section>

      <section className="shell receipts-preview" id="receipts">
        <div>
          <span className="eyebrow">Receipts</span>
          <h2>No pretending we knew it afterwards.</h2>
          <p>
            Footy freezes league-win probabilities and top moves before the
            deadline. After scoring finalises, we record what happened and keep
            the misses visible.
          </p>
        </div>
        <div className="receipt-demo">
          <span>GW6 · frozen before deadline</span>
          <div>
            <strong>Bench Warmers FC</strong>
            <b>41%</b>
          </div>
          <div>
            <strong>Expected Toulouse</strong>
            <b>27%</b>
          </div>
          <div>
            <strong>No Kane No Gain</strong>
            <b>18%</b>
          </div>
          <small>Illustrative layout — real receipts appear from connected leagues.</small>
        </div>
      </section>

      <section className="shell league-edge-pricing" id="pricing">
        <div className="league-edge-section-head">
          <span className="eyebrow">One season. One price.</span>
          <h2>Founding passes</h2>
          <p>No auto-renew. Paid features unlock as they ship.</p>
        </div>
        <div className="edge-price-grid">
          <article>
            <span>FREE</span>
            <h3>£0</h3>
            <p>League connect, standings and weekly recap.</p>
            <ul>
              <li>Classic league connect</li>
              <li>Live standings snapshot</li>
              <li>Weekly recap</li>
              <li>Shareable league link</li>
            </ul>
            <LeagueConnectForm compact />
          </article>
          <article className="featured">
            <span>FOUNDING PLAYER PASS</span>
            <h3>£9.99 <small>this season</small></h3>
            <p>For the manager who wants the move that improves their league position.</p>
            <ul>
              <li>Move ranking</li>
              <li>Chase / protect mode</li>
              <li>Rival chip tracker</li>
              <li>Chip planner</li>
              <li>Receipts detail</li>
            </ul>
            <Link href="/pro">See Player Pass →</Link>
          </article>
          <article>
            <span>FOUNDING LEAGUE PASS</span>
            <h3>£29 <small>up to 12 managers</small></h3>
            <p>For the commissioner who wants the whole league involved.</p>
            <ul>
              <li>Player Pass features</li>
              <li>12 league seats</li>
              <li>Commissioner tools</li>
              <li>Recap badge</li>
            </ul>
            <Link href="/pro">See League Pass →</Link>
          </article>
        </div>
      </section>

      <footer className="shell footer">
        <p>
          Footy is unofficial and not affiliated with the Premier League or
          Fantasy Premier League. Probabilities are estimates, not guarantees.
        </p>
        <p>CONNECT → COMPARE → DECIDE → RECAP</p>
      </footer>
    </main>
  );
}
