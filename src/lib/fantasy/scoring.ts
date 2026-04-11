/**
 * TATA IPL T20 Fantasy Scoring Engine
 * Source of truth: FANTASY_IPL_SPEC.md section 8
 * DO NOT approximate — these are the exact official rules.
 */

import type { PlayerMatchStats } from "@/types/player";

export interface PointsBreakdown {
  playing_xi: number;
  batting: {
    runs: number;
    fours: number;   // boundary bonus
    sixes: number;   // six bonus
    milestone: number; // 50-bonus or 100-bonus (not cumulative)
    duck: number;
    strike_rate: number;
  };
  bowling: {
    wickets: number;
    haul_bonus: number; // 4-wkt or 5-wkt bonus
    maidens: number;
    economy: number;
  };
  fielding: {
    catches: number;
    stumpings: number;
    run_outs: number;
  };
  total: number;
}

/**
 * Convert cricket-notation overs to decimal overs.
 * 3.4 in cricket notation = 3 overs + 4 balls = 22 balls total = 3.667 decimal overs.
 * This is CRITICAL — using raw 3.4 as decimal gives wrong economy rate.
 */
function cricketOversToDecimal(notationOvers: number): number {
  const fullOvers = Math.floor(notationOvers);
  const partialBalls = Math.round((notationOvers - fullOvers) * 10);
  return (fullOvers * 6 + partialBalls) / 6;
}

function totalBallsBowled(notationOvers: number): number {
  const fullOvers = Math.floor(notationOvers);
  const partialBalls = Math.round((notationOvers - fullOvers) * 10);
  return fullOvers * 6 + partialBalls;
}

export function calcFantasyPoints(
  stats: Omit<PlayerMatchStats, "id" | "match_id" | "player_id" | "fantasy_points">,
  role: "WK" | "BAT" | "AR" | "BOWL",
  isPlayingXI: boolean = true,
): PointsBreakdown {
  const bd: PointsBreakdown = {
    playing_xi: 0,
    batting: { runs: 0, fours: 0, sixes: 0, milestone: 0, duck: 0, strike_rate: 0 },
    bowling: { wickets: 0, haul_bonus: 0, maidens: 0, economy: 0 },
    fielding: { catches: 0, stumpings: 0, run_outs: 0 },
    total: 0,
  };

  // === PLAYING XI: +4 ===
  if (isPlayingXI) bd.playing_xi = 4;

  // === BATTING ===
  bd.batting.runs = stats.runs * 1;
  bd.batting.fours = stats.fours * 1;   // boundary BONUS (+1 on top of the run point)
  bd.batting.sixes = stats.sixes * 2;   // six BONUS (+2 on top of the run point)

  // Milestone: century REPLACES half-century (not cumulative)
  if (stats.runs >= 100) {
    bd.batting.milestone = 16;
  } else if (stats.runs >= 50) {
    bd.batting.milestone = 8;
  }

  // Duck: ONLY for WK, BAT, AR — bowlers do NOT get duck penalty
  if (stats.is_dismissed && stats.runs === 0 && role !== "BOWL") {
    bd.batting.duck = -2;
  }

  // Strike rate penalty (min 10 balls, WK/BAT/AR only — NOT bowlers)
  // TATA IPL: no positive SR bonus, only penalties
  if (stats.balls_faced >= 10 && role !== "BOWL") {
    const sr = (stats.runs / stats.balls_faced) * 100;
    if (sr < 50) {
      bd.batting.strike_rate = -6;
    } else if (sr < 60) {
      bd.batting.strike_rate = -4;
    } else if (sr <= 70) {
      bd.batting.strike_rate = -2;
    }
    // SR > 70: no bonus in TATA IPL scoring
  }

  // === BOWLING ===
  bd.bowling.wickets = stats.wickets * 25;

  // Haul bonus (on top of individual wicket points)
  // 5-wkt: +16, 4-wkt: +8 — both explicitly in spec section 8.2.
  // 3-wkt: +4 — NOT listed in the spec table but IS standard Dream11 IPL practice.
  // Keep until spec is updated or confirmed otherwise.
  if (stats.wickets >= 5) {
    bd.bowling.haul_bonus = 16;
  } else if (stats.wickets >= 4) {
    bd.bowling.haul_bonus = 8;
  } else if (stats.wickets >= 3) {
    bd.bowling.haul_bonus = 4;
  }

  bd.bowling.maidens = stats.maidens * 8;

  // Economy rate: min 2 overs (12 balls), TATA IPL only has bonuses — NO penalties
  // Dream11 TATA IPL 2025 tiers: 4–4.99 RPO = +4, 5–6 RPO = +2 (eco below 4 also gets +4)
  const ballsBowled = totalBallsBowled(stats.overs_bowled);
  if (ballsBowled >= 12) {
    const decimalOvers = ballsBowled / 6;
    const eco = stats.runs_conceded / decimalOvers;
    if (eco < 5) {
      bd.bowling.economy = 4;  // covers 0–4.99 (below 4 is even better, also +4)
    } else if (eco <= 6) {
      bd.bowling.economy = 2;  // 5.00–6.00
    }
    // eco > 6: 0 points, no negatives in TATA IPL economy system
  }

  // === FIELDING ===
  bd.fielding.catches = stats.catches * 8;
  // No "3+ catch bonus" in TATA IPL official scoring
  bd.fielding.stumpings = stats.stumpings * 12;
  bd.fielding.run_outs =
    (stats.run_outs * 12) + (stats.run_outs_assist * 6);
  // Caught & Bowled: bowler already gets +25 (wicket) + +8 (catch) automatically

  // === TOTAL ===
  bd.total =
    bd.playing_xi +
    bd.batting.runs + bd.batting.fours + bd.batting.sixes +
    bd.batting.milestone + bd.batting.duck + bd.batting.strike_rate +
    bd.bowling.wickets + bd.bowling.haul_bonus + bd.bowling.maidens + bd.bowling.economy +
    bd.fielding.catches + bd.fielding.stumpings + bd.fielding.run_outs;

  return bd;
}

/** Apply captain/VC multiplier. Call after calcFantasyPoints. */
export function applyMultiplier(
  basePoints: number,
  playerId: string,
  captainId: string | null,
  vcId: string | null,
): number {
  if (playerId === captainId) return basePoints * 2;
  if (playerId === vcId) return basePoints * 1.5;
  return basePoints;
}

/** Convenience: total base points as a number (no multiplier). */
export function calcTotalPoints(
  stats: Omit<PlayerMatchStats, "id" | "match_id" | "player_id" | "fantasy_points">,
  role: "WK" | "BAT" | "AR" | "BOWL",
  isPlayingXI: boolean = true,
): number {
  return calcFantasyPoints(stats, role, isPlayingXI).total;
}
