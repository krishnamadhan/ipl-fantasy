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

/** Extract Cricbuzz player IDs from one innings object.
 *  Handles both the confirmed "batTeamDetails.batsmenData" nested structure
 *  AND the simpler live structure where batsman/bowler are top-level arrays.
 */
function idsFromInnings(innings: any): string[] {
  const ids: string[] = [];

  // Batsmen — try nested structure first, then top-level array (live matches use singular "batsman")
  const rawBat =
    innings.batTeamDetails?.batsmenData ??
    innings.batTeamDetails?.batsmen ??
    innings.batsmen ??
    innings.batsman ??    // ← live API uses singular "batsman" array
    innings.batsmenData ?? {};
  const batList = Array.isArray(rawBat) ? rawBat : Object.values(rawBat);
  for (const b of batList as any[]) {
    const id = String(b.batId ?? b.id ?? b.playerId ?? "").trim();
    if (id && id !== "0") ids.push(id);
  }

  // Bowlers — try nested first, then top-level array (live API uses singular "bowler")
  const rawBowl =
    innings.bowlTeamDetails?.bowlersData ??
    innings.bowlTeamDetails?.bowlers ??
    innings.bowlers ??
    innings.bowler ??     // ← live API uses singular "bowler" array
    innings.bowlersData ?? {};
  const bowlList = Array.isArray(rawBowl) ? rawBowl : Object.values(rawBowl);
  for (const bw of bowlList as any[]) {
    const id = String(bw.bowlerId ?? bw.id ?? bw.bowlId ?? bw.playerId ?? "").trim();
    if (id && id !== "0") ids.push(id);
  }

  return ids;
}

/** Extract player IDs from the mcenter team/players object (pre-match lineup). */
function idsFromMcenter(data: any): string[] {
  const playing: string[] = [];
  const playersObj = data.Players ?? data.players ?? {};
  for (const teamData of Object.values(playersObj) as any[]) {
    for (const p of (Array.isArray(teamData?.playing11) ? teamData.playing11 : [])) {
      const id = String(p.id ?? p.playerId ?? "").trim();
      if (id && id !== "0") playing.push(id);
    }
  }
  return playing;
}

/** Parse playing XI player names from Cricbuzz commentary.
 *  Around toss time the commentary contains:
 *  "B0$ (Playing XI): KL Rahul(w), Pathum Nissanka, ..."
 */
