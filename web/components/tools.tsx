"use client";

import { useMemo, useState } from "react";
import type { BoardMatch, ValidationStatus } from "@/lib/types";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PriceChecker({
  board,
  validationStatus,
}: {
  board: BoardMatch[];
  validationStatus: ValidationStatus;
}) {
  const selections = useMemo(
    () =>
      board.flatMap((match) =>
        match.selections.map((selection) => ({
          ...selection,
          label: `${match.home_team} vs ${match.away_team} — ${selection.displaySelection}`,
        })),
      ),
    [board],
  );

  const [selectedKey, setSelectedKey] = useState(
    selections[0]
      ? `${selections[0].match_id}:${selections[0].selection}`
      : "",
  );
  const [odds, setOdds] = useState("");

  const selected =
    selections.find(
      (item) => `${item.match_id}:${item.selection}` === selectedKey,
    ) ?? selections[0];

  const price = Number(odds);
  const rawEv =
    selected && price > 1 ? selected.model_probability * price - 1 : null;

  const rawPriceVerdict =
    !selected || !(price > 1)
      ? "ENTER PRICE"
      : price >= selected.minimum_take_price
        ? "RAW VALUE"
        : price >= selected.fair_odds
          ? "RAW WATCH"
          : "RAW PASS";

  const productionVerdict =
    rawPriceVerdict === "RAW VALUE"
      ? validationStatus === "APPROVED"
        ? "VALUE TIP"
        : validationStatus === "PASS"
          ? "PASS"
          : "WATCH"
      : rawPriceVerdict === "RAW WATCH"
        ? "WATCH"
        : rawPriceVerdict === "RAW PASS"
          ? "PASS"
          : "ENTER PRICE";

  if (!selected) {
    return <p className="muted">No upcoming priced fixtures are available yet.</p>;
  }

  return (
    <div className="tool-grid">
      <label>
        <span>Fixture / selection</span>
        <select
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value)}
        >
          {selections.map((item) => (
            <option
              key={`${item.match_id}:${item.selection}`}
              value={`${item.match_id}:${item.selection}`}
            >
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Bookmaker odds you can see</span>
        <input
          inputMode="decimal"
          value={odds}
          onChange={(event) => setOdds(event.target.value)}
          placeholder="e.g. 2.40"
        />
      </label>

      <div className="tool-results">
        <Metric
          label="Model probability"
          value={`${(selected.model_probability * 100).toFixed(1)}%`}
        />
        <Metric label="Fair odds" value={selected.fair_odds.toFixed(2)} />
        <Metric
          label="Minimum take"
          value={selected.minimum_take_price.toFixed(2)}
        />
        <Metric
          label="Raw EV"
          value={rawEv === null ? "—" : `${(rawEv * 100).toFixed(1)}%`}
        />
      </div>

      <div className="verdict-row">
        <span className="eyebrow">Footy tip status</span>
        <strong
          className={`verdict verdict-${productionVerdict
            .toLowerCase()
            .replace(" ", "-")}`}
        >
          {productionVerdict}
        </strong>
        <small>
          {validationStatus === "APPROVED"
            ? "Historically approved information signal."
            : `Model validation is ${validationStatus}; raw value signals remain informational until approved.`}
        </small>
      </div>
    </div>
  );
}
