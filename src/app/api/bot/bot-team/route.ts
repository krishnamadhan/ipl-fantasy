/**
 * Bot team management — creates/updates the "machi" fantasy entry.
 *
 * POST /api/bot/bot-team
 *   Body: { match_id, contest_id, team_name, player_ids, captain_id, vc_id }
 *   Creates (or replaces) the bot's entry for a match and joins the contest.
 *
 * PUT /api/bot/bot-team
 *   Body: { match_id, player_ids, captain_id, vc_id }
 *   Updates the bot's picks after playing XI is confirmed. Only allowed while match is open.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

const BOT_USER_ID = process.env.BOT_USER_ID;

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();
  if (!BOT_USER_ID) return NextResponse.json({ error: "BOT_USER_ID not configured" }, { status: 500 });

  const { match_id, contest_id, team_name, player_ids, captain_id, vc_id } = await req.json();

  if (!match_id || !contest_id || !player_ids?.length || !captain_id || !vc_id)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  if (player_ids.length !== 11)
    return NextResponse.json({ error: "Must pick exactly 11 players" }, { status: 400 });

  const admin = await createServiceClient();

  // Check match is still open
  const { data: match } = await admin
    .from("f11_matches")
    .select("status")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "live" || match.status === "completed")
    return NextResponse.json({ error: "Match already started — team locked" }, { status: 409 });

  // Upsert entry (one per user per contest)
  const { data: entry, error } = await admin
    .from("f11_entries")
    .upsert(
      {
        contest_id,
        user_id: BOT_USER_ID,
        team_name: team_name ?? "machi",
        player_ids,
        captain_id,
        vc_id,
        entry_fee_paid: 0,
      },
      { onConflict: "contest_id,user_id" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entry_id: entry.id });
}

export async function PUT(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();
  if (!BOT_USER_ID) return NextResponse.json({ error: "BOT_USER_ID not configured" }, { status: 500 });

  const { match_id, player_ids, captain_id, vc_id } = await req.json();

  if (!match_id || !player_ids?.length || !captain_id || !vc_id)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  if (player_ids.length !== 11)
    return NextResponse.json({ error: "Must pick exactly 11 players" }, { status: 400 });

  const admin = await createServiceClient();

  // Check match is still open (can't edit after first ball)
  const { data: match } = await admin
    .from("f11_matches")
    .select("status")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "live" || match.status === "completed")
    return NextResponse.json({ error: "Match already started — team locked" }, { status: 409 });

  // Find the contest for this match (bot-created, private)
  const { data: contest } = await admin
    .from("f11_contests")
    .select("id")
    .eq("match_id", match_id)
    .is("created_by", null)
    .maybeSingle();

  if (!contest) return NextResponse.json({ error: "No contest found for this match" }, { status: 404 });

  // Find the bot's existing entry
  const { data: existingEntry } = await admin
    .from("f11_entries")
    .select("id")
    .eq("user_id", BOT_USER_ID)
    .eq("contest_id", contest.id)
    .maybeSingle();

  if (!existingEntry) {
    // No existing entry — nothing to update (bot hasn't joined yet)
    return NextResponse.json({ error: "No existing bot entry for this match" }, { status: 404 });
  }

  const { error } = await admin
    .from("f11_entries")
    .update({ player_ids, captain_id, vc_id })
    .eq("id", existingEntry.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
