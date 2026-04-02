import type { IplPlayer, PlayerRole } from "@/types/player";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Dream11 IPL T20 team composition rules (2025 season)
export const TEAM_RULES = {
  TOTAL_PLAYERS: 11,
  MAX_CREDITS: 100,
  MAX_FROM_ONE_TEAM: 7,
  MIN_FROM_EACH_MATCH_TEAM: 1,
  // Dream11 2025: 1–8 for all roles (only constraint is total = 11)
  WK_MIN: 1, WK_MAX: 8,
  BAT_MIN: 1, BAT_MAX: 8,
  AR_MIN: 1, AR_MAX: 8,
  BOWL_MIN: 1, BOWL_MAX: 8,
} as const;

export function validateTeam(
  selectedPlayers: IplPlayer[],
  captainId: string | null,
  vcId: string | null,
  matchTeams?: { home: string; away: string }
): ValidationResult {
  const errors: string[] = [];

  if (selectedPlayers.length !== TEAM_RULES.TOTAL_PLAYERS) {
    errors.push(`Select exactly ${TEAM_RULES.TOTAL_PLAYERS} players (${selectedPlayers.length} selected)`);
  }

  const totalCredits = selectedPlayers.reduce((s, p) => s + p.credit_value, 0);
  if (totalCredits > TEAM_RULES.MAX_CREDITS) {
    errors.push(`Team exceeds ${TEAM_RULES.MAX_CREDITS} credits (${totalCredits.toFixed(1)} used)`);
  }

  const byTeam: Record<string, number> = {};
  for (const p of selectedPlayers) {
    byTeam[p.ipl_team] = (byTeam[p.ipl_team] ?? 0) + 1;
  }
  for (const [team, count] of Object.entries(byTeam)) {
    if (count > TEAM_RULES.MAX_FROM_ONE_TEAM) {
      errors.push(`Max ${TEAM_RULES.MAX_FROM_ONE_TEAM} players from one team (${team}: ${count})`);
    }
  }

  const byRole: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
  for (const p of selectedPlayers) byRole[p.role]++;

  if (byRole.WK < TEAM_RULES.WK_MIN || byRole.WK > TEAM_RULES.WK_MAX) {
    errors.push(`WK: ${TEAM_RULES.WK_MIN}–${TEAM_RULES.WK_MAX} required (${byRole.WK} selected)`);
  }
  if (byRole.BAT < TEAM_RULES.BAT_MIN || byRole.BAT > TEAM_RULES.BAT_MAX) {
    errors.push(`BAT: ${TEAM_RULES.BAT_MIN}–${TEAM_RULES.BAT_MAX} required (${byRole.BAT} selected)`);
  }
  if (byRole.AR < TEAM_RULES.AR_MIN || byRole.AR > TEAM_RULES.AR_MAX) {
    errors.push(`AR: ${TEAM_RULES.AR_MIN}–${TEAM_RULES.AR_MAX} required (${byRole.AR} selected)`);
  }
  if (byRole.BOWL < TEAM_RULES.BOWL_MIN || byRole.BOWL > TEAM_RULES.BOWL_MAX) {
    errors.push(`BOWL: ${TEAM_RULES.BOWL_MIN}–${TEAM_RULES.BOWL_MAX} required (${byRole.BOWL} selected)`);
  }

  // Validate that players come from the two match teams only
  if (matchTeams) {
    const teams = new Set(selectedPlayers.map((p) => p.ipl_team));
    if (!teams.has(matchTeams.home)) {
      errors.push(`Must pick at least 1 player from ${matchTeams.home}`);
    }
    if (!teams.has(matchTeams.away)) {
      errors.push(`Must pick at least 1 player from ${matchTeams.away}`);
    }
    for (const p of selectedPlayers) {
      if (p.ipl_team !== matchTeams.home && p.ipl_team !== matchTeams.away) {
        errors.push(`${p.name} is not in this match`);
      }
    }
  }

  const ids = selectedPlayers.map((p) => p.id);

  if (!captainId) {
    errors.push("Select a captain");
  } else if (!ids.includes(captainId)) {
    errors.push("Captain must be in your team");
  }

  if (!vcId) {
    errors.push("Select a vice captain");
  } else if (!ids.includes(vcId)) {
    errors.push("Vice captain must be in your team");
  }

  if (captainId && vcId && captainId === vcId) {
    errors.push("Captain and vice captain must be different players");
  }

  return { valid: errors.length === 0, errors };
}
