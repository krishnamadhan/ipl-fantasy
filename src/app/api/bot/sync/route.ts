/**
 * POST /api/bot/sync
 * Triggers a live score sync for the current match.
 * Called by BanterAgent when a user requests the leaderboard — ensures fresh scores.
 *
 * Internally calls /api/cron/sync-live using CRON_SECRET, which:
 *   1. Fetches latest scores from Cricbuzz
 *   2. Upserts f11_player_stats + fantasy_points
 *   3. Calls f11_update_leaderboard to recalculate ranks
 */
import { NextRequest, NextResponse } from "next/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const cronSecret = process.env.CRON_SECRET ?? "";
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }

  // Derive internal base URL from the incoming request
  const { origin } = new URL(req.url);

  try {
    const res = await fetch(`${origin}/api/cron/sync-live`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(8000), // 8s — don't hold up the leaderboard response
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, synced: data.synced ?? 0 });
  } catch (e: any) {
    // Timeout or network error — non-fatal, leaderboard will use cached scores
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
