export interface PrizeTier {
  minRank: number;
  maxRank: number;
  perPlayerAmount: number;
}

export function calcPrizeTiers(
  prizePool: number,
  type: "winner_takes_all" | "tiered",
  entryCount: number
): PrizeTier[] {
  if (type === "winner_takes_all" || entryCount <= 2) {
    return [{ minRank: 1, maxRank: 1, perPlayerAmount: Math.floor(prizePool) }];
  }

  // Non-overlapping rank ranges; each tier gets its share split equally among players in it.
  // Tier boundaries: top 1%, next 1–5%, next 5–15%, next 15–30%
  const tierDefs: Array<{ cutoffPct: number; sharePct: number }> = [
    { cutoffPct: 0.01, sharePct: 40 },
    { cutoffPct: 0.05, sharePct: 25 },
    { cutoffPct: 0.15, sharePct: 20 },
    { cutoffPct: 0.30, sharePct: 15 },
  ];

  const result: PrizeTier[] = [];
  let prevMaxRank = 0;

  for (const def of tierDefs) {
    const maxRank = Math.max(prevMaxRank + 1, Math.floor(entryCount * def.cutoffPct));
    const count = maxRank - prevMaxRank;
    const totalForTier = Math.floor((prizePool * def.sharePct) / 100);
    const perPlayer = count > 0 ? Math.floor(totalForTier / count) : 0;

    if (perPlayer > 0) {
      result.push({ minRank: prevMaxRank + 1, maxRank, perPlayerAmount: perPlayer });
    }
    prevMaxRank = maxRank;
  }

  return result;
}
