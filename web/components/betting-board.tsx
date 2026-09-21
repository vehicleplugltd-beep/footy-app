import type { AccaCandidate, BettingSelection, ProcessProfile } from "@/lib/betting";
import { decimalToFractional, minimumTakeToFractional } from "@/lib/odds";

function pct(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function num(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function processLine(profile: ProcessProfile | null, side: "attack" | "defence") {
  if (!profile) return "Reliable current process data unavailable.";
  if (side === "attack") {
    return `${profile.sample} match sample · xG ${num(profile.xg)} · npxG ${num(profile.npxg)} · shots ${num(profile.shots, 1)} · SOT ${num(profile.shotsOnTarget, 1)} · big chances ${num(profile.bigChances, 1)} · box touches ${num(profile.boxTouches, 1)}`;
  }
  return `${profile.sample} match sample · xGA ${num(profile.xga)} · npxGA ${num(profile.npxga)} · big chances allowed ${num(profile.bigChancesConceded, 1)} · PPDA ${num(profile.ppda, 1)} · field tilt ${pct(profile.fieldTilt != null ? profile.fieldTilt / 100 : null, 0)}`;
}

function MatchSelectionCard({ selection }: { selection: BettingSelection }) {
  const edge = selection.edge == null ? null : selection.edge * 100;
  const price = selection.williamHillPrice?.decimal_odds ?? null;
  const best = selection.bestPrice?.decimal_odds ?? null;

  return (
    <article className={`edge-card edge-card-${selection.verdict.toLowerCase()}`}>
      <header className="edge-card-head">
        <div>
          <span>{selection.league}</span>
          <h3>{selection.homeTeam} <i>vs</i> {selection.awayTeam}</h3>
          <small>
            {new Date(selection.kickoffAt).toLocaleString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        </div>
        <strong className={`edge-verdict edge-verdict-${selection.verdict.toLowerCase()}`}>
          {selection.verdict}
        </strong>
      </header>

      <div className="edge-selection">
        <span>PRIMARY MARKET</span>
        <strong>{selection.displaySelection}</strong>
        <small>{selection.market}</small>
      </div>

      <div className="edge-metrics">
        <div><span>Model</span><strong>{pct(selection.modelProbability)}</strong></div>
        <div><span>Fair</span><strong>{decimalToFractional(selection.fairOdds)}</strong></div>
        <div><span>Min take</span><strong>{minimumTakeToFractional(selection.minimumTakePrice)}+</strong></div>
        <div><span>William Hill</span><strong>{price ? decimalToFractional(price) : "Not verified"}</strong></div>
        <div><span>Best market</span><strong>{best ? decimalToFractional(best) : "—"}</strong></div>
        <div><span>EV</span><strong>{edge == null ? "—" : `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`}</strong></div>
      </div>

      <div className="edge-model-score">
        <span>MODEL SCORE</span>
        <strong>
          {selection.homeXg == null || selection.awayXg == null
            ? "Expected-goals estimate unavailable"
            : `${selection.homeTeam} ${selection.homeXg.toFixed(2)} — ${selection.awayXg.toFixed(2)} ${selection.awayTeam}`}
        </strong>
      </div>

      <details className="edge-evidence">
        <summary>Underlying process & failure mode</summary>
        <div>
          <section>
            <span>{selection.homeTeam} attack</span>
            <p>{processLine(selection.homeProcess, "attack")}</p>
          </section>
          <section>
            <span>{selection.awayTeam} defence</span>
            <p>{processLine(selection.awayProcess, "defence")}</p>
          </section>
          <section>
            <span>Price decision</span>
            <p>{selection.verdictReason}</p>
          </section>
          <section>
            <span>Failure mode</span>
            <p>
              The model can lose through finishing variance, goalkeeper variance,
              red cards, game-state shifts, unavailable lineup information or a
              tactical interaction not captured by the current inputs.
            </p>
          </section>
        </div>
      </details>
    </article>
  );
}

function AccaCard({ acca }: { acca: AccaCandidate }) {
  return (
    <article className="acca-card">
      <header>
        <div>
          <span>{acca.label.toUpperCase()}</span>
          <strong>{decimalToFractional(acca.williamHillOdds)}</strong>
        </div>
        <em>BET</em>
      </header>
      <div className="acca-legs">
        {acca.legs.map((leg, index) => (
          <div key={leg.matchId}>
            <span>{index + 1}</span>
            <p>
              <strong>{leg.displaySelection}</strong>
              <small>{leg.homeTeam} vs {leg.awayTeam} · {decimalToFractional(Number(leg.williamHillPrice?.decimal_odds))}</small>
            </p>
          </div>
        ))}
      </div>
      <div className="acca-metrics">
        <span>Model {pct(acca.modelProbability)}</span>
        <span>Fair {decimalToFractional(acca.fairOdds)}</span>
        <span>Min take {minimumTakeToFractional(acca.minimumTakePrice)}+</span>
        <span>EV +{(acca.edge * 100).toFixed(1)}%</span>
      </div>
      <p>
        Every leg independently clears its own take price. Cross-match uncertainty
        is additionally haircut before the combined price is approved.
      </p>
    </article>
  );
}

export function BettingBoard({
  selections,
  accas,
}: {
  selections: BettingSelection[];
  accas: AccaCandidate[];
}) {
  const bets = selections.filter((row) => row.verdict === "BET");
  const watches = selections.filter((row) => row.verdict === "WATCH");

  return (
    <>
      <section className="betting-section" id="singles">
        <div className="betting-section-head">
          <div>
            <span>01 / SINGLES</span>
            <h2>Price-qualified edges</h2>
          </div>
          <p>Model first. Price second. No price edge, no bet.</p>
        </div>

        {bets.length ? (
          <div className="edge-grid">
            {bets.map((selection) => (
              <MatchSelectionCard
                key={`${selection.matchId}:${selection.market}:${selection.selection}`}
                selection={selection}
              />
            ))}
          </div>
        ) : (
          <div className="betting-empty">
            <strong>No BET-rated singles right now.</strong>
            <p>
              Footy will not manufacture a selection. A market appears here only
              when the model is current, the market is approved, William Hill is
              verified and the price clears the uncertainty-adjusted take level.
            </p>
          </div>
        )}

        {watches.length ? (
          <details className="watch-drawer">
            <summary>{watches.length} WATCH signal{watches.length === 1 ? "" : "s"}</summary>
            <div className="edge-grid">
              {watches.map((selection) => (
                <MatchSelectionCard
                  key={`${selection.matchId}:${selection.market}:${selection.selection}:watch`}
                  selection={selection}
                />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className="betting-section" id="accas">
        <div className="betting-section-head">
          <div>
            <span>02 / ACCAS</span>
            <h2>Doubles, trebles & beyond</h2>
          </div>
          <p>No filler legs. One independent +EV selection per match.</p>
        </div>

        {accas.length ? (
          <div className="acca-grid">
            {accas.map((acca) => <AccaCard key={acca.id} acca={acca} />)}
          </div>
        ) : (
          <div className="betting-empty">
            <strong>No acca qualifies at current prices.</strong>
            <p>
              That is a valid model output. Footy only creates a double, treble or
              larger acca when every leg is independently BET-rated and the
              combined William Hill price still clears an additional uncertainty
              margin.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
