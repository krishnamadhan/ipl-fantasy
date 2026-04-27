/**
 * Bot-facing contest API.
 *
 * POST /api/bot/contest
 *   Body: { match_id, group_name }
 *   Creates a private group contest. Idempotent — returns existing if already exists.
 *   Bot-created contests are identified by created_by = null + contest_type = 'private'.
 *
 * GET /api/bot/contest?match_id=<id>
 *   Returns the active group contest (invite_code, entry count, status).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";
import { generateInviteCode } from "@/lib/utils/invite-code";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = createServiceClient();

  // Bot-created contests: created_by is null, contest_type private
  const { data: contest } = await admin
    .from("f11_contests")
    .select("id, name, invite_code, status, entry_fee, prize_pool, max_teams")
    .eq("match_id", match_id)
    .eq("contest_type", "private")
    .is("created_by", null)
    .limit(1)
    .maybeSingle();

  if (!contest) return NextResponse.json({ contest: null });

  const { count } = await admin
    .from("f11_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contest.id);

  return NextResponse.json({ contest: { ...contest, entry_count: count ?? 0 } });
}

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { match_id, group_name = "WhatsApp Group" } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = createServiceClient();

  // Idempotency check
  const { data: existing } = await admin
    .from("f11_contests")
    .select("id, name, invite_code, status, entry_fee, prize_pool, max_teams")
    .eq("match_id", match_id)
    .eq("contest_type", "private")
    .is("created_by", null)
    .limit(1)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, contest: existing, created: false });

  const { data: match } = await admin
    .from("f11_matches")
    .select("id, status, team_home, team_away")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (!["scheduled", "open"].includes(match.status)) {
    return NextResponse.json({ error: `Match not open for contest creation (status: ${match.status})` }, { status: 400 });
  }

  const invite_code = generateInviteCode();

  const { data: contest, error } = await admin
    .from("f11_contests")
    .insert({
      match_id,
      created_by: null,
      name: `${group_name} — ${match.team_home} vs ${match.team_away}`,
      contest_type: "private",
      entry_fee: 0,       // Free contest — bragging rights only, no money charged
      max_teams: 50,
      prize_pool_type: "winner_takes_all",
      prize_pool: 0,
      invite_code,
      status: "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed f11_match_players for both teams so squad is immediately available for team selection.
  // Fire-and-forget — don't block the contest creation response.
  admin
    .from("f11_players")
    .select("id")
    .in("ipl_team", [match.team_home, match.team_away])
    .eq("is_playing", true)
    .then(({ data: players }) => {
      if (!players?.length) return;
      const rows = players.map((p) => ({ match_id, player_id: p.id, is_playing_xi: null }));
      return admin.from("f11_match_players").upsert(rows, { onConflict: "match_id,player_id" });
    })
    .catch((e) => console.error("[bot/contest] match_players seed failed:", e?.message));

  return NextResponse.json({ ok: true, contest, created: true });
}
