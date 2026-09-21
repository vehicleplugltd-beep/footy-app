import type { DailyGamePrediction, BettingSelection } from "@/lib/betting";
import { decimalToFractional, minimumTakeToFractional } from "@/lib/odds";
import { WatchPriceButton } from "@/components/watch-price-button";

function pct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(1)}%`;
}

function displayTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function movement(selection: BettingSelection) {
  const current = selection.williamHillPrice?.decimal_odds;
  const previous = selection.williamHillPrice?.previous_decimal_odds;
  if (!current || !previous || current === previous) return null;
  const direction = current > previous ? "drifted" : "shortened";
  return `WH ${direction} ${decimalToFractional(previous)} → ${decimalToFractional(current)}`;
}

function priceCoach(selection: BettingSelection | null) {
  if (!selection) return "No model price is available yet.";
  const current = selection.williamHillPrice?.decimal_odds ?? null;
  const take = selection.minimumTakePrice;

  if (!current) {
    return `Take ${minimumTakeToFractional(take)} or bigger. Current William Hill price is not verified.`;
  }
  if (current >= take) {
    return `Price clears the line: ${decimalToFractional(current)} is acceptable versus ${minimumTakeToFractional(take)}+.`;
  }
  return `Do not chase. Wait for ${minimumTakeToFractional(take)} or bigger; William Hill is ${decimalToFractional(current)}.`;
}

function OutcomeRow({ outcome }: { outcome: BettingSelection }) {
  const current = outcome.williamHillPrice?.decimal_odds ?? null;
  return (
    <div className="daily-outcome-row">
      <div>
        <strong>{outcome.displaySelection}</strong>
        <small>{outcome.selection.toUpperCase()}</small>
      </div>
      <p><span>Model</span><b>{pct(outcome.modelProbability)}</b></p>
      <p><span>Fair</span><b>{decimalToFractional(outcome.fairOdds)}</b><small>{outcome.fairOdds.toFixed(2)}</small></p>
      <p className="daily-take"><span>Accept</span><b>{minimumTakeToFractional(outcome.minimumTakePrice)}+</b><small>{outcome.minimumTakePrice.toFixed(2)}+</small></p>
      <p><span>WH</span><b>{current ? decimalToFractional(current) : "—"}</b><small>{current ? current.toFixed(2) : "not verified"}</small></p>
      <em className={`edge-verdict edge-verdict-${outcome.verdict.toLowerCase()}`}>{outcome.verdict}</em>
    </div>
  );
}

export function DailyPredictions({ games }: { games: DailyGamePrediction[] }) {
  return (
    <section className="betting-section daily-board" id="today">
      <div className="betting-section-head">
        <div>
          <span>01 / TODAY&apos;S GAMES</span>
          <h2>Prediction first. Price decision second.</h2>
        </div>
        <p>All modelled games are shown — including PASS and WATCH.</p>
      </div>

      {games.length ? (
        <div className="daily-game-grid">
          {games.map((game) => {
            const oneXTwo = game.outcomes
              .filter((row) => row.market === "1X2")
              .sort((a, b) => b.modelProbability - a.modelProbability);
            const modelPick = oneXTwo[0] ?? game.modelPick;
            const move = modelPick ? movement(modelPick) : null;

            return (
              <article className="daily-game-card" key={game.matchId}>
                <header>
                  <div>
                    <span>{game.league} · {displayTime(game.kickoffAt)}</span>
                    <h3>{game.homeTeam} <i>vs</i> {game.awayTeam}</h3>
                  </div>
                  <div className="daily-model-lean">
                    <small>MODEL LEAN</small>
                    <strong>{modelPick?.displaySelection ?? "Awaiting model"}</strong>
                    <b>{modelPick ? pct(modelPick.modelProbability) : "—"}</b>
                  </div>
                </header>

                <div className="daily-xg-strip">
                  <span>Expected scoring</span>
                  <strong>
                    {game.homeXg == null || game.awayXg == null
                      ? "Model xG pending"
                      : `${game.homeTeam} ${game.homeXg.toFixed(2)} — ${game.awayXg.toFixed(2)} ${game.awayTeam}`}
                  </strong>
                </div>

                {oneXTwo.length ? (
                  <div className="daily-outcomes">
                    {oneXTwo.map((outcome) => (
                      <OutcomeRow
                        key={`${outcome.matchId}:${outcome.market}:${outcome.selection}`}
                        outcome={outcome}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="daily-pending">
                    Fixture is on the board, but a current 1X2 model run has not been published.
                  </div>
                )}

                <footer className="price-coach">
                  <div>
                    <span>PRICE COACH</span>
                    <strong>{priceCoach(modelPick)}</strong>
                    {move ? <small>{move}</small> : null}
                  </div>
                  {modelPick ? (
                    <WatchPriceButton
                      matchId={modelPick.matchId}
                      eventName={`${modelPick.homeTeam} vs ${modelPick.awayTeam}`}
                      market={modelPick.market}
                      selection={modelPick.selection}
                      targetOdds={modelPick.minimumTakePrice}
                    />
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="betting-empty">
          <strong>No modelled games on today&apos;s board.</strong>
          <p>
            Footy still keeps the daily surface visible. As fixture coverage expands,
            every analysed match will appear here whether or not it produces a bet.
          </p>
        </div>
      )}
    </section>
  );
}
