import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils/invite-code";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    match_id, name, contest_type, entry_fee = 0,
    max_teams = 100, prize_pool_type = "winner_takes_all",
  } = body;

  if (!match_id || !name || !contest_type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!["mega", "small", "h2h", "private"].includes(contest_type)) {
    return NextResponse.json({ error: "Invalid contest type" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify match exists and is open for contest creation
  const { data: match } = await service
    .from("f11_matches")
    .select("status")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (!["scheduled", "open"].includes(match.status)) {
    return NextResponse.json({ error: "Cannot create contest for this match" }, { status: 400 });
  }

  const prize_pool = entry_fee * max_teams * 0.9; // 10% platform cut
  const invite_code = contest_type === "private" ? generateInviteCode() : null;

  const { data: contest, error } = await service
    .from("f11_contests")
    .insert({
      match_id,
      created_by: user.id,
      name,
      contest_type,
      invite_code,
      entry_fee,
      max_teams,
      prize_pool_type,
      prize_pool,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, contest });
}
