import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";
const CB_BASE = `https://${CB_HOST}`;

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function msToISO(ms: string | number) {
  return new Date(Number(ms)).toISOString();
}

function extractMatchInfos(obj: any): any[] {
  const results: any[] = [];
  if (!obj || typeof obj !== "object") return results;
  if (obj.matchInfo?.matchId) {
    results.push(obj.matchInfo);
    return results;
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) results.push(...extractMatchInfos(item));
    } else if (val && typeof val === "object") {
      results.push(...extractMatchInfos(val));
    }
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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: "RAPIDAPI_KEY not set in .env.local" }, { status: 500 });
  }

  try {
    // Get configured series ID
    const { data: setting } = await admin
      .from("f11_settings")
      .select("value")
      .eq("key", "cricbuzz_series_id")
      .maybeSingle();
    const seriesId = setting?.value ? Number(setting.value) : null;

    // Fetch upcoming + live matches from Cricbuzz
    const [upRes, liveRes] = await Promise.all([
      fetch(`${CB_BASE}/matches/v1/upcoming`, { headers: cbHeaders() }),
      fetch(`${CB_BASE}/matches/v1/live`, { headers: cbHeaders() }),
    ]);

    // Parse both responses regardless — safeJson handles empty/truncated bodies
    const [upData, liveData] = await Promise.all([safeJson(upRes), safeJson(liveRes)]);

    if (!upRes.ok || !liveRes.ok) {
      const failedStatus = !upRes.ok ? upRes.status : liveRes.status;
      return NextResponse.json(
        { error: `Cricbuzz API returned ${failedStatus}`, upOk: upRes.ok, liveOk: liveRes.ok },
        { status: 500 }
      );
    }
    const all = [...extractMatchInfos(upData), ...extractMatchInfos(liveData)];

    // Filter to IPL matches
    const matches = seriesId
      ? all.filter((m) => Number(m.seriesId) === seriesId)
      : all.filter((m) => {
          const s = (m.seriesName ?? "").toLowerCase();
          return s.includes("indian premier league") || s.includes("ipl");
        });

    if (!matches.length) {
      return NextResponse.json({
        ok: true,
        message: `No IPL matches found${seriesId ? ` for seriesId ${seriesId}` : ""}`,
        totalFetched: all.length,
      });
    }

    const now = new Date();
    let upserted = 0;

    for (const m of matches) {
      const matchId = String(m.matchId);
      const startMs = m.startDate ?? m.startTime ?? m.startTimestamp;
      if (!startMs) continue;

      const scheduledAt = msToISO(startMs);
      const timeUntil = new Date(scheduledAt).getTime() - now.getTime();
      const status = mapStatus(m, timeUntil);

      const { error } = await admin.from("f11_matches").upsert(
        {
          cricapi_match_id: matchId,
          team_home: m.team1?.teamName ?? m.team1?.teamSName ?? "TBD",
          team_away: m.team2?.teamName ?? m.team2?.teamSName ?? "TBD",
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

      if (error) console.error(`Upsert failed for match ${matchId}:`, error.message);
      else upserted++;
    }

    return NextResponse.json({ ok: true, matchesSynced: upserted, totalFound: matches.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
