import type { IplPlayer } from "@/types/player";
import type { PlayerMatchStats } from "@/types/player";

interface CreditUpdateInput {
  player: IplPlayer;
  thisMatchPoints: number;
  last5Points: number[];
  selectionPct: number; // 0–100
}

interface CreditUpdateResult {
  playerId: string;
  oldCredit: number;
  newCredit: number;
  delta: number;
}

export function computeCreditUpdate(input: CreditUpdateInput): CreditUpdateResult {
  const { player, thisMatchPoints, last5Points, selectionPct } = input;

  if (player.credit_override) {
    return { playerId: player.id, oldCredit: player.credit_value, newCredit: player.credit_value, delta: 0 };
  }

  const avg = last5Points.length > 0
    ? last5Points.reduce((a, b) => a + b, 0) / last5Points.length
    : thisMatchPoints;

  const performanceDelta = thisMatchPoints - avg;

  let creditDelta = 0;
  if (performanceDelta >= 20) creditDelta += 0.5;
  else if (performanceDelta <= -15) creditDelta -= 0.5;

  // Selection% adjustment
  if (selectionPct > 60 && performanceDelta < 0) creditDelta -= 0.5;
  if (selectionPct < 15 && performanceDelta > 0) creditDelta += 0.5;

  // Round to nearest 0.5, clamp to [6.0, 12.0]
  const raw = player.credit_value + creditDelta;
  const rounded = Math.round(raw * 2) / 2;
  const clamped = Math.min(12.0, Math.max(6.0, rounded));

  return {
    playerId: player.id,
    oldCredit: player.credit_value,
    newCredit: clamped,
    delta: clamped - player.credit_value,
  };
}
