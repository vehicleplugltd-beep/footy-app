"use client";

import Link from "next/link";
import type { ManagerResponse } from "@/components/team-room/types";

type PortfolioPlan = NonNullable<ManagerResponse["portfolio_plan"]>;

export function PortfolioPanel({
  portfolioPlan,
  researchHref,
}: {
  portfolioPlan: PortfolioPlan;
  researchHref: string;
}) {
  return (
    <section className="team-room-block portfolio-health" id="portfolio">
      <div className="team-room-block-head">
        <div>
          <span>PORTFOLIO HEALTH</span>
          <h2>
            {portfolioPlan.portfolio.score}/100 · {portfolioPlan.portfolio.status}
          </h2>
        </div>
        <small>
          Long-term squad structure, not last week’s points ·{" "}
          <Link href={researchHref + "#long-term"}>open long-term research →</Link>
        </small>
      </div>

      <div
        className={
          "portfolio-driver portfolio-driver-" +
          portfolioPlan.game_theory.band.toLowerCase()
        }
      >
        <div>
          <span>DECISION DRIVER</span>
          <strong>
            {portfolioPlan.decision_driver === "GAME_THEORY_TIEBREAK"
              ? "GAME THEORY TIE-BREAK"
              : portfolioPlan.decision_driver === "FOOTBALL_PORTFOLIO"
                ? "FOOTBALL + PORTFOLIO"
                : "PORTFOLIO STRUCTURE"}
          </strong>
        </div>
        <div>
          <span>GAME THEORY IMPACT</span>
          <strong>{portfolioPlan.game_theory.band}</strong>
          <small>
            {(portfolioPlan.game_theory.probability_delta >= 0 ? "+" : "") +
              (portfolioPlan.game_theory.probability_delta * 100).toFixed(1)}
            pp vs hold baseline
          </small>
        </div>
        <p>{portfolioPlan.game_theory.explanation}</p>
      </div>

      <div className="portfolio-health-grid portfolio-health-grid-primary">
        <div>
          <span>FREE TRANSFERS</span>
          <strong>{portfolioPlan.free_transfers ?? "—"}/5</strong>
          <small>
            {portfolioPlan.hit_cost_for_one_extra_move == null
              ? "Hit cost uncertain"
              : portfolioPlan.hit_cost_for_one_extra_move === 0
                ? "Next extra move currently covered"
                : "One move beyond bank = -4"}
          </small>
        </div>
        <div>
          <span>BANK</span>
          <strong>£{portfolioPlan.portfolio.bank.toFixed(1)}m</strong>
          <small>{portfolioPlan.portfolio.bankStatus}</small>
        </div>
        <div>
          <span>BENCH COVER</span>
          <strong>{portfolioPlan.portfolio.reliableBench}/4</strong>
          <small>reliable current substitutes</small>
        </div>
        <div>
          <span>6GW XI</span>
          <strong>
            {portfolioPlan.portfolio.horizon.sixGwAverageBestXi.toFixed(1)}
          </strong>
          <small>formation-constrained model average</small>
        </div>
      </div>

      <details className="portfolio-deep-dive">
        <summary>
          <span>DEEP PORTFOLIO EVIDENCE</span>
          <strong>Structure, routes, underlying data & failure modes</strong>
          <small>
            Seven secondary metrics are kept here so the decision view stays calm.
          </small>
        </summary>

        <div className="portfolio-health-grid portfolio-health-grid-secondary">
          <div>
            <span>BENCH VALUE</span>
            <strong>£{portfolioPlan.portfolio.bench.spend.toFixed(1)}m</strong>
            <small>
              {Math.round(portfolioPlan.portfolio.bench.spendShare * 100)}% of
              squad value ·{" "}
              {portfolioPlan.portfolio.bench.currentModelScore.toFixed(1)} model
              points
            </small>
          </div>
          <div>
            <span>8GW XI</span>
            <strong>
              {portfolioPlan.portfolio.horizon.eightGwAverageBestXi.toFixed(1)}
            </strong>
            <small>structural horizon</small>
          </div>
          <div>
            <span>DIFFERENTIALS</span>
            <strong>{portfolioPlan.portfolio.differentialCount}</strong>
            <small>&lt;10% official ownership</small>
          </div>
          <div>
            <span>MIDFIELD ROUTE</span>
            <strong>
              {portfolioPlan.portfolio.priceStructure.midfieldRoute
                ? "OPEN"
                : "BLOCKED"}
            </strong>
            <small>
              {portfolioPlan.portfolio.priceStructure.midfieldTarget ??
                "No urgent target"}
            </small>
          </div>
          <div>
            <span>FORWARD ROUTE</span>
            <strong>
              {portfolioPlan.portfolio.priceStructure.forwardRoute
                ? "OPEN"
                : "BLOCKED"}
            </strong>
            <small>
              {portfolioPlan.portfolio.priceStructure.forwardTarget ??
                "No urgent target"}
            </small>
          </div>
          <div>
            <span>FIELD OWNERSHIP</span>
            <strong>
              {portfolioPlan.field_ownership_proxy.average_squad_ownership.toFixed(
                1,
              )}
              %
            </strong>
            <small>official ownership average · not EO</small>
          </div>
          <div>
            <span>PREMIUMS</span>
            <strong>{portfolioPlan.portfolio.premiumCount}</strong>
            <small>£8.5m+ squad assets</small>
          </div>
        </div>

        <div className="portfolio-price-bands">
          <div>
            <span>GOALKEEPERS</span>
            <strong>
              £
              {portfolioPlan.portfolio.priceStructure.bands.goalkeeperSpend.toFixed(
                1,
              )}
              m
            </strong>
            <small>
              {portfolioPlan.portfolio.priceStructure.bands.budgetGoalkeepers}/2
              at £4.5m or below
            </small>
          </div>
          <div>
            <span>DEFENDERS</span>
            <strong>
              {portfolioPlan.portfolio.priceStructure.bands.premiumDefenders} /{" "}
              {portfolioPlan.portfolio.priceStructure.bands.midDefenders} /{" "}
              {portfolioPlan.portfolio.priceStructure.bands.budgetDefenders}
            </strong>
            <small>premium / mid / budget</small>
          </div>
          <div>
            <span>MIDFIELDERS</span>
            <strong>
              {portfolioPlan.portfolio.priceStructure.bands.premiumMidfielders} /{" "}
              {portfolioPlan.portfolio.priceStructure.bands.midMidfielders} /{" "}
              {portfolioPlan.portfolio.priceStructure.bands.enablerMidfielders}
            </strong>
            <small>£8.5m+ / £6.5–8.0m / ≤£5.5m</small>
          </div>
          <div>
            <span>FORWARDS</span>
            <strong>
              {portfolioPlan.portfolio.priceStructure.bands.premiumMidForwards} /{" "}
              {portfolioPlan.portfolio.priceStructure.bands.valueForwards} /{" "}
              {portfolioPlan.portfolio.priceStructure.bands.budgetForwards}
            </strong>
            <small>£7.5m+ / £5.5–7.4m / &lt;£5.5m</small>
          </div>
        </div>

        <div className="portfolio-evidence-grid">
          <section>
            <span>WHY</span>
            {portfolioPlan.why.map((reason, index) => (
              <p key={"why-" + index}>{reason}</p>
            ))}
          </section>
          <section>
            <span>FAILURE MODES</span>
            {portfolioPlan.failure_modes.map((risk, index) => (
              <p key={"risk-" + index}>{risk}</p>
            ))}
          </section>
          <section>
            <span>UNDERLYING DATA</span>
            {portfolioPlan.underlying.map((item, index) => (
              <p key={"data-" + index}>{item}</p>
            ))}
          </section>
          <section>
            <span>GAME THEORY</span>
            <p>{portfolioPlan.differential_guidance}</p>
            <p>{portfolioPlan.field_ownership_proxy.caveat}</p>
            <p>
              League mode: <b>{portfolioPlan.league_mode}</b> · resource state:{" "}
              <b>{portfolioPlan.resource_status}</b>
            </p>
          </section>
        </div>

        {portfolioPlan.missing.length ? (
          <div className="portfolio-missing">
            <span>NOT YET MEASURED — NOT INVENTED</span>
            {portfolioPlan.missing.map((item, index) => (
              <p key={"missing-" + index}>{item}</p>
            ))}
          </div>
        ) : null}
      </details>
    </section>
  );
}
