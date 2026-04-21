import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/contests/switch-team
 * Swap which team is representing the user in a contest entry.
 * Only allowed while match is still open.
 *
 * Body: { entry_id: string, new_team_id: string }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { entry_id, new_team_id } = body;

  if (!entry_id || !new_team_id) {
    return NextResponse.json({ error: "entry_id and new_team_id required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Fetch the existing entry — must belong to this user
  const { data: entry } = await service
    .from("f11_entries")
    .select("id, user_id, contest_id, team_id")
    .eq("id", entry_id)
    .single();

  if (!entry || entry.user_id !== user.id) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (entry.team_id === new_team_id) {
    return NextResponse.json({ error: "New team is the same as current team" }, { status: 400 });
  }

  // Fetch contest + match to check state
  const { data: contest } = await service
    .from("f11_contests")
    .select("id, match_id, status")
    .eq("id", entry.contest_id)
    .single();

  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const { data: match } = await service
    .from("f11_matches")
    .select("status")
    .eq("id", contest.match_id)
    .single();

  if (match?.status !== "open") {
    return NextResponse.json({ error: "Team switching is only allowed before the deadline" }, { status: 400 });
  }

  // Fetch the new team — must belong to this user and same match
  const { data: newTeam } = await service
    .from("f11_teams")
    .select("id, user_id, match_id, player_ids, captain_id, vc_id, team_name")
    .eq("id", new_team_id)
    .single();

  if (!newTeam || newTeam.user_id !== user.id) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  if (newTeam.match_id !== contest.match_id) {
    return NextResponse.json({ error: "Team is for a different match" }, { status: 400 });
  }

  // Ensure the new team isn't already in this contest (different entry)
  const { data: clash } = await service
    .from("f11_entries")
    .select("id")
    .eq("contest_id", entry.contest_id)
    .eq("team_id", new_team_id)
    .neq("id", entry_id)
    .maybeSingle();

  if (clash) {
    return NextResponse.json({ error: "That team has already joined this contest" }, { status: 400 });
  }

  // Update the entry
  const { error } = await service
    .from("f11_entries")
    .update({
      team_id:    new_team_id,
      player_ids: newTeam.player_ids,
      captain_id: newTeam.captain_id,
      vc_id:      newTeam.vc_id,
      team_name:  newTeam.team_name,
    })
    .eq("id", entry_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
