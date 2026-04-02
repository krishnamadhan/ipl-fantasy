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

  // ── 1. AUTO-OPEN: scheduled matches starting within 24h ──────────────────
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
    errors: errors.length ? errors : undefined,
    checkedAt: now,
  });
}

// Allow manual trigger from admin
export async function POST(req: NextRequest) {
  return GET(req);
}
