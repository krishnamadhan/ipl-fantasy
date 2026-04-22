import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createServiceClient();

  const { data: contest, error } = await admin
    .from("f11_contests")
    .select("*, match:f11_matches(*)")
    .eq("id", id)
    .single();

  if (error || !contest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Hide player picks until locked/live/completed
  const matchStatus = contest.match?.status;
  const showTeams = ["locked", "live", "in_review", "completed"].includes(matchStatus);

  // Use service client — leaderboard must show all entries, not just caller's own
  const { data: entries } = await admin
    .from("f11_entries")
    .select(`id, user_id, team_name, total_points, rank, prize_won, captain_id, vc_id,
             ${showTeams ? "player_ids," : ""}
             profile:f11_profiles(username, display_name, avatar_url)`)
    .eq("contest_id", id)
    .order("total_points", { ascending: false });

  return NextResponse.json({ contest, entries: entries ?? [] });
}
