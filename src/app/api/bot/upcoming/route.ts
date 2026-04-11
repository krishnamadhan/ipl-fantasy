/**
 * GET /api/bot/upcoming
 * Returns matches scheduled in the next 48h (status: scheduled or open).
 * Used by BanterAgent to decide when to drop the pre-match announcement.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const admin = await createServiceClient();
  const now = new Date().toISOString();
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  // Also include matches that started within the last 4h — covers bot restarts mid-match
  const minus4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const { data: matches, error } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, scheduled_at, status, venue, cricapi_match_id")
    .in("status", ["scheduled", "open", "locked", "live"])
    .lte("scheduled_at", in48h)
    .gte("scheduled_at", minus4h)
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ matches: matches ?? [] });
}
