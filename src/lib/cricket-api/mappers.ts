import type { CricApiPlayer, CricApiMatch, CricApiBatsman, CricApiBowler, CricApiInnings } from "./types";
import type { IplPlayer, PlayerRole, PlayerMatchStats } from "@/types/player";
import type { IplMatch } from "@/types/match";
import { calcFantasyPoints, calcTotalPoints } from "@/lib/fantasy/scoring";

export function mapCricApiPlayerToIplPlayer(
  p: CricApiPlayer,
  teamName: string
): Omit<IplPlayer, "id" | "created_at" | "updated_at" | "credit_value" | "credit_override" | "is_playing"> {
  const role = inferRole(p.playerType ?? p.role ?? "");
  return {
    cricapi_player_id: p.id,
    name: p.name,
    ipl_team: teamName,
    role,
    batting_style: p.battingStyle ?? null,
    bowling_style: p.bowlingStyle ?? null,
    photo_url: null,
    last_synced_at: new Date().toISOString(),
  };
}

function inferRole(type: string): PlayerRole {
  const t = type.toLowerCase();
  if (t.includes("wicket")) return "WK";
  if (t.includes("all")) return "AR";
  if (t.includes("bowl")) return "BOWL";
  return "BAT";
}

export function mapCricApiMatchToIplMatch(m: CricApiMatch): Omit<IplMatch, "id" | "created_at" | "last_synced_at"> {
  const teams = m.teams ?? [];
  return {
    cricapi_match_id: m.id,
    match_number: null,
    team_home: teams[0] ?? "TBD",
    team_away: teams[1] ?? "TBD",
    venue: m.venue ?? null,
    city: null,
    scheduled_at: m.dateTimeGMT ? new Date(m.dateTimeGMT).toISOString() : new Date(m.date).toISOString(),
    status: m.matchEnded ? "completed" : m.matchStarted ? "live" : "scheduled",
    toss_winner: m.tossWinner ?? null,
    batting_first: m.tossChoice === "bat" ? m.tossWinner ?? null : null,
    result_summary: m.status ?? null,
    winner: m.winner ?? null,
    raw_api_payload: m as unknown,
    live_score_summary: null,
    is_scoring_paused: false,
  };
}

export function mapScorecardToStats(
  innings: CricApiInnings[],
  matchId: string,
  playerMap: Record<string, string> // cricapi_id → internal uuid
): Omit<PlayerMatchStats, "id">[] {
  const statsMap = new Map<string, Omit<PlayerMatchStats, "id">>();

  for (const inn of innings) {
    for (const b of inn.batsmen ?? []) {
      const playerId = playerMap[b.batsmanId];
      if (!playerId) continue;
      const existing = statsMap.get(playerId) ?? blankStats(matchId, playerId);
      existing.runs += b.r;
      existing.balls_faced += b.b;
      existing.fours += b.fours;
      existing.sixes += b.sixes;
      if (b.dismissal) existing.is_dismissed = true;
      statsMap.set(playerId, existing);
    }

    for (const bw of inn.bowlers ?? []) {
      const playerId = playerMap[bw.bowlerId];
      if (!playerId) continue;
      const existing = statsMap.get(playerId) ?? blankStats(matchId, playerId);
      existing.overs_bowled += bw.o;
      existing.wickets += bw.w;
      existing.runs_conceded += bw.r;
      existing.maidens += bw.m;
      existing.wides += bw.wd;
      statsMap.set(playerId, existing);
    }
  }

  return Array.from(statsMap.values()).map((s) => ({
    ...s,
    // calcFantasyPoints returns PointsBreakdown; extract .total for the numeric DB column.
    // Role is unknown in this mapper (no player lookup), defaulting to "BAT".
    // The sync-live route uses the actual role from f11_players for accurate scoring.
    fantasy_points: calcFantasyPoints(s, "BAT", true).total,
  }));
}

function blankStats(matchId: string, playerId: string): Omit<PlayerMatchStats, "id"> {
  return {
    match_id: matchId,
    player_id: playerId,
    runs: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    is_dismissed: false,
    batting_position: null,
    overs_bowled: 0,
    wickets: 0,
    runs_conceded: 0,
    maidens: 0,
    wides: 0,
    catches: 0,
    stumpings: 0,
    run_outs: 0,
    run_outs_assist: 0,
    fantasy_points: 0,
  };
}
