"use client";

import { useMemo, useState } from "react";
import {
  decimalToFractional,
  fractionalToDecimal,
  minimumTakeToFractional,
} from "@/lib/odds";

type Leg = {
  id: number;
  odds: string;
  probability: string;
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value: number | null, digits = 1) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(digits)}%`;
}

function money(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

function oddsLabel(decimal: number | null) {
  if (decimal == null || !Number.isFinite(decimal) || decimal <= 1) return "—";
  return `${decimalToFractional(decimal)} · ${decimal.toFixed(2)}`;
}

function edgeLabel(edge: number | null) {
  if (edge == null || !Number.isFinite(edge)) return "—";
  return `${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(1)}%`;
}

export function BetLab() {
  const [stake, setStake] = useState("10");
  const [odds, setOdds] = useState("6/4");
  const [probability, setProbability] = useState("45");
  const [targetEv, setTargetEv] = useState("2");
  const [bankroll, setBankroll] = useState("500");
  const [closingOdds, setClosingOdds] = useState("");
  const [legs, setLegs] = useState<Leg[]>([
    { id: 1, odds: "4/5", probability: "58" },
    { id: 2, odds: "11/10", probability: "50" },
    { id: 3, odds: "6/5", probability: "47" },
  ]);
  const [nextId, setNextId] = useState(4);

  const single = useMemo(() => {
    const decimal = fractionalToDecimal(odds);
    const p = toNumber(probability) / 100;
    const s = Math.max(0, toNumber(stake));
    const bank = Math.max(0, toNumber(bankroll));
    const target = Math.max(0, toNumber(targetEv)) / 100;
    const close = fractionalToDecimal(closingOdds);

    if (!decimal || decimal <= 1) {
      return {
        decimal: null,
        implied: null,
        fair: null,
        rawTake: null,
        returnValue: null,
        profit: null,
        edge: null,
        kelly: null,
        quarterKelly: null,
        referenceStake: null,
        clv: null,
      };
    }

    const implied = 1 / decimal;
    const fair = p > 0 && p < 1 ? 1 / p : null;
    const rawTake = p > 0 && p < 1 ? (1 + target) / p : null;
    const edge = p > 0 && p < 1 ? p * decimal - 1 : null;
    const b = decimal - 1;
    const q = 1 - p;
    const kelly =
      p > 0 && p < 1 && b > 0
        ? Math.max(0, (b * p - q) / b)
        : null;
    const quarterKelly = kelly == null ? null : kelly / 4;
    const cappedFraction =
      quarterKelly == null ? null : Math.min(quarterKelly, 0.02);
    const referenceStake =
      cappedFraction == null ? null : bank * cappedFraction;
    const clv =
      close && close > 1 ? decimal / close - 1 : null;

    return {
      decimal,
      implied,
      fair,
      rawTake,
      returnValue: s * decimal,
      profit: s * (decimal - 1),
      edge,
      kelly,
      quarterKelly,
      referenceStake,
      clv,
    };
  }, [stake, odds, probability, targetEv, bankroll, closingOdds]);

  const acca = useMemo(() => {
    const parsed = legs.map((leg) => ({
      ...leg,
      decimal: fractionalToDecimal(leg.odds),
      p: toNumber(leg.probability) / 100,
    }));

    if (parsed.some((leg) => !leg.decimal || leg.decimal <= 1)) {
      return {
        combinedOdds: null,
        combinedProbability: null,
        fairOdds: null,
        edge: null,
        returnValue: null,
        profit: null,
      };
    }

    const combinedOdds = parsed.reduce(
      (product, leg) => product * Number(leg.decimal),
      1,
    );
    const probabilitiesValid = parsed.every(
      (leg) => leg.p > 0 && leg.p < 1,
    );
    const combinedProbability = probabilitiesValid
      ? parsed.reduce((product, leg) => product * leg.p, 1)
      : null;
    const fairOdds =
      combinedProbability && combinedProbability > 0
        ? 1 / combinedProbability
        : null;
    const edge =
      combinedProbability == null
        ? null
        : combinedProbability * combinedOdds - 1;
    const s = Math.max(0, toNumber(stake));

    return {
      combinedOdds,
      combinedProbability,
      fairOdds,
      edge,
      returnValue: s * combinedOdds,
      profit: s * (combinedOdds - 1),
    };
  }, [legs, stake]);

  const ladder = useMemo(() => {
    const p = toNumber(probability) / 100;
    if (!(p > 0 && p < 1)) return [];
    return [0, 0.02, 0.05, 0.1].map((margin) => {
      const decimal = (1 + margin) / p;
      return {
        margin,
        decimal,
        fractional: minimumTakeToFractional(decimal),
      };
    });
  }, [probability]);

  function updateLeg(id: number, field: "odds" | "probability", value: string) {
    setLegs((current) =>
      current.map((leg) => (leg.id === id ? { ...leg, [field]: value } : leg)),
    );
  }

  function addLeg() {
    if (legs.length >= 10) return;
    setLegs((current) => [
      ...current,
      { id: nextId, odds: "EVS", probability: "50" },
    ]);
    setNextId((id) => id + 1);
  }

  function removeLeg(id: number) {
    setLegs((current) => current.filter((leg) => leg.id !== id));
  }

  return (
    <div className="bet-lab">
      <section className="lab-grid">
        <article className="lab-panel lab-panel-primary">
          <span>SINGLE / VALUE CALCULATOR</span>
          <h2>Is the price actually worth taking?</h2>
          <div className="lab-input-grid">
            <label>
              Stake
              <div className="money-input"><b>£</b><input value={stake} onChange={(event) => setStake(event.target.value)} inputMode="decimal" /></div>
            </label>
            <label>
              Odds
              <input value={odds} onChange={(event) => setOdds(event.target.value)} placeholder="6/4 or 2.50" />
            </label>
            <label>
              Your / model probability %
              <input value={probability} onChange={(event) => setProbability(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              Target EV %
              <input value={targetEv} onChange={(event) => setTargetEv(event.target.value)} inputMode="decimal" />
            </label>
          </div>

          <div className="lab-metric-grid">
            <div><span>Potential return</span><strong>{money(single.returnValue)}</strong></div>
            <div><span>Profit</span><strong>{money(single.profit)}</strong></div>
            <div><span>Book implied</span><strong>{pct(single.implied)}</strong></div>
            <div><span>Fair price</span><strong>{oddsLabel(single.fair)}</strong></div>
            <div className="lab-highlight"><span>Raw take price</span><strong>{single.rawTake ? `${minimumTakeToFractional(single.rawTake)}+ · ${single.rawTake.toFixed(2)}+` : "—"}</strong></div>
            <div className={single.edge != null && single.edge >= 0 ? "positive" : "negative"}><span>Raw EV</span><strong>{edgeLabel(single.edge)}</strong></div>
          </div>

          <div className="lab-decision">
            <span>PRICE COACH</span>
            <strong>
              {single.decimal == null || single.rawTake == null
                ? "Enter valid odds and a probability."
                : single.decimal >= single.rawTake
                  ? `Price qualifies before Footy's uncertainty haircut: ${decimalToFractional(single.decimal)} is above ${minimumTakeToFractional(single.rawTake)}+.`
                  : `Do not chase this price: wait for ${minimumTakeToFractional(single.rawTake)} or bigger.`}
            </strong>
            <small>
              Live Footy selections can require a higher minimum take because the
              production model adds uncertainty, market validation and context.
            </small>
          </div>
        </article>

        <article className="lab-panel">
          <span>PRICE LADDER</span>
          <h2>Know your number before the market moves.</h2>
          <div className="price-ladder">
            {ladder.map((row) => (
              <div key={row.margin}>
                <span>{row.margin === 0 ? "Fair" : `+${(row.margin * 100).toFixed(0)}% EV`}</span>
                <strong>{row.fractional}+</strong>
                <small>{row.decimal.toFixed(2)}+</small>
              </div>
            ))}
          </div>
          <p>
            This is a raw probability ladder. Footy&apos;s published take price is
            deliberately stricter when model uncertainty is elevated.
          </p>
        </article>
      </section>

      <section className="lab-grid">
        <article className="lab-panel">
          <span>ACCA CALCULATOR</span>
          <h2>See what every extra leg really costs.</h2>
          <div className="acca-builder">
            {legs.map((leg, index) => (
              <div className="acca-builder-row" key={leg.id}>
                <b>{index + 1}</b>
                <label>Odds<input value={leg.odds} onChange={(event) => updateLeg(leg.id, "odds", event.target.value)} /></label>
                <label>Model %<input value={leg.probability} onChange={(event) => updateLeg(leg.id, "probability", event.target.value)} inputMode="decimal" /></label>
                <button type="button" onClick={() => removeLeg(leg.id)} disabled={legs.length <= 2}>×</button>
              </div>
            ))}
          </div>
          <button className="lab-secondary-button" type="button" onClick={addLeg} disabled={legs.length >= 10}>+ Add leg</button>

          <div className="lab-metric-grid lab-metric-grid-compact">
            <div><span>Combined odds</span><strong>{oddsLabel(acca.combinedOdds)}</strong></div>
            <div><span>Model probability</span><strong>{pct(acca.combinedProbability, 2)}</strong></div>
            <div><span>Fair acca</span><strong>{oddsLabel(acca.fairOdds)}</strong></div>
            <div className={acca.edge != null && acca.edge >= 0 ? "positive" : "negative"}><span>Raw EV</span><strong>{edgeLabel(acca.edge)}</strong></div>
            <div><span>Return at £{toNumber(stake).toFixed(2)}</span><strong>{money(acca.returnValue)}</strong></div>
            <div><span>Profit</span><strong>{money(acca.profit)}</strong></div>
          </div>
          <p className="lab-warning">
            This calculator assumes independent legs. Footy&apos;s suggested accas
            apply extra correlation/uncertainty controls and never use a failing
            single as filler.
          </p>
        </article>

        <article className="lab-panel">
          <span>BANKROLL / RISK REFERENCE</span>
          <h2>Edge without stake discipline is incomplete.</h2>
          <div className="lab-input-grid lab-input-grid-single">
            <label>
              Bankroll
              <div className="money-input"><b>£</b><input value={bankroll} onChange={(event) => setBankroll(event.target.value)} inputMode="decimal" /></div>
            </label>
          </div>
          <div className="risk-reference">
            <div><span>Full Kelly</span><strong>{pct(single.kelly, 2)}</strong></div>
            <div><span>¼ Kelly</span><strong>{pct(single.quarterKelly, 2)}</strong></div>
            <div className="lab-highlight"><span>Reference stake</span><strong>{money(single.referenceStake)}</strong></div>
          </div>
          <p>
            The reference uses quarter Kelly and caps exposure at 2% of bankroll.
            It is a risk illustration, not a requirement to stake that amount.
          </p>
        </article>
      </section>

      <section className="lab-grid">
        <article className="lab-panel">
          <span>CLV CHECKER</span>
          <h2>Did you beat the closing market?</h2>
          <div className="lab-input-grid lab-input-grid-single">
            <label>
              Closing odds
              <input value={closingOdds} onChange={(event) => setClosingOdds(event.target.value)} placeholder="e.g. 5/4 or 2.25" />
            </label>
          </div>
          <div className="clv-output">
            <span>Your price: {oddsLabel(single.decimal)}</span>
            <span>Close: {oddsLabel(fractionalToDecimal(closingOdds))}</span>
            <strong className={single.clv != null && single.clv >= 0 ? "positive" : "negative"}>
              CLV {pct(single.clv, 2)}
            </strong>
          </div>
          <p>
            Positive CLV means your taken price was longer than the close. It is
            useful process evidence even when the individual bet loses.
          </p>
        </article>

        <article className="lab-panel">
          <span>ODDS TRANSLATOR</span>
          <h2>Fractional, decimal and implied chance.</h2>
          <div className="translator-card">
            <strong>{oddsLabel(single.decimal)}</strong>
            <span>Implied probability {pct(single.implied)}</span>
            <small>Type fractional (6/4, 10/11, EVS) or decimal (2.50).</small>
          </div>
        </article>
      </section>
    </div>
  );
}
