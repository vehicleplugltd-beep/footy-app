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
  const current = selection.bestPrice?.decimal_odds;
  const previous = selection.bestPrice?.previous_decimal_odds;
  if (!current || !previous || current === previous) return null;
  const direction = current > previous ? "drifted" : "shortened";
  return `Best price ${direction} ${decimalToFractional(previous)} → ${decimalToFractional(current)}`;
}

function priceCoach(selection: BettingSelection | null) {
  if (!selection) return "No model price is available yet.";
  const current = selection.bestPrice?.decimal_odds ?? null;
  const take = selection.minimumTakePrice;

  if (!current) {
    return `Take ${minimumTakeToFractional(take)} or bigger. No fresh verified market price is available.`;
  }
  if (current >= take) {
    return `Price clears the line: ${decimalToFractional(current)} is acceptable versus ${minimumTakeToFractional(take)}+.`;
  }
  return `Do not chase. Wait for ${minimumTakeToFractional(take)} or bigger; best verified is ${decimalToFractional(current)}.`;
}

function OutcomeRow({ outcome }: { outcome: BettingSelection }) {
  const current = outcome.bestPrice?.decimal_odds ?? null;
  return (
    <div className="daily-outcome-row">
      <div>
        <strong>{outcome.displaySelection}</strong>
        <small>{outcome.selection.toUpperCase()}</small>
      </div>
      <p><span>Model</span><b>{pct(outcome.modelProbability)}</b></p>
      <p><span>Fair</span><b>{decimalToFractional(outcome.fairOdds)}</b><small>{outcome.fairOdds.toFixed(2)}</small></p>
      <p className="daily-take"><span>Accept</span><b>{minimumTakeToFractional(outcome.minimumTakePrice)}+</b><small>{outcome.minimumTakePrice.toFixed(2)}+</small></p>
      <p><span>Best</span><b>{current ? decimalToFractional(current) : "—"}</b><small>{current ? outcome.bestPrice?.bookmaker_name ?? current.toFixed(2) : "not verified"}</small></p>
      <em className={`edge-verdict edge-verdict-${outcome.verdict.toLowerCase()}`}>{outcome.verdict}</em>
    </div>
  );
}

export function DailyPredictions({ games }: { games: DailyGamePrediction[] }) {
  const groups = new Map<string, DailyGamePrediction[]>();
  for (const game of games) {
    const rows = groups.get(game.league) ?? [];
    rows.push(game);
    groups.set(game.league, rows);
  }

  const grouped = [...groups.entries()]
    .map(([league, rows]) => ({
      league,
      games: rows.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
      modelled: rows.filter((game) => game.outcomes.length > 0).length,
      priced: rows.filter((game) => game.coveragePrices.length > 0).length,
    }))
    .sort(
      (a, b) =>
        b.modelled - a.modelled ||
        b.priced - a.priced ||
        b.games.length - a.games.length ||
        a.league.localeCompare(b.league),
    );

  const modelledCount = games.filter((game) => game.outcomes.length > 0).length;
  const pricedCount = games.filter((game) => game.coveragePrices.length > 0).length;

  return (
    <section className="betting-section daily-board" id="today">
      <div className="betting-section-head">
        <div>
          <span>01 / TODAY&apos;S GAMES</span>
          <h2>{games.length} fixtures across {grouped.length} competitions</h2>
        </div>
        <p>
          {modelledCount} modelled · {pricedCount} with fresh prices · {games.length - modelledCount} coverage-only.
          Market visibility never implies a betting recommendation.
        </p>
      </div>

      {games.length ? (
        <details className="today-coverage-drawer" open={modelledCount > 0}>
          <summary>
            {modelledCount > 0
              ? `Browse today's ${modelledCount} modelled fixtures and remaining coverage`
              : `Browse today's ${games.length} coverage-only fixtures`}
          </summary>
        <div className="league-board-list">
          {grouped.map((group, groupIndex) => (
            <details
              className="league-board"
              key={group.league}
              open={group.modelled > 0 || (group.priced > 0 && groupIndex < 2)}
            >
              <summary>
                <div>
                  <strong>{group.league}</strong>
                  <small>{group.games.length} fixture{group.games.length === 1 ? "" : "s"}</small>
                </div>
                <span>
                  {group.modelled
                    ? `${group.modelled} modelled · ${group.priced} priced`
                    : group.priced
                      ? `${group.priced} priced`
                      : "coverage only"}
                </span>
              </summary>

              <div className="league-board-games">
                {group.games.map((game) => {
                  const oneXTwo = game.outcomes
                    .filter((row) => row.market === "1X2")
                    .sort((a, b) => b.modelProbability - a.modelProbability);
                  const modelPick = oneXTwo[0] ?? game.modelPick;
                  const move = modelPick ? movement(modelPick) : null;

                  if (!game.outcomes.length) {
                    return (
                      <article className="coverage-fixture-row" key={game.matchId}>
                        <time>{displayTime(game.kickoffAt)}</time>
                        <div className="coverage-fixture-teams">
                          <strong>{game.homeTeam}</strong>
                          <span>vs</span>
                          <strong>{game.awayTeam}</strong>
                        </div>

                        {game.coveragePrices.length ? (
                          <div
                            className="coverage-live-prices"
                            aria-label="Best fresh 1X2 market prices"
                          >
                            {game.coveragePrices.map((quote) => (
                              <p key={quote.selection}>
                                <span>
                                  {quote.selection === "home"
                                    ? "H"
                                    : quote.selection === "draw"
                                      ? "D"
                                      : "A"}
                                </span>
                                <strong>
                                  {decimalToFractional(quote.decimalOdds)}
                                </strong>
                                <small>{quote.bookmakerName}</small>
                              </p>
                            ))}
                          </div>
                        ) : null}

                        <em>
                          MODEL PENDING
                          {game.coveragePrices.length ? " · MARKET LIVE" : ""}
                        </em>
                      </article>
                    );
                  }

                  return (
                    <article className="daily-game-card" key={game.matchId}>
                      <header>
                        <div>
                          <span>{displayTime(game.kickoffAt)}</span>
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
            </details>
          ))}
        </div>
        </details>
      ) : (
        <div className="betting-empty">
          <strong>No football fixtures were discovered for today.</strong>
          <p>
            Footy checks both stored fixtures and the live global discovery feed.
            We do not invent a slate when those sources are unavailable.
          </p>
        </div>
      )}
    </section>
  );
}