function namesFromCommentary(commData: any): string[] {
  const names: string[] = [];
  for (const item of (commData?.comwrapper ?? [])) {
    const txt: string = item?.commentary?.commtxt ?? "";
    if (!txt.includes("(Playing XI):")) continue;
    const cleaned = txt.replace(/[A-Z][0-9]\$\s*/g, "").trim();
    const match = cleaned.match(/\(Playing XI\):\s*(.+)/);
    if (!match) continue;
    for (const raw of match[1].split(",")) {
      const name = raw.trim().replace(/\s*\([wc]\)/g, "").trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** Fuzzy-match a list of names against f11_players for the two match teams.
 *  Returns a Set of matched internal UUIDs.
 */
async function matchNamesToDB(
  admin: any,
  names: string[],
  teamHome: string,
  teamAway: string
): Promise<Set<string>> {
  if (names.length === 0) return new Set();

  const { data: teamPlayers } = await admin
    .from("f11_players")
    .select("id, name")
    .in("ipl_team", [teamHome, teamAway])
    .eq("is_playing", true);

  if (!teamPlayers?.length) return new Set();

  const matched = new Set<string>();

  for (const cbName of names) {
    const cbLower = cbName.toLowerCase();
    const cbParts = cbLower.split(" ");
    let best: { id: string; score: number } | null = null;

    for (const player of teamPlayers) {
      const dbLower = player.name.toLowerCase();
      const dbParts = dbLower.split(" ");
      let score = 0;

      if (dbLower === cbLower) { score = 100; }
      else if (dbLower.includes(cbLower)) { score = 90; }
      else if (cbLower.includes(dbLower)) { score = 85; }
      else {
        const matchingWords = cbParts.filter((w) => w.length > 2 && dbParts.includes(w));
        score = matchingWords.length * 30;
        const cbLast = cbParts[cbParts.length - 1];
        const dbLast = dbParts[dbParts.length - 1];
        if (cbLast.length > 3 && cbLast === dbLast) score += 40;
        // Initial match: "T Natarajan" → "Thangarasu Natarajan"
        if (cbParts.length >= 2 && dbParts.length >= 2 && cbParts[0].length === 1 && dbParts[0][0] === cbParts[0]) score += 20;
      }

      if (score > 60 && (!best || score > best.score)) {
        best = { id: player.id, score };
      }
    }

    if (best) matched.add(best.id);
  }

  return matched;
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
  const playingCricIds = new Set<string>(); // Cricbuzz IDs (for scard/mcenter strategies)
  const playingPlayerIds = new Set<string>(); // our internal UUIDs (for all strategies)
  const sources: string[] = [];

  // ── Strategy 1: Scard — best source for live/completed matches ──
  // The live API returns innings.batsman (singular array) with ALL batting XI players listed,
  // and innings.bowler (singular array) with bowlers who have bowled so far.
  // Combining both innings gives the full 22-player playing XI once both have batted.
  const scardData = await cbGet(`/mcenter/v1/${cricMatchId}/scard`);
  if (scardData && !scardData.error) {
    const scorecard: any[] =
      scardData.scoreCard ?? scardData.scorecard ?? scardData.Scorecard ?? scardData.Innings ?? [];

    for (const innings of scorecard) {
      for (const id of idsFromInnings(innings)) playingCricIds.add(id);
    }

    if (playingCricIds.size > 0) {
      const { data: players } = await admin
        .from("f11_players")
        .select("id")
        .in("cricapi_player_id", Array.from(playingCricIds));
      (players ?? []).forEach((p) => playingPlayerIds.add(p.id));
      sources.push(`scard(${playingCricIds.size} ids→${playingPlayerIds.size} matched)`);
    }
  }

  // ── Strategy 2: Commentary — reliable for toss/pre-match and supplements live scard ──
  // Cricbuzz posts "(Playing XI): Name1, Name2, ..." at toss time.
  // This covers the fielding team who won't appear in scard until they bat.
  if (playingPlayerIds.size < 22) {
    const commData = await cbGet(`/mcenter/v1/${cricMatchId}/comm`);
    if (commData && !commData.error) {
      const names = namesFromCommentary(commData);
      if (names.length > 0) {
        const commMatched = await matchNamesToDB(admin, names, match.team_home, match.team_away);
        const added = [...commMatched].filter((id) => !playingPlayerIds.has(id)).length;
        commMatched.forEach((id) => playingPlayerIds.add(id));
        if (commMatched.size > 0) sources.push(`comm-names(${names.length} names→${commMatched.size} matched, +${added} new)`);
      }
    }
  }

  // ── Strategy 3: Mcenter playing11 (pre-announced lineup, less common) ──
  if (playingPlayerIds.size < 22) {
    const mcenterData = await cbGet(`/mcenter/v1/${cricMatchId}`);
    if (mcenterData && !mcenterData.error) {
      const mcIds = idsFromMcenter(mcenterData);
      if (mcIds.length > 0) {
        const { data: players } = await admin
          .from("f11_players")
          .select("id")
          .in("cricapi_player_id", mcIds);
        const added = (players ?? []).filter((p) => !playingPlayerIds.has(p.id)).length;
        (players ?? []).forEach((p) => playingPlayerIds.add(p.id));
        if (players?.length) sources.push(`mcenter(+${added} new)`);
      }
    }
  }

  if (playingPlayerIds.size === 0) {
    return NextResponse.json({
      ok: true,
      message: "No playing XI data yet — playing XI may not have been announced",
      playingCount: 0,
      source: "none",
      debug: { cricMatchId },
    });
  }

  // Mark playing/bench for all players in both teams
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
    source: sources.join(" + "),
    totalMatched: playingPlayerIds.size,
  });
}
