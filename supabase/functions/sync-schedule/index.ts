// Supabase Edge Function — syncs upcoming IPL matches from Cricbuzz (RapidAPI)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";
const CB_BASE = `https://${CB_HOST}`;

function cbHeaders() {
  return {
    "X-RapidAPI-Key": Deno.env.get("RAPIDAPI_KEY")!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

// Cricbuzz timestamps are in milliseconds
function msToISO(ms: string | number): string {
  return new Date(Number(ms)).toISOString();
}

// Cricbuzz /matches/v1/upcoming and /matches/v1/live response structure (confirmed from source):
// { typeMatches: [ { matchType: "...", seriesMatches: [ { seriesAdWrapper: { seriesMatches: { matches: [...] } } } ] } ] }
// Each match: { matchInfo: { matchId, team1: { teamName }, team2: { teamName }, startDate, state, status, seriesName } }
// Some responses wrap in matchInfo + matchScore at the same level.
//
// We recursively extract all matchInfo objects regardless of nesting depth.
function extractMatchInfos(obj: any): any[] {
  const results: any[] = [];
  if (!obj || typeof obj !== "object") return results;

  // Direct matchInfo object with a matchId
  if (obj.matchInfo?.matchId) {
    results.push(obj.matchInfo);
    return results;
  }

  // Walk arrays and objects
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) results.push(...extractMatchInfos(item));
    } else if (val && typeof val === "object") {
      results.push(...extractMatchInfos(val));
    }
  }
  return results;
}

// Series endpoint: /series/v1/{seriesId}
// Actual response structure (confirmed from live API):
// { typeMatches: [ { seriesMatches: [ { seriesAdWrapper: { matches: [ { matchInfo: {...} } ] } } ] } ] }
// The recursive extractMatchInfos handles this correctly — use it directly.
function extractSeriesMatches(obj: any): any[] {
  return extractMatchInfos(obj);
}

function isIPL(m: any): boolean {
  const s = (m.seriesName ?? m.series ?? m.competition?.name ?? "").toLowerCase();
  return s.includes("indian premier league") || s.includes("ipl");
}

function mapState(m: any): string {
  const state = (m.state ?? m.status ?? m.matchState ?? "").toLowerCase();
  if (state.includes("complete") || state.includes("result") || state.includes("won") || state.includes("tied")) {
    return "completed";
  }
  if (state.includes("live") || state.includes("progress") || state.includes("inprogress") || state.includes("in play")) {
    return "live";
  }
  return "scheduled";
}

Deno.serve(async () => {
  const start = Date.now();
  let recordsUpserted = 0;

  try {
    const { data: setting } = await supabase
      .from("f11_settings")
      .select("value")
      .eq("key", "cricbuzz_series_id")
      .maybeSingle();

    const seriesId = setting?.value ? Number(setting.value) : null;
    let allMatchInfos: any[] = [];

    // Always use upcoming + live endpoints (confirmed working from live API test).
    // The /series/v1/{id} endpoint has an unknown response structure, so we avoid it.
    // Filter by numeric seriesId when set (exact match), otherwise filter by name.
    const [upRes, liveRes] = await Promise.all([
      fetch(`${CB_BASE}/matches/v1/upcoming`, { headers: cbHeaders() }),
      fetch(`${CB_BASE}/matches/v1/live`, { headers: cbHeaders() }),
    ]);
    const [upData, liveData] = await Promise.all([upRes.json(), liveRes.json()]);
    const all = [...extractMatchInfos(upData), ...extractMatchInfos(liveData)];

    if (seriesId) {
      // Filter by exact numeric seriesId — confirmed field from live API: matchInfo.seriesId
      allMatchInfos = all.filter((m) => Number(m.seriesId) === seriesId);
    } else {
      allMatchInfos = all.filter(isIPL);
    }

    if (!allMatchInfos.length) {
      throw new Error(
        seriesId
          ? `No matches found for seriesId ${seriesId} in upcoming/live feeds`
          : "No IPL matches found in upcoming/live feeds"
      );
    }

    const now = new Date();

    for (const m of allMatchInfos) {
      const matchId = String(m.matchId);
      // startDate is millisecond timestamp (confirmed from Cricbuzz source)
      const startMs = m.startDate ?? m.startTime ?? m.startTimestamp;
      if (!startMs) continue;

      const scheduledAt = msToISO(startMs);
      const scheduledTime = new Date(scheduledAt).getTime();
      const timeUntil = scheduledTime - now.getTime();

      let status = mapState(m);
      // Override: lineup opens 4h before match
      if (status === "scheduled" && timeUntil <= 4 * 60 * 60 * 1000 && timeUntil > 0) {
        status = "open";
      }

      // Team names: team1.teamName (confirmed from source)
      const team1 = m.team1?.teamName ?? m.team1?.teamSName ?? "TBD";
      const team2 = m.team2?.teamName ?? m.team2?.teamSName ?? "TBD";
      const venue = m.venueInfo?.ground ?? m.venue?.name ?? null;
      const city = m.venueInfo?.city ?? m.venue?.city ?? null;

      const { error } = await supabase
        .from("f11_matches")
        .upsert(
          {
            cricapi_match_id: matchId,
            team_home: team1,
            team_away: team2,
            venue,
            city,
            scheduled_at: scheduledAt,
            status,
            toss_winner: m.tossResults?.tossWinnerName ?? null,
            winner: m.matchWinner ?? null,
            result_summary: m.status ?? null,
            raw_api_payload: m,
            last_synced_at: now.toISOString(),
          },
          { onConflict: "cricapi_match_id", ignoreDuplicates: false }
        );

      if (!error) recordsUpserted++;
      else console.warn(`Upsert failed for match ${matchId}:`, error.message);
    }

    await supabase.from("f11_sync_log").insert({
      sync_type: "sync-schedule",
      status: "success",
      records_upserted: recordsUpserted,
      duration_ms: Date.now() - start,
    });

    return new Response(JSON.stringify({ ok: true, recordsUpserted, matchesFound: allMatchInfos.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    await supabase.from("f11_sync_log").insert({
      sync_type: "sync-schedule",
      status: "error",
      error_message: err.message,
      duration_ms: Date.now() - start,
    });
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
