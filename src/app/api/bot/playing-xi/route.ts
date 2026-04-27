/**
 * GET /api/bot/playing-xi?match_id=<id>
 * Returns confirmed playing XI for both teams (is_playing_xi=true from f11_match_players).
 * Also returns toss info if available.
 *
 * POST /api/bot/playing-xi
 * Body: { match_id }
 * Triggers a Cricbuzz squad sync for the match.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: match } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, toss_winner, batting_first, status")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Get players confirmed for this match
  const { data: matchPlayers } = await admin
    .from("f11_match_players")
    .select(`
      player_id, is_playing_xi, batting_order,
      player:f11_players!player_id(name, role, ipl_team)
    `)
    .eq("match_id", match_id)
    .eq("is_playing_xi", true)
    .order("batting_order", { ascending: true });

  const home: any[] = [];
  const away: any[] = [];

  for (const mp of matchPlayers ?? []) {
    const p = (mp as any).player;
    if (!p) continue;
    const entry = { name: p.name, role: p.role };
    if (p.ipl_team === match.team_home) home.push(entry);
    else away.push(entry);
  }

  return NextResponse.json({
    match: {
      id: match.id,
      team_home: match.team_home,
      team_away: match.team_away,
      toss_winner: match.toss_winner,
      toss_decision: match.batting_first === match.toss_winner ? "bat" : match.toss_winner ? "bowl" : null,
      status: match.status,
    },
    playing_xi: { home, away },
  });
}

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { match_id } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  // Use /api/cron/sync-squads which accepts BOT_SECRET — avoids user-session auth required by admin route
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ipl11.vercel.app";
  const res = await fetch(`${baseUrl}/api/cron/sync-squads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.BOT_SECRET ?? process.env.FANTASY_BOT_SECRET ?? ""}`,
    },
    body: JSON.stringify({ match_id }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
