import type { LeagueReadiness } from "@/lib/betting";

function stageLabel(stage: LeagueReadiness["stage"]) {
  if (stage === "BETTING_READY") return "BETTING READY";
  if (stage === "PRICE_WATCH") return "PRICE WATCH";
  if (stage === "MODEL_RESEARCH") return "MODEL RESEARCH";
  if (stage === "PROCESS_READY") return "PROCESS READY";
  if (stage === "MARKET_LIVE") return "MARKET LIVE · MODEL PENDING";
  return "FIXTURES ONLY";
}

function dot(ok: boolean, warn = false) {
  return ok ? (warn ? "△" : "●") : "○";
}

export function LeagueReadinessMap({
  leagues,
}: {
  leagues: LeagueReadiness[];
}) {
  const modelled = leagues.filter((row) => row.modelledFixtures > 0).length;
  const processReady = leagues.filter(
    (row) => row.processStatus !== "MISSING",
  ).length;

  return (
    <section className="betting-section readiness-section">
      <div className="betting-section-head">
        <div>
          <span>02 / COVERAGE MAP</span>
          <h2>Where Footy can actually price the slate</h2>
        </div>
        <p>
          {leagues.length} competitions · {processReady} with process data ·{" "}
          {modelled} with a current model
        </p>
      </div>

      <div className="readiness-legend">
        <span><b>●</b> ready</span>
        <span><b>△</b> usable with caution</span>
        <span><b>○</b> not available</span>
      </div>

      <div className="readiness-list">
        {leagues.map((row) => (
          <article key={row.league}>
            <div className="readiness-league">
              <strong>{row.league}</strong>
              <small>
                {row.fixtures} today · {row.modelledFixtures} modelled ·{" "}
                {row.modelScope === "CORE" ? "core model" : "coverage only"}
              </small>
            </div>

            <div
              className="readiness-chain"
              aria-label={row.league + " readiness"}
            >
              <span className="ready">
                <b>●</b>
                Fixtures
              </span>
              <span
                className={
                  row.processStatus === "PASS"
                    ? "ready"
                    : row.processStatus === "WARN"
                      ? "warn"
                      : ""
                }
              >
                <b>
                  {dot(
                    row.processStatus !== "MISSING",
                    row.processStatus === "WARN",
                  )}
                </b>
                Process
              </span>
              <span className={row.modelledFixtures > 0 ? "ready" : ""}>
                <b>{dot(row.modelledFixtures > 0)}</b>
                Model
              </span>
              <span
                className={
                  row.validationStatus === "APPROVED"
                    ? "ready"
                    : row.validationStatus !== "MISSING"
                      ? "warn"
                      : ""
                }
              >
                <b>
                  {dot(
                    row.validationStatus !== "MISSING",
                    row.validationStatus !== "APPROVED",
                  )}
                </b>
                Validate
              </span>
              <span className={row.freshPricedSelections > 0 ? "ready" : ""}>
                <b>{dot(row.freshPricedSelections > 0)}</b>
                Prices
              </span>
            </div>

            <em
              className={
                "readiness-stage readiness-" + row.stage.toLowerCase()
              }
            >
              {stageLabel(row.stage)}
            </em>
          </article>
        ))}
      </div>

      <p className="readiness-note">
        Footy&apos;s modelling core is limited to the top two domestic divisions
        in England, Spain, Germany, Italy and France. Other competitions can still
        show fixtures and live prices, but remain coverage-only and cannot enter
        value bets or accas.
      </p>
    </section>
  );
}
