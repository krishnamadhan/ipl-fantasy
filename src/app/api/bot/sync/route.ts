/**
 * POST /api/bot/sync
 * Triggers a live score sync for the current match.
 * Called by BanterAgent when a user requests the leaderboard — ensures fresh scores.
 *
 * Flow:
 * 1. Call /api/cron/sync-live to fetch latest Cricbuzz scores (live matches only)
 * 2. Directly call f11_update_leaderboard for the requested match_id — this
 *    recalculates entry totals from current f11_player_stats and f11_teams/f11_entries,
 *    and works even for completed/in_review matches (so team edits take effect retroactively).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const cronSecret = process.env.CRON_SECRET ?? "";
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const matchId: string | undefined = body.match_id;

  // Derive internal base URL from the incoming request
  const { origin } = new URL(req.url);

  // 1. Trigger live score sync (only processes matches with status='live')
  let liveOk = false;
  try {
    const res = await fetch(`${origin}/api/cron/sync-live`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(8000),
    });
    liveOk = res.ok;
  } catch {
    // Timeout or network error — non-fatal
  }

  // 2. Directly recalculate the leaderboard for the specified match via RPC.
  //    This works regardless of match status (live, in_review, completed) and
  //    ensures that team edits (which update f11_teams/f11_entries) are reflected
  //    in total_points even after sync-live has stopped running for that match.
  let recalcOk = false;
  if (matchId) {
    try {
      const admin = createServiceClient();
      const { error } = await admin.rpc("f11_update_leaderboard", { p_match_id: matchId });
      recalcOk = !error;
      if (error) console.error("[bot/sync] f11_update_leaderboard error:", error.message);
    } catch (e: any) {
      console.error("[bot/sync] recalc error:", e.message);
    }
  }

  return NextResponse.json({ ok: liveOk || recalcOk, synced: recalcOk ? 1 : 0 });
}
