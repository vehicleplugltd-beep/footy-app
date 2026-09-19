const COMMON_FRACTIONS: Array<[number, number]> = [
  [1, 20], [1, 16], [1, 14], [1, 12], [1, 10], [1, 9], [1, 8], [1, 7],
  [1, 6], [2, 11], [1, 5], [2, 9], [1, 4], [2, 7], [3, 10], [1, 3],
  [4, 11], [2, 5], [4, 9], [1, 2], [8, 15], [4, 7], [3, 5], [8, 13],
  [2, 3], [8, 11], [4, 5], [5, 6], [10, 11], [1, 1], [11, 10],
  [6, 5], [5, 4], [13, 10], [11, 8], [7, 5], [3, 2], [8, 5],
  [13, 8], [5, 3], [7, 4], [9, 5], [15, 8], [2, 1], [21, 10],
  [9, 4], [12, 5], [5, 2], [13, 5], [11, 4], [14, 5], [3, 1],
  [16, 5], [10, 3], [7, 2], [15, 4], [4, 1], [17, 4], [9, 2],
  [19, 4], [5, 1], [21, 4], [11, 2], [23, 4], [6, 1], [13, 2],
  [7, 1], [15, 2], [8, 1], [17, 2], [9, 1], [10, 1], [11, 1],
  [12, 1], [14, 1], [16, 1], [18, 1], [20, 1], [25, 1], [33, 1],
  [50, 1], [66, 1], [100, 1],
];

function fractionValue([numerator, denominator]: [number, number]) {
  return numerator / denominator;
}

function formatFraction([numerator, denominator]: [number, number]) {
  if (numerator === denominator) return "EVS";
  return `${numerator}/${denominator}`;
}

export function decimalToFractional(decimalOdds: number | null | undefined) {
  const decimal = Number(decimalOdds);
  if (!Number.isFinite(decimal) || decimal <= 1) return "—";

  const target = decimal - 1;
  let best = COMMON_FRACTIONS[0];
  let bestError = Number.POSITIVE_INFINITY;

  for (const candidate of COMMON_FRACTIONS) {
    const error = Math.abs(fractionValue(candidate) - target);
    if (error < bestError) {
      best = candidate;
      bestError = error;
    }
  }

  return formatFraction(best);
}

export function minimumTakeToFractional(decimalOdds: number | null | undefined) {
  const decimal = Number(decimalOdds);
  if (!Number.isFinite(decimal) || decimal <= 1) return "—";

  const target = decimal - 1;
  const ceiling =
    COMMON_FRACTIONS.find((candidate) => fractionValue(candidate) + 1e-9 >= target) ??
    COMMON_FRACTIONS[COMMON_FRACTIONS.length - 1];

  return formatFraction(ceiling);
}

export function fractionalToDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  if (["evs", "even", "evens"].includes(raw)) return 2;

  if (raw.includes("/")) {
    const [left, right] = raw.split("/");
    const numerator = Number(left);
    const denominator = Number(right);
    if (
      Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      numerator >= 0 &&
      denominator > 0
    ) {
      return 1 + numerator / denominator;
    }
    return null;
  }

  // Convenience fallback: decimal input is accepted, but the UI always
  // renders prices back in fractional format.
  const decimal = Number(raw);
  return Number.isFinite(decimal) && decimal > 1 ? decimal : null;
}

export function impliedProbability(decimalOdds: number | null | undefined) {
  const decimal = Number(decimalOdds);
  return Number.isFinite(decimal) && decimal > 1 ? 1 / decimal : null;
}
