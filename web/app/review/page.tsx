import Link from "next/link";
import { getLeagueReceiptSummary } from "@/lib/league-receipts";

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function outcomeCopy(
  outcome: "SUPPORTED" | "MIXED" | "AGAINST" | "AWAITING",
) {
  if (outcome === "SUPPORTED") return "Outcome supported the call";
  if (outcome === "AGAINST") return "Outcome went against the call";
  if (outcome === "MIXED") return "Mixed outcome";
  return "Awaiting Gameweek outcome";
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string | string[];
    league?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : undefined;
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : undefined;
  const summary = await getLeagueReceiptSummary({
    entryId: teamId,
    leagueId,
  });

  return (
    <main className="league-edge-app minimal-footy review-page">
      <nav className="nav shell minimal-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span><span>Footy</span>
        </Link>
        <div className="nav-links">
          {teamId ? (
            <Link
              href={`/team/${teamId}?view=today${leagueId ? `&league=${leagueId}` : ""}`}
            >
              Back to team
            </Link>
          ) : (
            <Link href="/">Connect team</Link>
          )}
        </div>
      </nav>

      <section className="shell review-hero">
        <span>GAMEWEEK REVIEW</span>
        <h1>What happened — and what should Footy learn?</h1>
        <p>
          The recommendation is frozen before the deadline. Review shows the
          call, the manager action, the one-Gameweek outcome and the lesson
          without rewriting history.
        </p>
      </section>

      <section className="shell review-summary">
        <article>
          <span>Reviewed</span>
          <strong>{summary.scoredCalls}</strong>
          <small>completed Gameweek debriefs</small>
        </article>
        <article>
          <span>Plan followed</span>
          <strong>{pct(summary.adherenceRate)}</strong>
          <small>top-three recommendation adoption</small>
        </article>
        <article>
          <span>Captain</span>
          <strong>{summary.captainTop3}</strong>
          <small>top-three captain calls followed</small>
        </article>
        <article>
          <span>Transfer</span>
          <strong>{summary.transferTop3}</strong>
          <small>top-three transfer calls followed</small>
        </article>
      </section>

      <section className="shell review-list">
        <div className="review-section-head">
          <div>
            <span>DEBRIEFS</span>
            <h2>Latest Gameweeks</h2>
          </div>
          <p>
            A single Gameweek never proves a model. Review separates outcome
            variance from repeatable decision quality.
          </p>
        </div>

        {!teamId ? (
          <div className="review-empty">
            <strong>Connect your team to open Review.</strong>
            <p>
              Review is personal to your FPL team and, where selected, your
              mini-league battle. Open Footy through your Team ID first.
            </p>
            <Link href="/">Connect team →</Link>
          </div>
        ) : summary.reviews.length ? (
          <div className="review-cards">
            {summary.reviews.map((review) => {
              const transfer = review.transfer.recommended;
              const actualIncoming = review.transfer.actualIncoming
                .map((player) => player.name)
                .join(", ");

              return (
                <article className="review-card" key={review.id}>
                  <header>
                    <div>
                      <span>GW{review.event}</span>
                      <strong>{outcomeCopy(review.outcome)}</strong>
                    </div>
                    <b className={`review-state state-${review.outcome.toLowerCase()}`}>
                      {review.status === "AWAITING" ? "OPEN" : "REVIEWED"}
                    </b>
                  </header>

                  <div className="review-decision-grid">
                    <section>
                      <span>FOOTY'S CALL</span>
                      <h3>
                        {transfer?.in
                          ? `${transfer.out.name} → ${transfer.in.name}`
                          : "Hold the transfer"}
                      </h3>
                      <p>
                        Captain{" "}
                        <b>{review.captain.recommended?.name ?? "—"}</b>
                        {transfer?.reason ? ` · ${transfer.reason}` : ""}
                      </p>
                    </section>

                    <section>
                      <span>WHAT YOU DID</span>
                      <h3>
                        {review.captain.actual?.name
                          ? `Captain ${review.captain.actual.name}`
                          : review.status === "AWAITING"
                            ? "Waiting for deadline data"
                            : "Action unavailable"}
                      </h3>
                      <p>
                        {actualIncoming
                          ? `Incoming: ${actualIncoming}`
                          : review.transfer.followedTop3 === true
                            ? "Transfer matched Footy's shortlist."
                            : review.status === "AWAITING"
                              ? "Post-deadline transfer data will appear here."
                              : "No matching incoming transfer recorded."}
                      </p>
                    </section>

                    <section>
                      <span>ONE-GW OUTCOME</span>
                      <h3>
                        {review.captain.recommendedPoints != null
                          ? `${review.captain.recommended?.name ?? "Captain"} ${review.captain.recommendedPoints} pts`
                          : "Not scored yet"}
                      </h3>
                      <p>
                        {review.transfer.recommendedInPoints != null &&
                        review.transfer.recommendedOutPoints != null
                          ? `${transfer?.in?.name ?? "Incoming"} ${review.transfer.recommendedInPoints} pts · ${transfer?.out.name ?? "Outgoing"} ${review.transfer.recommendedOutPoints} pts`
                          : "Transfer outcome will be shown when official FPL scoring is available."}
                      </p>
                    </section>
                  </div>

                  <div className="review-lesson">
                    <span>ASSISTANT REVIEW</span>
                    <strong>{review.lesson}</strong>
                  </div>

                  <details className="review-audit">
                    <summary>Show audit trail</summary>
                    <div>
                      <p>
                        Pre-deadline snapshot:{" "}
                        {new Date(review.generatedAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p>
                        Captain shortlist followed:{" "}
                        {review.captain.followedTop3 == null
                          ? "not scored"
                          : review.captain.followedTop3
                            ? "yes"
                            : "no"}
                      </p>
                      <p>
                        Transfer shortlist followed:{" "}
                        {review.transfer.followedTop3 == null
                          ? "not scored"
                          : review.transfer.followedTop3
                            ? "yes"
                            : "no"}
                      </p>
                      <p>
                        Overall recommendation match:{" "}
                        {review.matchedTop3 == null
                          ? "not scored"
                          : review.matchedTop3
                            ? "yes"
                            : "no"}
                      </p>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="review-empty">
            <strong>No completed review yet.</strong>
            <p>
              Footy has frozen {summary.officialCalls} pre-deadline{" "}
              {summary.officialCalls === 1 ? "call" : "calls"}. The first
              completed Gameweek will create the first debrief.
            </p>
          </div>
        )}
      </section>

      <section className="shell review-principles">
        <div>
          <span>HOW TO READ REVIEW</span>
          <h2>Judge decisions, not just scores.</h2>
        </div>
        <div>
          <p><b>Outcome</b> tells you what happened in one Gameweek.</p>
          <p><b>Process</b> asks whether the underlying reasoning was repeatable.</p>
          <p><b>Calibration</b> changes only when the evidence supports a model adjustment.</p>
        </div>
      </section>

      <footer className="shell footer minimal-footer">
        <p>Pre-deadline calls stay frozen.</p>
        <p>BRIEF → ACT → REVIEW → LEARN</p>
      </footer>
    </main>
  );
}
