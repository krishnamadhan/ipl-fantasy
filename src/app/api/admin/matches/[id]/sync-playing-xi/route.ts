import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

function mapRole(role: string = ""): string {
  const r = role.toLowerCase();
  if (r.includes("keeper") || r.includes("wicket")) return "WK";
  if (r.includes("all")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  return "BAT";
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
    .select("cricapi_match_id, team_home, team_away")
    .eq("id", matchId)
    .single();

  if (!match?.cricapi_match_id) {
    return NextResponse.json({ error: "Match has no Cricbuzz ID" }, { status: 400 });
  }

  // Get playing XI from Cricbuzz — the scard endpoint has playing players
  const res = await fetch(`https://${CB_HOST}/mcenter/v1/${match.cricapi_match_id}/scard`, {
    headers: cbHeaders(),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Cricbuzz returned ${res.status}` }, { status: 500 });
  }

  const data = await res.json();

  // Extract playing players from scorecard innings
  const scorecard = data.scorecard ?? data.Scorecard ?? data.Innings ?? [];
  const playingCricIds = new Set<string>();

  for (const innings of scorecard) {
    const batsmen = Array.isArray(innings.batsmen) ? innings.batsmen : Object.values(innings.batsmen ?? {});
    const bowlers = Array.isArray(innings.bowlers) ? innings.bowlers : Object.values(innings.bowlers ?? {});
    for (const b of batsmen) {
      const id = String(b.id ?? b.batId ?? "");
      if (id) playingCricIds.add(id);
    }
    for (const bw of bowlers) {
      const id = String(bw.id ?? bw.bowlId ?? "");
      if (id) playingCricIds.add(id);
    }
  }

  if (playingCricIds.size === 0) {
    return NextResponse.json({ ok: true, message: "No playing XI data yet — match may not have started", playingCount: 0 });
  }

  // Look up players by cricapi_player_id
  const { data: players } = await admin
    .from("f11_players")
    .select("id, cricapi_player_id")
    .in("cricapi_player_id", Array.from(playingCricIds));

  const playingPlayerIds = new Set((players ?? []).map((p) => p.id));

  // Get all players for this match's teams
  const { data: allMatchPlayers } = await admin
    .from("f11_players")
    .select("id")
    .in("ipl_team", [match.team_home, match.team_away]);

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

  return NextResponse.json({ ok: true, playingCount, benchedCount });
}
