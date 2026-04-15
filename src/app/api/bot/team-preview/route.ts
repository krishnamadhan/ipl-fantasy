/**
 * GET /api/bot/team-preview?match_id=<id>
 * Returns top fantasy picks for each team, ranked by venue-aware role priority.
 * Used by BanterAgent to build match announcements with star player suggestions.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

// Venue keyword → role priority order (most valuable first for that ground)
const VENUE_ROLE_PRIORITY: Record<string, string[]> = {
  chinnaswamy: ["AR", "WK", "BAT", "BOWL"],  // batting paradise
  wankhede:    ["AR", "WK", "BAT", "BOWL"],  // batting-friendly, dew
  eden:        ["AR", "BOWL", "BAT", "WK"],  // spin-friendly
  chidambaram: ["BOWL", "AR", "BAT", "WK"], // spin heaven
  chepauk:     ["BOWL", "AR", "BAT", "WK"],
  "narendra modi": ["AR", "BOWL", "BAT", "WK"], // balanced, big ground
  "rajiv gandhi":  ["AR", "WK", "BAT", "BOWL"],
  punjab:      ["AR", "WK", "BAT", "BOWL"],  // flat track
  "dy patil":  ["AR", "WK", "BAT", "BOWL"],
  brabourne:   ["AR", "WK", "BAT", "BOWL"],
};

const VENUE_TIPS: Record<string, string> = {
  chinnaswamy: "🔥 Batting paradise — 200+ expected. Pick ARs & power hitters. Avoid pure spinners.",
  wankhede:    "🌙 Dew factor favors chasing. ARs and top-order batters are gold.",
  eden:        "🌀 Spin-friendly. Low-moderate scores (160-180). Spinners are must-picks.",
  chidambaram: "🌀 Spin heaven. Wickets fall in clusters. Pick quality spinners + openers.",
  chepauk:     "🌀 Spin heaven. Wickets fall in clusters. Pick quality spinners + openers.",
  "narendra modi": "⚖️ Big ground, balanced. Pacers dominate early. Quality all-rounders safe.",
  "rajiv gandhi":  "🏏 Flat track, dew in 2nd innings. ARs + top-order batters shine.",
  punjab:      "🏏 Batter's paradise. Power hitters score big. Short square boundaries.",
  "dy patil":  "⚖️ Balanced surface. Pace gets early help, settles later.",
  brabourne:   "🏏 True surface, high scores. Batters + ARs preferred.",
};

function getVenueKey(venue: string): string | null {
  const v = venue.toLowerCase();
  for (const key of Object.keys(VENUE_ROLE_PRIORITY)) {
    if (v.includes(key)) return key;
  }
  return null;
}

function pickTopPlayers(
  players: any[],
  rolePriority: string[],
  count = 5
): any[] {
  const picked: any[] = [];

  for (const role of rolePriority) {
    if (picked.length >= count) break;
    const inRole = players.filter((p) => p.role === role && !picked.includes(p));
    // Take up to 2 per role to keep variety
    picked.push(...inRole.slice(0, 2));
  }

  return picked.slice(0, count);
}

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = await createServiceClient();

  const { data: match } = await admin
    .from("f11_matches")
    .select("id, team_home, team_away, venue, status, scheduled_at")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { data: players } = await admin
    .from("f11_players")
    .select("name, ipl_team, role, credit_value")
    .in("ipl_team", [match.team_home, match.team_away]);

  const homePlayers = (players ?? []).filter((p) => p.ipl_team === match.team_home);
  const awayPlayers = (players ?? []).filter((p) => p.ipl_team === match.team_away);

  const venueKey = getVenueKey(match.venue ?? "");
  const rolePriority = venueKey
    ? VENUE_ROLE_PRIORITY[venueKey]!
    : ["AR", "WK", "BAT", "BOWL"];
  const venueTip = venueKey
    ? VENUE_TIPS[venueKey]!
    : "⚖️ Balanced conditions — pick on current form.";

  const homePicks = pickTopPlayers(homePlayers, rolePriority);
  const awayPicks = pickTopPlayers(awayPlayers, rolePriority);

  return NextResponse.json({
    venue: match.venue,
    venue_tip: venueTip,
    home_team: match.team_home,
    away_team: match.team_away,
    home_picks: homePicks,
    away_picks: awayPicks,
  });
}
