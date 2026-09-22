"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AccaCandidate,
  BettingSelection,
  DailyGamePrediction,
} from "@/lib/betting";
import { decimalToFractional, minimumTakeToFractional } from "@/lib/odds";

function pct(value: number | null | undefined, digits = 0) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(digits)}%`;
}

function monogram(team: string) {
  const words = team.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function strongestSelection(todayGames: DailyGamePrediction[]) {
  const pool = todayGames.flatMap((game) => game.outcomes);
  const verdictWeight = { BET: 4, WATCH: 3, PASS: 2, FADE: 1 };

  return [...pool].sort(
    (a, b) =>
      verdictWeight[b.verdict] - verdictWeight[a.verdict] ||
      (b.edge ?? -99) - (a.edge ?? -99) ||
      b.modelProbability - a.modelProbability,
  )[0] ?? null;
}

function evidence(selection: BettingSelection) {
  const items: string[] = [];
  if (selection.homeXg != null && selection.awayXg != null) {
    items.push(
      `Model scoring: ${selection.homeTeam} ${selection.homeXg.toFixed(2)} – ${selection.awayXg.toFixed(2)} ${selection.awayTeam}.`,
    );
  }

  const home = selection.homeProcess;
  const away = selection.awayProcess;
  if (home?.xg != null && away?.xga != null) {
    items.push(
      `Recent process: ${selection.homeTeam} ${home.xg.toFixed(2)} xG vs ${selection.awayTeam} ${away.xga.toFixed(2)} xGA across the available sample.`,
    );
  }

  if (selection.bookmakerQuotes.length) {
    const best = selection.bookmakerQuotes[0];
    items.push(
      `Best live quote: ${best.bookmakerName} ${decimalToFractional(best.decimalOdds)}; Footy take line ${minimumTakeToFractional(selection.minimumTakePrice)}+.`,
    );
  } else {
    items.push(selection.verdictReason);
  }

  return items.slice(0, 3);
}

function changeLine(selection: BettingSelection) {
  const pieces: string[] = [];
  if (
    selection.modelProbabilityDelta != null &&
    Math.abs(selection.modelProbabilityDelta) >= 0.001
  ) {
    const pp = selection.modelProbabilityDelta * 100;
    pieces.push(`Model ${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`);
  }

  const quote = selection.bestPrice;
  if (
    quote?.previous_decimal_odds != null &&
    Number(quote.previous_decimal_odds) !== Number(quote.decimal_odds)
  ) {
    pieces.push(
      `Price ${decimalToFractional(Number(quote.previous_decimal_odds))} → ${decimalToFractional(Number(quote.decimal_odds))}`,
    );
  }

  return pieces.length ? pieces.join(" · ") : "No meaningful movement since the prior snapshot.";
}

function priceLabel(selection: BettingSelection) {
  const quote = selection.bestPrice;
  return quote ? decimalToFractional(Number(quote.decimal_odds)) : "—";
}

function signalLabel(selection: BettingSelection) {
  if (selection.verdict === "BET") return "TODAY'S BEST VALUE";
  if (selection.verdict === "WATCH") return "STRONGEST WATCH";
  return "STRONGEST MODEL LEAN";
}

export function DecisionFeed({
  todayGames,
  accas,
  upcomingModelledCount,
}: {
  todayGames: DailyGamePrediction[];
  accas: AccaCandidate[];
  upcomingModelledCount: number;
}) {
  const [mode, setMode] = useState<"daily" | "acca">("daily");
  const actionableToday = todayGames.filter(
    (game) => game.outcomes.length > 0 || game.coveragePrices.length > 0,
  );
  const signal = useMemo(
    () => strongestSelection(todayGames),
    [todayGames],
  );
  const todayKey = todayGames[0]
    ? new Date(todayGames[0].kickoffAt).toLocaleDateString("en-CA", {
        timeZone: "Europe/London",
      })
    : null;
  const bestAcca =
    accas.find(
      (acca) =>
        todayKey != null &&
        acca.legs.every(
          (leg) =>
            new Date(leg.kickoffAt).toLocaleDateString("en-CA", {
              timeZone: "Europe/London",
            }) === todayKey,
        ),
    ) ?? null;

  return (
    <section className="decision-feed shell">
      <div className="decision-feed-heading">
        <div>
          <span>TODAY</span>
          <h2>Football, priced properly.</h2>
        </div>
        <Link href="/betting/tools">Bet Analyzer ↗</Link>
      </div>

      {todayGames.length ? (
        <>
        <div className="today-coverage-count">
          <strong>{todayGames.length}</strong>
          <span>fixtures discovered today · {actionableToday.length} with a model or verified price</span>
        </div>
        {actionableToday.length ? (
        <div className="today-match-strip" aria-label="Today's modelled or priced matches">
          {[...actionableToday]
            .sort((a, b) =>
              Number(b.outcomes.length > 0) - Number(a.outcomes.length > 0) ||
              Number(b.coveragePrices.length > 0) - Number(a.coveragePrices.length > 0) ||
              a.kickoffAt.localeCompare(b.kickoffAt)
            )
            .slice(0, 12)
            .map((game) => (
            <article key={game.matchId}>
              <span>
                {new Date(game.kickoffAt).toLocaleTimeString("en-GB", {
                  timeZone: "Europe/London",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div>
                <b>{monogram(game.homeTeam)}</b>
                <i>v</i>
                <b>{monogram(game.awayTeam)}</b>
              </div>
              <strong>
                {game.modelPick?.displaySelection ?? "Model pending"}
              </strong>
              <small>
                {game.modelPick
                  ? `${pct(game.modelPick.modelProbability)} · take ${minimumTakeToFractional(game.modelPick.minimumTakePrice)}+`
                  : game.coveragePrices.length
                    ? "1X2 market live"
                    : "Market not verified"}
              </small>
            </article>
          ))}
        </div>
        ) : (
          <p className="today-slate-note">
            Today's fixtures are coverage-only. The next modelled research fixtures are listed above.
          </p>
        )}
        </>
      ) : null}

      <div className="decision-mode-tabs" role="tablist" aria-label="Bet mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "daily"}
          className={mode === "daily" ? "active" : undefined}
          onClick={() => setMode("daily")}
        >
          Daily
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "acca"}
          className={mode === "acca" ? "active" : undefined}
          onClick={() => setMode("acca")}
        >
          Accumulators
        </button>
      </div>

      {mode === "daily" ? (
        signal ? (
          <article className="signal-hero">
            <header>
              <div>
                <span>{signalLabel(signal)}</span>
                <strong>{signal.displaySelection}</strong>
                <small>{signal.market} · {signal.homeTeam} vs {signal.awayTeam}</small>
              </div>
              <em className={`edge-verdict edge-verdict-${signal.verdict.toLowerCase()}`}>
                {signal.verdict}
              </em>
            </header>

            <div className="signal-matchup">
              <div className="signal-team">
                <b>{monogram(signal.homeTeam)}</b>
                <span>{signal.homeTeam}</span>
              </div>
              <div
                className="signal-probability"
                style={{ "--signal-prob": `${Math.round(signal.modelProbability * 100)}%` } as React.CSSProperties}
              >
                <strong>{pct(signal.modelProbability)}</strong>
                <span>Model</span>
              </div>
              <div className="signal-team">
                <b>{monogram(signal.awayTeam)}</b>
                <span>{signal.awayTeam}</span>
              </div>
            </div>

            <div className="signal-price-grid">
              <div><span>Fair</span><strong>{decimalToFractional(signal.fairOdds)}</strong><small>{signal.fairOdds.toFixed(2)}</small></div>
              <div className="signal-take"><span>Accept</span><strong>{minimumTakeToFractional(signal.minimumTakePrice)}+</strong><small>{signal.minimumTakePrice.toFixed(2)}+</small></div>
              <div><span>Live</span><strong>{priceLabel(signal)}</strong><small>{signal.bestPrice?.bookmaker_name ?? "not verified"}</small></div>
              <div><span>EV</span><strong>{signal.edge == null ? "—" : `${signal.edge >= 0 ? "+" : ""}${(signal.edge * 100).toFixed(1)}%`}</strong><small>at checked price</small></div>
            </div>

            <div className="signal-change">
              <span>WHAT CHANGED</span>
              <strong>{changeLine(signal)}</strong>
            </div>

            <div className="signal-insights">
              <span>KEY EVIDENCE</span>
              {evidence(signal).map((item, index) => (
                <p key={item}><b>{index + 1}</b>{item}</p>
              ))}
            </div>

            {signal.bookmakerQuotes.length > 1 ? (
              <div className="line-shop">
                <span>LINE SHOP</span>
                <div>
                  {signal.bookmakerQuotes.slice(0, 4).map((quote) => (
                    <p key={`${quote.bookmakerKey}:${quote.decimalOdds}`}>
                      <small>{quote.bookmakerName}</small>
                      <strong>{decimalToFractional(quote.decimalOdds)}</strong>
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="signal-actions">
              <a href="#today">Full analysis</a>
              <Link href="/betting/tools">Check another price</Link>
            </div>
          </article>
        ) : (
          <div className="betting-empty">
            <strong>No model-qualified selection for today's fixtures.</strong>
            <p>
              {upcomingModelledCount > 0
                ? `${upcomingModelledCount} upcoming fixtures have research probabilities above. Today's global fixtures remain coverage-only until a verified model and price exist.`
                : "Footy will not invent a forecast or claim that a market is verified."}
            </p>
            <a href="#next-modelled">View the next modelled fixtures →</a>
          </div>
        )
      ) : bestAcca ? (
        <article className="signal-hero acca-signal-hero">
          <header>
            <div>
              <span>BEST QUALIFYING {bestAcca.label.toUpperCase()}</span>
              <strong>{decimalToFractional(bestAcca.combinedOdds)}</strong>
              <small>{bestAcca.legCount} independently qualifying legs</small>
            </div>
            <em>BET</em>
          </header>
          <div className="signal-acca-legs">
            {bestAcca.legs.map((leg, index) => (
              <p key={leg.matchId}>
                <b>{index + 1}</b>
                <span><strong>{leg.displaySelection}</strong><small>{leg.homeTeam} vs {leg.awayTeam}</small></span>
                <em>{decimalToFractional(Number(leg.bestPrice?.decimal_odds))}</em>
              </p>
            ))}
          </div>
          <div className="signal-price-grid">
            <div><span>Model</span><strong>{pct(bestAcca.modelProbability, 1)}</strong></div>
            <div><span>Fair</span><strong>{decimalToFractional(bestAcca.fairOdds)}</strong></div>
            <div className="signal-take"><span>Accept</span><strong>{minimumTakeToFractional(bestAcca.minimumTakePrice)}+</strong></div>
            <div><span>EV</span><strong>+{(bestAcca.edge * 100).toFixed(1)}%</strong></div>
          </div>
          <div className="signal-actions">
            <a href="#accas">View all accas</a>
            <Link href="/betting/tools">Build / diagnose slip</Link>
          </div>
        </article>
      ) : (
        <div className="betting-empty">
          <strong>No accumulator qualifies for today.</strong>
          <p>Footy will not pull future legs or add a filler favourite just to produce a multiple.</p>
        </div>
      )}
    </section>
  );
}
