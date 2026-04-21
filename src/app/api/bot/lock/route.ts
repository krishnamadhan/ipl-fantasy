/**
 * POST /api/bot/lock
 * Body: { match_id }
 * Locks a match (open → locked) and all its contests.
 * This is triggered by admin !fantasy lock from WhatsApp.
 *
 * POST /api/bot/lock with { match_id, action: "go_live" }
 * Transitions locked → live (starts scoring).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { match_id, action = "lock" } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = createServiceClient();

  if (action === "go_live") {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "live" })
      .eq("id", match_id)
      .eq("status", "locked");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark contests as live — only update already-locked contests
    await admin
      .from("f11_contests")
      .update({ status: "live" })
      .eq("match_id", match_id)
      .eq("status", "locked");

    return NextResponse.json({ ok: true, action: "go_live" });
  }

  // Default: open → locked
  const { data: match } = await admin
    .from("f11_matches")
    .select("status")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "locked" || match.status === "live") {
    return NextResponse.json({ ok: true, already: true, status: match.status });
  }
  if (match.status !== "open") {
    return NextResponse.json({ error: `Cannot lock match with status: ${match.status}` }, { status: 400 });
  }

  const { error } = await admin
    .from("f11_matches")
    .update({ status: "locked" })
    .eq("id", match_id)
    .eq("status", "open");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("f11_contests")
    .update({ status: "locked" })
    .eq("match_id", match_id)
    .eq("status", "open");

  return NextResponse.json({ ok: true, action: "lock" });
}
