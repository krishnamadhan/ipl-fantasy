/**
 * POST /api/cron/sync-squads
 *
 * Bot-accessible endpoint to sync IPL squad data from Cricbuzz.
 * Auth: Authorization: Bearer <FANTASY_BOT_SECRET or CRON_SECRET>
 * Called by banteragent when squad is empty at contest creation time.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";
const CB_BASE = `https://${CB_HOST}`;

function cbHeaders() {
  return { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!, "X-RapidAPI-Host": CB_HOST };
}

async function cbGet(path: string): Promise<any> {
  const res = await fetch(`${CB_BASE}${path}`, { headers: cbHeaders() });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try { return JSON.parse(text); } catch { return null; }
}

function mapRole(raw: string = ""): "WK" | "BAT" | "AR" | "BOWL" {
  const r = raw.toLowerCase().trim();
  if (!r) return "BAT";
  if (r === "wk" || r.startsWith("wk-") || r.includes("keeper") || r.includes("wicket")) return "WK";
  if (r === "all" || r.includes("all-round") || r.includes("allround") || r.includes("all round")) return "AR";
  if (r === "bowl" || r.startsWith("bowl") || r.includes("bowl")) return "BOWL";
  return "BAT";
}

function defaultCredit(role: string): number {
  switch (role) {
    case "AR":   return 9.0;
    case "WK":   return 8.5;
    case "BAT":  return 8.5;
    default:     return 8.0;
  }
}

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
    results.push({ cricId, name, roleRaw: p.playerRole ?? p.role ?? p.playerType ?? "", batStyle: p.batStyle ?? null, bowlStyle: p.bowlStyle ?? null });
  }
  return results;
}

export async function POST(req: NextRequest) {
  // Auth: accept FANTASY_BOT_SECRET or CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const validSecrets = [process.env.FANTASY_BOT_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (!validSecrets.some((s) => authHeader === `Bearer ${s}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: "RAPIDAPI_KEY not configured" }, { status: 500 });
  }

  const admin = await createServiceClient();

  const { data: setting } = await admin.from("f11_settings").select("value").eq("key", "cricbuzz_series_id").maybeSingle();
  const seriesId = setting?.value ? String(setting.value) : "9241";

  const seen = new Set<string>();
  let upserted = 0;

  const squadList = await cbGet(`/series/v1/${seriesId}/squads`);
  const squads: any[] = squadList?.squads ?? squadList?.squad ?? [];

  for (const sq of squads) {
    const sqName = (sq.squadName ?? sq.teamName ?? sq.name ?? sq.team?.name ?? "").toLowerCase();
    if (sqName.includes("women") || sqName.includes("tour")) continue;
    if (!sq.squadId) continue;

    const squadData = await cbGet(`/series/v1/${seriesId}/squads/${sq.squadId}`);
    if (!squadData) continue;

    const rawName: string =
      sq.squadName ?? sq.teamName ?? sq.name ??
      sq.team?.name ?? sq.team?.teamName ?? sq.team?.teamSName ??
      squadData?.team?.name ?? squadData?.teamName ?? sq.squadType ?? "";
    const teamName = rawName.replace(/ squad$/i, "").replace(/ ipl.*$/i, "").trim() || `Squad ${sq.squadId}`;
    const players = extractPlayers(squadData);

    for (const p of players) {
      if (seen.has(p.cricId)) continue;
      seen.add(p.cricId);

      const role = mapRole(p.roleRaw);
      const { data: existing } = await admin.from("f11_players").select("credit_override, credit_value").eq("cricapi_player_id", p.cricId).maybeSingle();
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
    }
  }

  return NextResponse.json({ ok: true, upserted, teams: squads.length });
}
