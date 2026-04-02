import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: contest, error } = await supabase
    .from("f11_contests")
    .select("*, match:f11_matches(*)")
    .eq("id", id)
    .single();

  if (error || !contest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch leaderboard — hide others' teams if match not live/completed
  const matchStatus = contest.match?.status;
  const showTeams = matchStatus === "live" || matchStatus === "completed";

  let entriesQuery = supabase
    .from("f11_entries")
    .select(`id, user_id, team_name, total_points, rank, prize_won, captain_id, vc_id,
             ${showTeams ? "player_ids," : ""}
             profile:f11_profiles(username, display_name, avatar_url)`)
    .eq("contest_id", id)
    .order("total_points", { ascending: false });

  const { data: entries } = await entriesQuery;

  return NextResponse.json({ contest, entries: entries ?? [] });
}
