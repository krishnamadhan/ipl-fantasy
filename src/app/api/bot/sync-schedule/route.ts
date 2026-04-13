/**
 * POST /api/bot/sync-schedule
 *
 * Bot-accessible schedule sync — same Cricbuzz logic as /api/admin/sync-schedule
 * but authenticated with BOT_SECRET instead of admin session.
 *
 * Returns: { ok, matchesSynced, totalFound, matches: [{team_home, team_away, scheduled_at, status}] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";
const CB_BASE = `https://${CB_HOST}`;

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

async function safeJson(res: Response): Promise<any> {
  try { return JSON.parse(await res.text()); } catch { return {}; }
}

function msToISO(ms: string | number) {
  return new Date(Number(ms)).toISOString();
}

function extractMatchInfos(obj: any): any[] {
  const results: any[] = [];
  if (!obj || typeof obj !== "object") return results;
  if (obj.matchInfo?.matchId) { results.push(obj.matchInfo); return results; }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) for (const item of val) results.push(...extractMatchInfos(item));
    else if (val && typeof val === "object") results.push(...extractMatchInfos(val));
  }
  return results;
}

function mapStatus(m: any, timeUntilMs: number): string {
  const state = (m.state ?? m.status ?? "").toLowerCase();
  if (state.includes("complete") || state.includes("won") || state.includes("tied")) return "completed";
  if (state.includes("live") || state.includes("progress") || state.includes("in play")) return "live";
  if (timeUntilMs <= 4 * 60 * 60 * 1000 && timeUntilMs > 0) return "open";
  return "scheduled";
}

export async function POST(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: "RAPIDAPI_KEY not configured" }, { status: 500 });
  }

  const admin = await createServiceClient();

  try {
    const { data: setting } = await admin
      .from("f11_settings")
      .select("value")
      .eq("key", "cricbuzz_series_id")
      .maybeSingle();
    const seriesId = setting?.value ? Number(setting.value) : null;

    const [upRes, liveRes] = await Promise.all([
      fetch(`${CB_BASE}/matches/v1/upcoming`, { headers: cbHeaders() }),
      fetch(`${CB_BASE}/matches/v1/live`, { headers: cbHeaders() }),
    ]);

    if (!upRes.ok || !liveRes.ok) {
      return NextResponse.json({ error: "Cricbuzz API error" }, { status: 500 });
    }

    const [upData, liveData] = await Promise.all([safeJson(upRes), safeJson(liveRes)]);
    const all = [...extractMatchInfos(upData), ...extractMatchInfos(liveData)];

    const matches = seriesId
      ? all.filter((m) => Number(m.seriesId) === seriesId)
      : all.filter((m) => {
          const s = (m.seriesName ?? "").toLowerCase();
          return s.includes("indian premier league") || s.includes("ipl");
        });

    if (!matches.length) {
      return NextResponse.json({ ok: true, matchesSynced: 0, totalFound: 0, matches: [] });
    }

    const now = new Date();
    const upserted: { team_home: string; team_away: string; scheduled_at: string; status: string }[] = [];

    for (const m of matches) {
      const matchId = String(m.matchId);
      const startMs = m.startDate ?? m.startTime ?? m.startTimestamp;
      if (!startMs) continue;

      const scheduledAt = msToISO(startMs);
      const timeUntil = new Date(scheduledAt).getTime() - now.getTime();
      const status = mapStatus(m, timeUntil);

      const teamHome = m.team1?.teamName ?? m.team1?.teamSName ?? "TBD";
      const teamAway = m.team2?.teamName ?? m.team2?.teamSName ?? "TBD";

      const { error } = await admin.from("f11_matches").upsert(
        {
          cricapi_match_id: matchId,
          team_home: teamHome,
          team_away: teamAway,
          venue: m.venueInfo?.ground ?? null,
          city: m.venueInfo?.city ?? null,
          scheduled_at: scheduledAt,
          status,
          toss_winner: m.tossResults?.tossWinnerName ?? null,
          winner: m.matchWinner ?? null,
          result_summary: m.status ?? null,
          raw_api_payload: m,
          last_synced_at: now.toISOString(),
        },
        { onConflict: "cricapi_match_id" }
      );

      if (!error) upserted.push({ team_home: teamHome, team_away: teamAway, scheduled_at: scheduledAt, status });
    }

    return NextResponse.json({
      ok: true,
      matchesSynced: upserted.length,
      totalFound: matches.length,
      matches: upserted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
