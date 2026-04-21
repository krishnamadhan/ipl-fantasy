/**
 * GET /api/bot/squad?match_id=<id>[&xi_only=true]
 *
 * Returns players for a match with aggregated season stats so BanterAgent
 * can pass them to Claude for fantasy team selection.
 *
 * xi_only=true — filter to confirmed playing XI only (after toss).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  const xi_only = searchParams.get("xi_only") === "true";

  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = await createServiceClient();

  // Get match players joined with player info
  let query = admin
    .from("f11_match_players")
    .select(`
      player_id,
      is_playing_xi,
      batting_order,
      player:f11_players!player_id(
        id, name, role, ipl_team, credit_value
      )
    `)
    .eq("match_id", match_id);

  if (xi_only) query = query.eq("is_playing_xi", true);

  const { data: matchPlayers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!matchPlayers?.length) return NextResponse.json({ players: [] });

  const playerIds = matchPlayers.map((mp: any) => mp.player_id);

  // Aggregate season stats from all completed matches
  const { data: seasonStats } = await admin
    .from("f11_player_stats")
    .select(`
      player_id, runs, balls_faced, wickets, runs_conceded, overs_bowled,
      fantasy_points,
      match:f11_matches!match_id(status)
    `)
    .in("player_id", playerIds)
    .eq("f11_matches.status", "completed");

  // Build per-player season aggregates
  const statsMap: Record<string, {
    season_runs: number; season_balls: number; season_wickets: number;
    season_runs_conceded: number; season_overs: number; season_fp: number; matches: number;
    recent_runs: number; recent_wickets: number;
  }> = {};

  for (const s of (seasonStats ?? []) as any[]) {
    if (!statsMap[s.player_id]) {
      statsMap[s.player_id] = {
        season_runs: 0, season_balls: 0, season_wickets: 0,
        season_runs_conceded: 0, season_overs: 0, season_fp: 0, matches: 0,
        recent_runs: 0, recent_wickets: 0,
      };
    }
    const agg = statsMap[s.player_id]!;
    agg.season_runs += s.runs ?? 0;
    agg.season_balls += s.balls_faced ?? 0;
    agg.season_wickets += s.wickets ?? 0;
    agg.season_runs_conceded += s.runs_conceded ?? 0;
    // overs_bowled stored as cricket notation (1.4 = 10 balls) — convert to decimal
    const overs = s.overs_bowled ?? 0;
    agg.season_overs += Math.floor(overs) + (overs % 1) * 10 / 6;
    agg.season_fp += s.fantasy_points ?? 0;
    agg.matches++;
  }

  // Recent = last 3 matches (last 3 entries per player by insertion order)
  const recentMap: Record<string, { runs: number; wickets: number }> = {};
  const recentRaw = (seasonStats ?? []).slice(-playerIds.length * 3) as any[];
  for (const s of recentRaw) {
    if (!recentMap[s.player_id]) recentMap[s.player_id] = { runs: 0, wickets: 0 };
    recentMap[s.player_id]!.runs += s.runs ?? 0;
    recentMap[s.player_id]!.wickets += s.wickets ?? 0;
  }

  const players = matchPlayers.map((mp: any) => {
    const p = mp.player;
    const agg = statsMap[mp.player_id];
    const recent = recentMap[mp.player_id];

    const season_avg = agg && agg.season_balls > 0
      ? parseFloat(((agg.season_runs / agg.matches) ).toFixed(1))
      : 0;
    const season_sr = agg && agg.season_balls > 0
      ? parseFloat(((agg.season_runs / agg.season_balls) * 100).toFixed(1))
      : 0;
    const season_eco = agg && agg.season_overs > 0
      ? parseFloat((agg.season_runs_conceded / agg.season_overs).toFixed(2))
      : 0;

    return {
      id:               mp.player_id,
      name:             p.name,
      role:             p.role,
      ipl_team:         p.ipl_team,
      credit_value:     p.credit_value,
      is_playing_xi:    mp.is_playing_xi,
      batting_order:    mp.batting_order,
      // Season totals
      season_runs:      agg?.season_runs ?? 0,
      season_wickets:   agg?.season_wickets ?? 0,
      season_avg,
      season_sr,
      season_eco,
      season_fp:        agg ? parseFloat((agg.season_fp / agg.matches).toFixed(1)) : 0,
      matches_played:   agg?.matches ?? 0,
      // Recent form (last ~3 matches)
      recent_runs:      recent?.runs ?? 0,
      recent_wickets:   recent?.wickets ?? 0,
    };
  });

  return NextResponse.json({ players });
}
