/**
 * MIGRATION REQUIRED — run once in Supabase SQL Editor:
 *   ALTER TABLE f11_matches ADD COLUMN IF NOT EXISTS toss_detected_at timestamptz;
 *   ALTER TABLE f11_matches ADD COLUMN IF NOT EXISTS batting_first text;
 *
 * Enforce match deadlines — called every 5 minutes via Vercel Cron.
 *
 * Jobs (in order):
 * 1. AUTO-OPEN:         scheduled matches starting within 24h → open
 * 2. TOSS DETECTION:    open matches within 90 min of start → poll Cricbuzz for toss_winner
 * 3. XI SYNC:           open matches with toss confirmed ≥ 10 min ago → sync playing XI
 *                       (gives users ~20 min to update team before match lock)
 * 4. AUTO-LOCK:         open matches whose start time has passed → locked + lock contests
 * 5. FORGOTTEN-LOCK:    scheduled matches already past start → locked
 * 6. STALE-REVIEW:      locked matches >6h past start → in_review (edge case safety net)
 *
 * NOTE: locked → live is a manual admin action ("Go Live" button).
 *       Playing XI is synced BEFORE match start (step 3), not at live.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

async function cbGet(path: string): Promise<any | null> {
  try {
    const res = await fetch(`https://${CB_HOST}${path}`, {
      headers: cbHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createServiceClient();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const in24h = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
  const in90m = new Date(nowMs + 90 * 60 * 1000).toISOString();

  const opened: string[] = [];
  const locked: string[] = [];
  const tossDetected: string[] = [];
  const xiSynced: string[] = [];
  const errors: string[] = [];

  // ── 1. AUTO-OPEN: scheduled matches starting within 24h ──────────────────
  const { data: toOpen } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", in24h)
    .gte("scheduled_at", now);

  for (const m of toOpen ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "open" })
      .eq("id", m.id)
      .eq("status", "scheduled");

    if (error) {
      errors.push(`open ${m.id}: ${error.message}`);
    } else {
      await admin
        .from("f11_contests")
        .update({ status: "open" })
        .eq("match_id", m.id)
        .eq("status", "scheduled");
      opened.push(`${m.team_home} vs ${m.team_away}`);
    }
  }

  // ── 2. TOSS DETECTION: open matches within 90 min of start ───────────────
  // Poll Cricbuzz for toss result. Once toss_winner is set in DB, step 3 can
  // trigger playing XI sync 10 min later, giving users ~20 min before lock.
  if (process.env.RAPIDAPI_KEY) {
    const { data: nearMatches } = await admin
      .from("f11_matches")
      .select("id, team_home, team_away, cricapi_match_id, toss_winner, scheduled_at")
      .eq("status", "open")
      .is("toss_winner", null)
      .lte("scheduled_at", in90m)
      .gte("scheduled_at", now); // still in future (not yet locked)

    for (const m of nearMatches ?? []) {
      if (!m.cricapi_match_id) continue;

      const data = await cbGet(`/mcenter/v1/${m.cricapi_match_id}`);
      if (!data) continue;

      const mi = data.matchInfo ?? data.matchHeader ?? data;
      const tossWinner = mi.tossResults?.tossWinnerName ?? null;

      if (tossWinner) {
        const batting_first = mi.tossResults?.decision?.toLowerCase()?.includes("bat")
          ? tossWinner
          : null;

        const { error } = await admin
          .from("f11_matches")
          .update({
            toss_winner: tossWinner,
            ...(batting_first ? { batting_first } : {}),
            toss_detected_at: new Date().toISOString(),
          })
          .eq("id", m.id)
          .is("toss_winner", null); // guard: only set once

        if (!error) {
          tossDetected.push(`${m.team_home} vs ${m.team_away} → ${tossWinner}`);
        } else {
          errors.push(`toss-update ${m.id}: ${error.message}`);
        }
      }
    }
  }

  // ── 3. XI SYNC: open matches where toss was detected ≥ 10 min ago ────────
  // Trigger playing XI sync to give users time to update their team before lock.
  const tenMinAgo = new Date(nowMs - 10 * 60 * 1000).toISOString();

  const { data: tossedMatches } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, toss_detected_at")
    .eq("status", "open")
    .not("toss_winner", "is", null)
    .lte("toss_detected_at", tenMinAgo) // toss happened ≥ 10 min ago
    .gte("scheduled_at", now);          // match not yet started (still open window)

  for (const m of tossedMatches ?? []) {
    // Check if XI already synced for this match
    const { count } = await admin
      .from("f11_match_players")
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", m.id)
      .eq("is_playing_xi", true);

    if ((count ?? 0) > 0) continue; // already synced

    try {
      const origin = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
      const res = await fetch(`${origin}/api/admin/matches/${m.id}/sync-playing-xi`, {
        method: "POST",
        headers: { "x-internal-cron": process.env.CRON_SECRET ?? "internal" },
        signal: AbortSignal.timeout(15000),
      });
      const result = await res.json();
      if (result.playingCount > 0) {
        xiSynced.push(`${m.team_home} vs ${m.team_away} (${result.playingCount} players)`);
      }
    } catch (e: any) {
      errors.push(`xi-sync ${m.id}: ${e.message}`);
    }
  }

  // ── 4. AUTO-LOCK: open matches whose start time has passed ────────────────
  const { data: toLock } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away")
    .eq("status", "open")
    .lt("scheduled_at", now);

  for (const m of toLock ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "locked" })
      .eq("id", m.id)
      .eq("status", "open");

    if (error) {
      errors.push(`lock ${m.id}: ${error.message}`);
    } else {
      await admin
        .from("f11_contests")
        .update({ status: "locked" })
        .eq("match_id", m.id)
        .eq("status", "open");
      locked.push(`${m.team_home} vs ${m.team_away}`);
    }
  }

  // ── 5. FORGOTTEN-LOCK: scheduled matches already past start ──────────────
  const { data: forgottenScheduled } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away")
    .eq("status", "scheduled")
    .lt("scheduled_at", now);

  for (const m of forgottenScheduled ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "locked" })
      .eq("id", m.id)
      .eq("status", "scheduled");

    if (error) {
      errors.push(`lock-forgotten ${m.id}: ${error.message}`);
    } else {
      locked.push(`${m.team_home} vs ${m.team_away} (auto-locked, missed open window)`);
    }
  }

  // ── 6. STALE-REVIEW: locked matches >6h past start → in_review ───────────
  const staleThreshold = new Date(nowMs - 6 * 60 * 60 * 1000).toISOString();
  const staleMovedToReview: string[] = [];

  const { data: staleLocked } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away")
    .eq("status", "locked")
    .lt("scheduled_at", staleThreshold);

  for (const m of staleLocked ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "in_review" })
      .eq("id", m.id)
      .eq("status", "locked");

    if (error) {
      errors.push(`stale-locked ${m.id}: ${error.message}`);
    } else {
      await admin
        .from("f11_contests")
        .update({ status: "locked" })
        .eq("match_id", m.id)
        .in("status", ["open", "scheduled"]);
      staleMovedToReview.push(`${m.team_home} vs ${m.team_away}`);
    }
  }

  return NextResponse.json({
    ok: true,
    opened:       opened.length       ? opened       : undefined,
    tossDetected: tossDetected.length ? tossDetected : undefined,
    xiSynced:     xiSynced.length     ? xiSynced     : undefined,
    locked:       locked.length       ? locked       : undefined,
    movedToReview: staleMovedToReview.length ? staleMovedToReview : undefined,
    errors:       errors.length       ? errors       : undefined,
    checkedAt: now,
  });
}

// Allow manual trigger from admin
export async function POST(req: NextRequest) {
  return GET(req);
}
