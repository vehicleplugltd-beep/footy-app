/** Discovery scope only; this never grants model or betting approval. */
export function isSeniorMensInternationalCompetition(league: string): boolean {
  const name = league.toLowerCase().trim();
  // Quarantine known corrupted feed namespaces until independently reconciled.
  if (/^nor-concacaf\b/.test(name)) return false;
  if (!name || /club|champions league|europa league|conference league|youth|under.?\d\d|\bu-?\d\d\b|women|female|olympic/.test(name)) return false;
  return /world cup|\buefa euro\b|\beuro(?:pean championship| qualifiers| qualification| 20\d\d|s 20\d\d)\b|nations league|african? cup of nations|afcon|copa am[eé]rica|asian cup|international friendl|friendly internationals|\bfifa.*qualif|\buefa.*qualif|\bcaf.*qualif|\bafc.*qualif/.test(name);
}
