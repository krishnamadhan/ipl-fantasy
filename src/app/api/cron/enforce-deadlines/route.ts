/**
 * Enforce match deadlines — called every 5 minutes via Vercel Cron.
 *
 * Two jobs:
 * 1. AUTO-OPEN: scheduled matches whose start time is within 24h → status=open
 * 2. AUTO-LOCK: open matches whose start time has passed → status=locked + lock contests
 *
 * NOTE: locked → live is a manual admin action ("Go Live" button) to allow
 * admin to verify playing XI / toss before starting live scoring.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createServiceClient();
  const now = new Date().toISOString();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const opened: string[] = [];
  const locked: string[] = [];
  const errors: string[] = [];

  // ── 1. AUTO-OPEN: scheduled matches starting within 24h (and not yet started) ──
  const { data: toOpen } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", in24h)
    .gte("scheduled_at", now); // not yet started

  for (const m of toOpen ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "open" })
      .eq("id", m.id)
      .eq("status", "scheduled"); // guard against concurrent runs

    if (error) {
      errors.push(`open ${m.id}: ${error.message}`);
    } else {
      // Open all scheduled contests for this match
      await admin
        .from("f11_contests")
        .update({ status: "open" })
        .eq("match_id", m.id)
        .eq("status", "scheduled");

      opened.push(`${m.team_home} vs ${m.team_away}`);
    }
  }

  // ── 1b. AUTO-LOCK FORGOTTEN: scheduled matches whose start time already passed ──
  // If admin forgot to open before match start, jump directly to locked.
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

  // ── 1b2. AUTO-LIVE: locked matches 25+ min past scheduled time → live ────────
  // Match has started (lock happened at start time). After 25 min the toss is done
  // and the match is underway — auto-promote to live so scoring begins without admin.
  const autoLiveThreshold = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const autoLived: string[] = [];

  const { data: toAutoLive } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away")
    .eq("status", "locked")
    .lt("scheduled_at", autoLiveThreshold)
    .gt("scheduled_at", staleThreshold); // exclude stale (>6h) — those go to in_review below

  for (const m of toAutoLive ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "live" })
      .eq("id", m.id)
      .eq("status", "locked");

    if (!error) {
      // Lock all open/scheduled contests — teams are frozen once live
      await admin
        .from("f11_contests")
        .update({ status: "locked" })
        .eq("match_id", m.id)
        .in("status", ["open", "scheduled"]);

      // Immediately trigger a playing XI sync via internal call
      try {
        const origin = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
        await fetch(`${origin}/api/admin/matches/${m.id}/sync-playing-xi`, {
          method: "POST",
          headers: { "x-internal-cron": process.env.CRON_SECRET ?? "internal" },
        });
      } catch { /* non-fatal — scoring will work even without XI data */ }
      autoLived.push(`${m.team_home} vs ${m.team_away}`);
    } else {
      errors.push(`auto-live ${m.id}: ${error.message}`);
    }
  }

  // ── 1c. AUTO-STALE: locked matches >6h past scheduled time → in_review ──────
  // If a match was never promoted to live (edge case) and the window has passed.
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
      // Lock any still-open contests
      await admin
        .from("f11_contests")
        .update({ status: "locked" })
        .eq("match_id", m.id)
        .in("status", ["open", "scheduled"]);

      staleMovedToReview.push(`${m.team_home} vs ${m.team_away}`);
    }
  }

  // ── 2. AUTO-LOCK: open matches whose start time has passed ───────────────
  // Transitions open → locked (teams frozen). Admin must manually click "Go Live".
  const { data: toLock } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, scheduled_at")
    .eq("status", "open")
    .lt("scheduled_at", now); // start time is in the past

  for (const m of toLock ?? []) {
    const { error } = await admin
      .from("f11_matches")
      .update({ status: "locked" })
      .eq("id", m.id)
      .eq("status", "open"); // guard

    if (error) {
      errors.push(`lock ${m.id}: ${error.message}`);
    } else {
      // Lock all open contests — no more joins
      await admin
        .from("f11_contests")
        .update({ status: "locked" })
        .eq("match_id", m.id)
        .eq("status", "open");

      locked.push(`${m.team_home} vs ${m.team_away}`);
    }
  }

  return NextResponse.json({
    ok: true,
    opened,
    locked,
    autoLived: autoLived.length ? autoLived : undefined,
    movedToReview: staleMovedToReview.length ? staleMovedToReview : undefined,
    errors: errors.length ? errors : undefined,
    checkedAt: now,
  });
}

// Allow manual trigger from admin
export async function POST(req: NextRequest) {
  return GET(req);
}
