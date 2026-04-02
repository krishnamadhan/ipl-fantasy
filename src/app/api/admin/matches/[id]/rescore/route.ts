import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calcFantasyPoints } from "@/lib/fantasy/scoring";

// Force-recalculates fantasy points for all players in a match,
// then re-runs the leaderboard update. Use to fix scorecard errors.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch all stats for this match with player role
  const { data: stats } = await service
    .from("f11_player_stats")
    .select("*, player:f11_players(role)")
    .eq("match_id", matchId);

  if (!stats?.length) {
    return NextResponse.json({ ok: true, message: "No stats to rescore", rescored: 0 });
  }

  let rescored = 0;
  for (const s of stats) {
    const role = (Array.isArray(s.player) ? s.player[0] : s.player)?.role as "WK" | "BAT" | "AR" | "BOWL";
    if (!role) continue;

    const breakdown = calcFantasyPoints(
      {
        runs: s.runs ?? 0,
        balls_faced: s.balls_faced ?? 0,
        fours: s.fours ?? 0,
        sixes: s.sixes ?? 0,
        is_dismissed: s.is_dismissed ?? false,
        overs_bowled: s.overs_bowled ?? 0,
        wickets: s.wickets ?? 0,
        runs_conceded: s.runs_conceded ?? 0,
        maidens: s.maidens ?? 0,
        catches: s.catches ?? 0,
        stumpings: s.stumpings ?? 0,
        run_outs: s.run_outs ?? 0,
        run_outs_assist: s.run_outs_assist ?? 0,
        batting_position: s.batting_position ?? null,
        wides: 0,
      },
      role,
      s.is_playing_xi ?? true,
    );

    const { error } = await service
      .from("f11_player_stats")
      .update({ fantasy_points: breakdown.total, points_breakdown: breakdown })
      .eq("id", s.id);

    if (!error) rescored++;
  }

  // Re-run leaderboard recalculation
  await service.rpc("f11_update_leaderboard", { p_match_id: matchId });

  return NextResponse.json({ ok: true, rescored });
}
