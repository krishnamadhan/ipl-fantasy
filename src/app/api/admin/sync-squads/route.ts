import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";
const CB_BASE = `https://${CB_HOST}`;

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

async function cbGet(path: string): Promise<any> {
  const res = await fetch(`${CB_BASE}${path}`, { headers: cbHeaders() });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Maps Cricbuzz playerRole strings → WK / BAT / AR / BOWL
 *
 * Cricbuzz uses values like:
 *   "bat"  "bowl"  "all"  "wk"  "wk-bat"
 *   "Wicket-Keeper Batter"  "Batting Allrounder"  "Bowling Allrounder"
 *   "Right Handed Bat"  (batting style leaking into role field)
 */
function mapRole(raw: string = ""): "WK" | "BAT" | "AR" | "BOWL" {
  const r = raw.toLowerCase().trim();
  if (!r) return "BAT";

  // Wicket-keeper (check first — "wk-bat" must not fall through to BAT)
  if (r === "wk" || r.startsWith("wk-") || r.includes("keeper") || r.includes("wicket")) return "WK";

  // All-rounder — "All Rounder" (space), "all-round", "allround", "allrounder"
  if (r === "all" || r.includes("all-round") || r.includes("allround") || r.includes("all round")) return "AR";

  // Bowler
  if (r === "bowl" || r.startsWith("bowl") || r.includes("bowl")) return "BOWL";

  // Batting all-rounders that contain "bat" but NOT "allround" (already handled above)
  return "BAT";
}

/** Starting credit by role — admin can override per player */
function defaultCredit(role: string): number {
  switch (role) {
    case "AR":   return 9.0;
    case "WK":   return 8.5;
    case "BAT":  return 8.5;
    case "BOWL":
    default:     return 8.0;
  }
}

/** Extract players from whichever structure the squad endpoint returns */
function extractPlayers(data: any): Array<{ cricId: string; name: string; roleRaw: string; batStyle: string | null; bowlStyle: string | null }> {
  const results: ReturnType<typeof extractPlayers> = [];

  const list: any[] =
    (Array.isArray(data?.player) && data.player) ||
    (Array.isArray(data?.players) && data.players) ||
    (Array.isArray(data?.squad) && data.squad) ||
    (Array.isArray(data) && data) ||
    (typeof data === "object" ? (Object.values(data ?? {}).find(Array.isArray) as any[]) : null) ||
    [];

  for (const p of list) {
    const cricId = String(p.id ?? p.playerId ?? p.pid ?? "").trim();
    if (!cricId || cricId === "undefined" || cricId === "0") continue;
    const name = (p.name ?? p.fullName ?? p.playerName ?? "").trim();
    if (!name) continue;

    results.push({
      cricId,
      name,
      roleRaw: p.playerRole ?? p.role ?? p.playerType ?? "",
      batStyle: p.batStyle ?? p.battingStyle ?? null,
      bowlStyle: p.bowlStyle ?? p.bowlingStyle ?? null,
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  const admin = await createServiceClient();

  if (!isCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: "RAPIDAPI_KEY not set in .env.local" }, { status: 500 });
  }

  // Get configured series ID (IPL 2026 = 9241)
  const { data: setting } = await admin
    .from("f11_settings")
    .select("value")
    .eq("key", "cricbuzz_series_id")
    .maybeSingle();
  const seriesId = setting?.value ? String(setting.value) : "9241";

  const debug: any[] = [];
  let upserted = 0;
  let skipped = 0;
  const seen = new Set<string>(); // dedup by cricId

  // ── STRATEGY 1: Series squads endpoint ──────────────────────────────────
  // This is the best source — has roles for all IPL players even before match day
  const squadList = await cbGet(`/series/v1/${seriesId}/squads`);
  const squads: Array<{ squadId?: number; squadName?: string; teamName?: string; name?: string; squadType?: string; teamId?: number; isHeader?: boolean; team?: { name?: string; teamName?: string; teamSName?: string } }> =
    squadList?.squads ?? squadList?.squad ?? [];

  if (squads.length > 0) {
    debug.push({ source: "series-squads", count: squads.length });

    for (const sq of squads) {
      // Filter to T20/IPL squads (skip tour squads, women's, etc.)
      const sqName = (sq.squadName ?? sq.teamName ?? sq.name ?? sq.team?.name ?? "").toLowerCase();
      if (sqName.includes("women") || sqName.includes("tour")) continue;

      if (!sq.squadId) continue;

      const squadData = await cbGet(`/series/v1/${seriesId}/squads/${sq.squadId}`);
      if (!squadData) continue;

      // Cricbuzz stores the team name in squadType (e.g. "Chennai Super Kings")
      const rawName: string =
        sq.squadName ?? sq.teamName ?? sq.name ??
        sq.team?.name ?? sq.team?.teamName ?? sq.team?.teamSName ??
        squadData?.team?.name ?? squadData?.team?.teamName ??
        squadData?.teamName ?? squadData?.teamSName ??
        sq.squadType ?? "";
      const teamName = rawName.replace(/ squad$/i, "").replace(/ ipl.*$/i, "").trim() || `Squad ${sq.squadId}`;
      const players = extractPlayers(squadData);

      debug.push({ squad: teamName, playersFound: players.length, sampleRole: players[0]?.roleRaw });

      for (const p of players) {
        if (seen.has(p.cricId)) continue;
        seen.add(p.cricId);

        const role = mapRole(p.roleRaw);
        const { data: existing } = await admin
          .from("f11_players")
          .select("credit_override, credit_value")
          .eq("cricapi_player_id", p.cricId)
          .maybeSingle();

        const keepCredit = existing?.credit_override === true;

        const { error } = await admin.from("f11_players").upsert(
          {
            cricapi_player_id: p.cricId,
            name: p.name,
            ipl_team: teamName,
            role,
            batting_style: p.batStyle,
            bowling_style: p.bowlStyle,
            credit_value: keepCredit ? existing!.credit_value : defaultCredit(role),
            credit_override: keepCredit,
            is_playing: true,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "cricapi_player_id" }
        );

        if (!error) upserted++;
        else skipped++;
      }
    }
  } else {
    // ── STRATEGY 2: Fall back to match center for scheduled matches ─────────
    debug.push({ source: "mcenter-fallback", reason: "series-squads returned empty" });

    const { data: matches } = await admin
      .from("f11_matches")
      .select("id, cricapi_match_id, team_home, team_away")
      .not("cricapi_match_id", "is", null)
      .in("status", ["scheduled", "open", "locked", "live"])
      .order("scheduled_at", { ascending: true })
      .limit(3);

    for (const match of matches ?? []) {
      const mcenter = await cbGet(`/mcenter/v1/${match.cricapi_match_id}`);
      if (!mcenter) continue;

      const teamDefs = [
        { id: mcenter.team1?.teamid, name: match.team_home },
        { id: mcenter.team2?.teamid, name: match.team_away },
      ].filter((t) => t.id);

      for (const team of teamDefs) {
        // Try mcenter Players object first
        const playersObj = mcenter.Players ?? mcenter.players ?? {};
        const teamData = playersObj[String(team.id)] ?? playersObj[team.id];
        let rawList: any[] = [];

        if (Array.isArray(teamData)) {
          rawList = teamData;
        } else if (teamData && typeof teamData === "object") {
          rawList = [
            ...(Array.isArray(teamData.playing11) ? teamData.playing11 : []),
            ...(Array.isArray(teamData.bench) ? teamData.bench : []),
          ];
        }

        // If mcenter gave nothing, try teams endpoint
        if (rawList.length === 0) {
          const td = await cbGet(`/teams/v1/${team.id}/players`) ?? await cbGet(`/teams/v1/${team.id}/squad`);
          if (td) rawList = extractPlayers(td).map((p) => ({ id: p.cricId, name: p.name, playerRole: p.roleRaw }));
        }

        for (const p of rawList) {
          const cricId = String(p.id ?? p.playerId ?? "");
          if (!cricId || seen.has(cricId)) continue;
          seen.add(cricId);

          const name = (p.name ?? "").trim();
          if (!name) continue;

          const role = mapRole(p.playerRole ?? p.role ?? "");
          const { error } = await admin.from("f11_players").upsert(
            {
              cricapi_player_id: cricId,
              name,
              ipl_team: team.name,
              role,
              batting_style: p.batStyle ?? null,
              bowling_style: p.bowlStyle ?? null,
              credit_value: defaultCredit(role),
              credit_override: false,
              is_playing: true,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "cricapi_player_id" }
          );
          if (!error) upserted++;
          else skipped++;
        }

        debug.push({ team: team.name, source: "mcenter", playersFound: rawList.length });
      }
    }
  }

  const roleSummary = await admin
    .from("f11_players")
    .select("role")
    .eq("is_playing", true);

  const roleCounts = (roleSummary.data ?? []).reduce((acc: any, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    playersUpserted: upserted,
    skipped,
    roleCounts,
    debug,
  });
}
