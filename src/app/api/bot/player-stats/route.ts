/**
 * GET /api/bot/player-stats?match_id=<id>
 * Returns live fantasy points for all players in a match.
 * Sorted by fantasy_points descending.
 * Optional: ?search=<name> to filter by player name.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  const search = searchParams.get("search");

  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = createServiceClient();

  let query = admin
    .from("f11_player_stats")
    .select(`
      fantasy_points, runs, balls_faced, fours, sixes, wickets, catches, stumpings, run_outs,
      is_dismissed, overs_bowled, runs_conceded, maidens,
      player:f11_players!player_id(id, name, role, ipl_team)
    `)
    .eq("match_id", match_id)
    .order("fantasy_points", { ascending: false });

  const { data: stats, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let results = (stats ?? []).map((s: any) => ({
    name: s.player?.name ?? "Unknown",
    team: s.player?.ipl_team ?? "",
    role: s.player?.role ?? "",
    points: s.fantasy_points ?? 0,
    runs: s.runs,
    balls: s.balls_faced,
    fours: s.fours,
    sixes: s.sixes,
    wickets: s.wickets,
    catches: s.catches,
    stumpings: s.stumpings,
    overs: s.overs_bowled,
    runs_conceded: s.runs_conceded,
    maidens: s.maidens,
    dismissed: s.is_dismissed,
  }));

  if (search) {
    const q = search.toLowerCase();
    results = results.filter((r) => r.name.toLowerCase().includes(q));
  }

  return NextResponse.json({ stats: results });
}
