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

  // 2. Sync f11_entries player/captain/vc data from their linked f11_teams.
  //    Needed when teams were edited before the teams/route.ts sync fix was deployed:
  //    f11_teams.player_ids is correct but f11_entries.player_ids may be stale.
  //    f11_update_leaderboard reads from f11_teams when team_id IS NOT NULL, so this
  //    step is belt-and-suspenders — but it also keeps f11_entries consistent for
  //    other consumers (diff view, team-view page, etc.).
  let recalcOk = false;
  if (matchId) {
    const admin = createServiceClient();
    try {
      // Find all contest IDs for this match, then get their entries with linked teams
      const { data: contests } = await admin
        .from("f11_contests")
        .select("id")
        .eq("match_id", matchId);
      const contestIds = (contests ?? []).map((c: any) => c.id as string);

      const { data: entries } = contestIds.length
        ? await admin
            .from("f11_entries")
            .select("id, team_id")
            .in("contest_id", contestIds)
            .not("team_id", "is", null)
        : { data: [] };

      if (entries?.length) {
        const teamIds = [...new Set(entries.map((e: any) => e.team_id as string))];
        const { data: teams } = await admin
          .from("f11_teams")
          .select("id, player_ids, captain_id, vc_id, team_name")
          .in("id", teamIds);

        if (teams?.length) {
          const teamMap = new Map(teams.map((t: any) => [t.id, t]));
          // Batch-update each entry from its team
          await Promise.all(
            entries.map((entry: any) => {
              const t = teamMap.get(entry.team_id);
              if (!t) return Promise.resolve();
              return admin
                .from("f11_entries")
                .update({ player_ids: t.player_ids, captain_id: t.captain_id, vc_id: t.vc_id, team_name: t.team_name })
                .eq("id", entry.id);
            })
          );
        }
      }
    } catch (e: any) {
      console.warn("[bot/sync] entry resync warning:", e.message);
    }

    // 3. Recalculate leaderboard totals — works for any match status.
    try {
      const { error } = await admin.rpc("f11_update_leaderboard", { p_match_id: matchId });
      recalcOk = !error;
      if (error) console.error("[bot/sync] f11_update_leaderboard error:", error.message);
    } catch (e: any) {
      console.error("[bot/sync] recalc error:", e.message);
    }
  }

  return NextResponse.json({ ok: liveOk || recalcOk, synced: recalcOk ? 1 : 0 });
}
