/**
 * Machi AI team — Claude picks the best Dream11 team for the bot.
 *
 * POST /api/bot/machi-team
 *   Body: { match_id, contest_id }
 *   Claude selects 11 players + C + VC from the match squad.
 *   Creates/updates Machi's entry and joins the contest.
 *
 * PUT /api/bot/machi-team
 *   Body: { match_id }
 *   Re-runs selection using confirmed playing XI, updates Machi's entry.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";
import { validateTeam } from "@/lib/fantasy/validate-team";

const BOT_USER_ID = process.env.BOT_USER_ID;

interface PlayerData {
  id: string;
  name: string;
  role: string;
  ipl_team: string;
  credit_value: number;
  is_playing_xi: boolean | null;
  season_points: number;
}

async function fetchMatchPlayers(admin: ReturnType<typeof createServiceClient>, match_id: string): Promise<PlayerData[]> {
  const { data } = await admin
    .from("f11_match_players")
    .select(`
      is_playing_xi,
      player:f11_players!player_id(id, name, role, ipl_team, credit_value)
    `)
    .eq("match_id", match_id);

  if (!data?.length) return [];

  // Fetch aggregated season stats for these players
  const playerIds = (data as any[]).map((mp) => mp.player?.id).filter(Boolean);
  const { data: stats } = await admin
    .from("f11_player_stats")
    .select("player_id, fantasy_points")
    .in("player_id", playerIds);

  const statsByPlayer: Record<string, number> = {};
  for (const s of stats ?? []) {
    statsByPlayer[s.player_id] = (statsByPlayer[s.player_id] ?? 0) + (s.fantasy_points ?? 0);
  }

  return (data as any[])
    .filter((mp) => mp.player?.id)
    .map((mp) => ({
      id: mp.player.id,
      name: mp.player.name,
      role: mp.player.role,
      ipl_team: mp.player.ipl_team,
      credit_value: mp.player.credit_value,
      is_playing_xi: mp.is_playing_xi,
      season_points: statsByPlayer[mp.player.id] ?? 0,
    }));
}

async function pickTeamWithClaude(
  players: PlayerData[],
  matchTeams: { home: string; away: string }
): Promise<{ player_ids: string[]; captain_id: string; vc_id: string; reasoning: string } | null> {
  const client = new Anthropic();

  const sorted = [...players].sort((a, b) => {
    // Playing XI first, then by season points, then by credits
    const xiA = a.is_playing_xi ? 1 : 0;
    const xiB = b.is_playing_xi ? 1 : 0;
    if (xiB !== xiA) return xiB - xiA;
    if (b.season_points !== a.season_points) return b.season_points - a.season_points;
    return b.credit_value - a.credit_value;
  });

  const playerList = sorted.map((p, i) => {
    const xi = p.is_playing_xi ? " ✅PLAYING" : "";
    const pts = p.season_points > 0 ? ` ${p.season_points}pts` : "";
    return `${i + 1}. ${p.id} | ${p.name} | ${p.role} | ${p.ipl_team} | ${p.credit_value}cr${xi}${pts}`;
  }).join("\n");

  const prompt = `You are a Dream11 IPL fantasy expert. Pick the best 11 for: ${matchTeams.home} vs ${matchTeams.away}

PLAYERS (ID | Name | Role | Team | Credits | XI? | SeasonPts):
${playerList}

RULES:
- Exactly 11 players, total ≤ 100 credits
- Max 7 from one team, min 1 from each team
- Min 1 WK, min 1 BAT, min 1 AR, min 1 BOWL
- Captain gets 2x points, VC gets 1.5x

STRATEGY:
- Strongly prefer ✅PLAYING players (confirmed in XI)
- Prioritize AR (all-rounders) — bat + bowl fantasy points
- High season points = proven form
- Captain: best explosive bat or proven AR
- VC: different team from captain if possible

Respond ONLY with this JSON (no other text):
{"player_ids":["id1","id2","id3","id4","id5","id6","id7","id8","id9","id10","id11"],"captain_id":"id","vc_id":"id","reasoning":"one sentence"}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    // Extract JSON even if Claude wraps it in backticks
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const json = JSON.parse(match[0]);
    if (!Array.isArray(json.player_ids) || json.player_ids.length !== 11) return null;
    if (!json.captain_id || !json.vc_id) return null;

    // Verify all IDs are valid
    const validIds = new Set(players.map((p) => p.id));
    if (!json.player_ids.every((id: string) => validIds.has(id))) return null;
    if (!validIds.has(json.captain_id) || !validIds.has(json.vc_id)) return null;

    return {
      player_ids: json.player_ids,
      captain_id: json.captain_id,
      vc_id: json.vc_id,
      reasoning: json.reasoning ?? "AI-selected team",
    };
  } catch {
    return null;
  }
}

async function upsertBotEntry(
  admin: ReturnType<typeof createServiceClient>,
  contest_id: string,
  payload: { player_ids: string[]; captain_id: string; vc_id: string },
  team_name = "Machi"
) {
  const { data: existing } = await admin
    .from("f11_entries")
    .select("id")
    .eq("contest_id", contest_id)
    .eq("user_id", BOT_USER_ID!)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("f11_entries")
      .update({ ...payload, team_name })
      .eq("id", existing.id);
    return { id: existing.id, error };
  } else {
    const { data, error } = await admin
      .from("f11_entries")
      .insert({ contest_id, user_id: BOT_USER_ID!, team_name, entry_fee_paid: 0, ...payload })
      .select("id")
      .single();
    return { id: data?.id, error };
  }
}

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();
  if (!BOT_USER_ID) return NextResponse.json({ error: "BOT_USER_ID not configured" }, { status: 500 });

  const { match_id, contest_id } = await req.json();
  if (!match_id || !contest_id)
    return NextResponse.json({ error: "match_id and contest_id required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: match } = await admin
    .from("f11_matches")
    .select("status, team_home, team_away")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "live" || match.status === "completed")
    return NextResponse.json({ error: "Match already started — team locked" }, { status: 409 });

  const players = await fetchMatchPlayers(admin, match_id);
  if (players.length < 11)
    return NextResponse.json({ error: `Not enough players synced (${players.length})` }, { status: 422 });

  const pick = await pickTeamWithClaude(players, { home: match.team_home, away: match.team_away });
  if (!pick)
    return NextResponse.json({ error: "Claude failed to pick a valid team" }, { status: 500 });

  // Validate against Dream11 rules
  const selectedPlayers = players.filter((p) => pick.player_ids.includes(p.id));
  const validation = validateTeam(selectedPlayers as any, pick.captain_id, pick.vc_id, {
    home: match.team_home,
    away: match.team_away,
  });
  if (!validation.valid)
    return NextResponse.json({ error: `Invalid team: ${validation.errors[0]}` }, { status: 422 });

  const { id: entry_id, error } = await upsertBotEntry(admin, contest_id, pick);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const captain = players.find((p) => p.id === pick.captain_id);
  const vc = players.find((p) => p.id === pick.vc_id);

  return NextResponse.json({
    ok: true,
    entry_id,
    captain: captain?.name,
    vc: vc?.name,
    reasoning: pick.reasoning,
    message: `🤖 *Machi joined!* C: ${captain?.name ?? "?"} · VC: ${vc?.name ?? "?"}\n_${pick.reasoning}_`,
  });
}

export async function PUT(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();
  if (!BOT_USER_ID) return NextResponse.json({ error: "BOT_USER_ID not configured" }, { status: 500 });

  const { match_id } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = createServiceClient();

  const { data: match } = await admin
    .from("f11_matches")
    .select("status, team_home, team_away")
    .eq("id", match_id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "live" || match.status === "completed")
    return NextResponse.json({ error: "Match already started — team locked" }, { status: 409 });

  const { data: contest } = await admin
    .from("f11_contests")
    .select("id")
    .eq("match_id", match_id)
    .is("created_by", null)
    .maybeSingle();

  if (!contest) return NextResponse.json({ error: "No group contest for this match" }, { status: 404 });

  const players = await fetchMatchPlayers(admin, match_id);
  if (players.length < 11)
    return NextResponse.json({ error: `Not enough players synced (${players.length})` }, { status: 422 });

  // Prefer playing XI players for the updated pick
  const xiPlayers = players.filter((p) => p.is_playing_xi);
  const poolToUse = xiPlayers.length >= 11 ? xiPlayers : players;

  const pick = await pickTeamWithClaude(poolToUse, { home: match.team_home, away: match.team_away });
  if (!pick)
    return NextResponse.json({ error: "Claude failed to pick a valid team" }, { status: 500 });

  const selectedPlayers = poolToUse.filter((p) => pick.player_ids.includes(p.id));
  const validation = validateTeam(selectedPlayers as any, pick.captain_id, pick.vc_id, {
    home: match.team_home,
    away: match.team_away,
  });
  if (!validation.valid)
    return NextResponse.json({ error: `Invalid team: ${validation.errors[0]}` }, { status: 422 });

  const { id: entry_id, error } = await upsertBotEntry(admin, contest.id, pick);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const captain = poolToUse.find((p) => p.id === pick.captain_id);
  const vc = poolToUse.find((p) => p.id === pick.vc_id);
  const xiCount = xiPlayers.length;

  return NextResponse.json({
    ok: true,
    entry_id,
    captain: captain?.name,
    vc: vc?.name,
    xi_confirmed: xiCount,
    reasoning: pick.reasoning,
    message: `🤖 *Machi updated team!* (${xiCount} XI confirmed) C: ${captain?.name ?? "?"} · VC: ${vc?.name ?? "?"}\n_${pick.reasoning}_\n_Use !fantasy diff to compare 😈_`,
  });
}
