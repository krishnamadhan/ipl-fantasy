/**
 * GET /api/bot/leaderboard?match_id=<id>&limit=10
 * Returns the top N entries in the WhatsApp group contest for a match.
 * Returns display_name, team_name, total_points, rank, prize_won.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 20);

  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = await createServiceClient();

  // Find the admin-created group contest (created_by IS NULL) for this match
  const { data: contests } = await admin
    .from("f11_contests")
    .select("id, status, prize_pool")
    .eq("match_id", match_id)
    .is("created_by", null)
    .in("status", ["open", "locked", "live", "completed"])
    .order("created_at", { ascending: true })
    .limit(1);

  const contest = contests?.[0] ?? null;

  if (!contest) return NextResponse.json({ leaderboard: [], contest: null });

  const { data: entries } = await admin
    .from("f11_entries")
    .select(`
      rank, total_points, team_name, prize_won,
      profile:f11_profiles!user_id(display_name, username)
    `)
    .eq("contest_id", contest.id)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("total_points", { ascending: false })
    .limit(limit);

  const leaderboard = (entries ?? []).map((e: any) => ({
    rank: e.rank,
    display_name: e.profile?.display_name ?? e.profile?.username ?? "Unknown",
    team_name: e.team_name,
    points: e.total_points ?? 0,
    prize_won: e.prize_won ?? 0,
  }));

  return NextResponse.json({ leaderboard, contest_status: contest.status });
}
