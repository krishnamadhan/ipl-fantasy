import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

async function cbGet(path: string) {
  const res = await fetch(`https://${CB_HOST}${path}`, { headers: cbHeaders() });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

/** Extract Cricbuzz player IDs from a scorecard innings object.
 *  Handles both confirmed structure (batTeamDetails.batsmenData)
 *  and older/unofficial wrapper variants (innings.batsmen / innings.bowlers).
 */
function idsFromInnings(innings: any): string[] {
  const ids: string[] = [];

  // Batsmen — confirmed: batTeamDetails.batsmenData (object keyed by bat_1, bat_2…)
  const rawBat =
    innings.batTeamDetails?.batsmenData ??
    innings.batTeamDetails?.batsmen ??
    innings.batsmen ??
    innings.batsmenData ?? {};
  const batList = Array.isArray(rawBat) ? rawBat : Object.values(rawBat);
  for (const b of batList as any[]) {
    const id = String(b.batId ?? b.id ?? b.playerId ?? "").trim();
    if (id && id !== "0") ids.push(id);
  }

  // Bowlers — confirmed: bowlTeamDetails.bowlersData
  const rawBowl =
    innings.bowlTeamDetails?.bowlersData ??
    innings.bowlTeamDetails?.bowlers ??
    innings.bowlers ??
    innings.bowlersData ?? {};
  const bowlList = Array.isArray(rawBowl) ? rawBowl : Object.values(rawBowl);
  for (const bw of bowlList as any[]) {
    const id = String(bw.bowlerId ?? bw.id ?? bw.bowlId ?? bw.playerId ?? "").trim();
    if (id && id !== "0") ids.push(id);
  }

  return ids;
}

/** Extract player IDs from the mcenter team/players object (pre-match lineup).
 *  Cricbuzz mcenter returns: { Players: { [teamId]: { playing11: [...], bench: [...] } } }
 */
function idsFromMcenter(data: any): { playing: string[]; bench: string[] } {
  const playing: string[] = [];
  const bench: string[] = [];

  const playersObj = data.Players ?? data.players ?? {};
  for (const teamData of Object.values(playersObj) as any[]) {
    const p11 = Array.isArray(teamData?.playing11) ? teamData.playing11 : [];
    const bn  = Array.isArray(teamData?.bench)     ? teamData.bench     : [];

    for (const p of p11) {
      const id = String(p.id ?? p.playerId ?? "").trim();
      if (id && id !== "0") playing.push(id);
    }
    for (const p of bn) {
      const id = String(p.id ?? p.playerId ?? "").trim();
      if (id && id !== "0") bench.push(id);
    }
  }

  return { playing, bench };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await createServiceClient();
  const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: match } = await admin
    .from("f11_matches")
    .select("cricapi_match_id, team_home, team_away, status")
    .eq("id", matchId)
    .single();

  if (!match?.cricapi_match_id) {
    return NextResponse.json({ error: "Match has no Cricbuzz ID" }, { status: 400 });
  }

  const cricMatchId = match.cricapi_match_id;
  let playingCricIds = new Set<string>();
  let source = "";

  // ── Strategy 1: Try scard (live/completed matches — has actual playing XI from scorecard) ──
  const scardData = await cbGet(`/mcenter/v1/${cricMatchId}/scard`);
  if (scardData && !scardData.error) {
    // Top-level scorecard key: scoreCard (confirmed official API), fallbacks for wrappers
    const scorecard: any[] =
      scardData.scoreCard ?? scardData.scorecard ?? scardData.Scorecard ?? scardData.Innings ?? [];

    if (scorecard.length > 0) {
      for (const innings of scorecard) {
        for (const id of idsFromInnings(innings)) {
          playingCricIds.add(id);
        }
      }
      if (playingCricIds.size > 0) source = "scard";
    }
  }

  // ── Strategy 2: Try mcenter playing11 (announced pre-match lineups) ──
  if (playingCricIds.size === 0) {
    const mcenterData = await cbGet(`/mcenter/v1/${cricMatchId}`);
    if (mcenterData && !mcenterData.error) {
      const { playing, bench } = idsFromMcenter(mcenterData);
      if (playing.length > 0) {
        playing.forEach((id) => playingCricIds.add(id));
        source = "mcenter-playing11";
      } else if (bench.length > 0) {
        // Only bench found — squad announced but playing XI not confirmed yet
        // Still mark what we have so user sees some data
        [...playing, ...bench].forEach((id) => playingCricIds.add(id));
        source = "mcenter-squad-only";
      }
    }
  }

  if (playingCricIds.size === 0) {
    return NextResponse.json({
      ok: true,
      message: "No playing XI data yet — playing XI may not have been announced",
      playingCount: 0,
      source: "none",
      debug: { cricMatchId },
    });
  }

  // Look up internal player IDs by Cricbuzz ID
  const { data: players } = await admin
    .from("f11_players")
    .select("id, cricapi_player_id, name")
    .in("cricapi_player_id", Array.from(playingCricIds));

  const playingPlayerIds = new Set((players ?? []).map((p) => p.id));

  // Get all players for this match's teams
  const { data: allMatchPlayers } = await admin
    .from("f11_players")
    .select("id")
    .in("ipl_team", [match.team_home, match.team_away])
    .eq("is_playing", true);

  let playingCount = 0;
  let benchedCount = 0;

  for (const p of allMatchPlayers ?? []) {
    const isPlayingXi = playingPlayerIds.has(p.id);
    if (isPlayingXi) playingCount++;
    else benchedCount++;

    await admin.from("f11_match_players").upsert(
      { match_id: matchId, player_id: p.id, is_playing_xi: isPlayingXi },
      { onConflict: "match_id,player_id" }
    );
  }

  return NextResponse.json({
    ok: true,
    playingCount,
    benchedCount,
    source,
    matchedFromCricbuzz: players?.length ?? 0,
    totalCricbuzzIds: playingCricIds.size,
  });
}
