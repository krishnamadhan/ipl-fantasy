import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { contest_id, team_id } = body;

  if (!contest_id || !team_id) {
    return NextResponse.json({ error: "contest_id and team_id required" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Verify team belongs to user
  const { data: team } = await service
    .from("f11_teams")
    .select("id, user_id, match_id, player_ids, captain_id, vc_id, team_name")
    .eq("id", team_id)
    .single();

  if (!team || team.user_id !== user.id) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get contest + entry count
  const { data: contest } = await service
    .from("f11_contests")
    .select("id, name, status, entry_fee, max_teams, match_id, prize_pool")
    .eq("id", contest_id)
    .single();

  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (contest.status !== "open") return NextResponse.json({ error: "Contest is not open" }, { status: 400 });

  // Verify match is still open for entries
  const { data: contestMatch } = await service
    .from("f11_matches")
    .select("status")
    .eq("id", contest.match_id)
    .single();

  if (contestMatch?.status !== "open") {
    return NextResponse.json({ error: "Team deadline has passed — entries are closed" }, { status: 400 });
  }

  // Verify team is for the same match
  if (team.match_id !== contest.match_id) {
    return NextResponse.json({ error: "Team is for a different match" }, { status: 400 });
  }

  // Check spots
  const { count: entryCount } = await service
    .from("f11_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contest_id);

  if ((entryCount ?? 0) >= contest.max_teams) {
    return NextResponse.json({ error: "Contest is full" }, { status: 400 });
  }

  // Check per-user entry count for this contest (max 3 teams)
  const MAX_TEAMS_PER_CONTEST = 3;
  const { count: userEntryCount } = await service
    .from("f11_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contest_id)
    .eq("user_id", user.id);

  if ((userEntryCount ?? 0) >= MAX_TEAMS_PER_CONTEST) {
    return NextResponse.json(
      { error: `Maximum ${MAX_TEAMS_PER_CONTEST} teams per contest` },
      { status: 400 }
    );
  }

  // Check this specific team hasn't already joined this contest
  const { data: existing } = await service
    .from("f11_entries")
    .select("id")
    .eq("contest_id", contest_id)
    .eq("team_id", team_id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "This team has already joined this contest" }, { status: 400 });

  // Deduct wallet
  if (contest.entry_fee > 0) {
    const { error: deductErr } = await service.rpc("f11_deduct_wallet", {
      p_user_id: user.id,
      p_amount: contest.entry_fee,
      p_reason: `Entry: ${contest.name}`,
      p_reference_id: contest_id,
    });
    if (deductErr) {
      return NextResponse.json({ error: deductErr.message ?? "Insufficient balance" }, { status: 400 });
    }
  }

  // Create entry
  const { data: entry, error: entryErr } = await service
    .from("f11_entries")
    .insert({
      contest_id,
      user_id: user.id,
      team_id,
      player_ids: team.player_ids,
      captain_id: team.captain_id,
      vc_id: team.vc_id,
      team_name: team.team_name,
      entry_fee_paid: contest.entry_fee,
    })
    .select()
    .single();

  if (entryErr) {
    if (contest.entry_fee > 0) {
      await service.rpc("f11_credit_wallet", {
        p_user_id: user.id,
        p_amount: contest.entry_fee,
        p_reason: "Refund: entry failed",
        p_reference_id: contest_id,
      });
    }
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entry });
}
