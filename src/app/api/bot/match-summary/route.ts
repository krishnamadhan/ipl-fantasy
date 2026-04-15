/**
 * GET /api/bot/match-summary?match_id=<id>
 * Returns live score summary + top fantasy performers for a WhatsApp update.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = await createServiceClient();

  const { data: match } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, status, live_score_summary, result_summary, scheduled_at")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Top 3 scorers
  const { data: topStats } = await admin
    .from("f11_player_stats")
    .select("fantasy_points, runs, wickets, catches, player:f11_players!player_id(name, ipl_team, role)")
    .eq("match_id", match_id)
    .order("fantasy_points", { ascending: false })
    .limit(3);

  const top_performers = (topStats ?? []).map((s: any) => ({
    name: s.player?.name ?? "Unknown",
    team: s.player?.ipl_team ?? "",
    points: s.fantasy_points ?? 0,
    summary: buildPerfSummary(s),
  }));

  return NextResponse.json({
    match: {
      id: match.id,
      teams: `${match.team_home} vs ${match.team_away}`,
      status: match.status,
      result_summary: match.result_summary,
      live_score: match.live_score_summary,
    },
    top_performers,
  });
}

function buildPerfSummary(s: any): string {
  const parts: string[] = [];
  if (s.runs > 0) parts.push(`${s.runs}R`);
  if (s.wickets > 0) parts.push(`${s.wickets}W`);
  if (s.catches > 0) parts.push(`${s.catches}ct`);
  return parts.join(", ") || "—";
}
