// Supabase Edge Function — syncs live match scores from Cricbuzz (RapidAPI)
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

// TATA IPL official scoring — keep in sync with src/lib/fantasy/scoring.ts
// overs_bowled stores cricket notation (3.4 = 3 overs 4 balls), convert before economy math
function cricketOversToDecimal(overs: number): number {
  const full = Math.floor(overs);
  const balls = Math.round((overs - full) * 10);
  return full + balls / 6;
}

function calcPoints(s: any): number {
  let pts = 4; // playing XI bonus
  pts += (s.runs ?? 0) * 1;
  pts += (s.fours ?? 0) * 1;           // boundary bonus
  pts += (s.sixes ?? 0) * 2;           // six boundary bonus
  // Century REPLACES half-century (not cumulative)
  if (s.runs >= 100) pts += 16;
  else if (s.runs >= 50) pts += 8;
  if (s.runs === 0 && s.is_dismissed) pts -= 2; // duck penalty
  if (s.balls_faced >= 10) {
    const sr = (s.runs / s.balls_faced) * 100;
    // TATA IPL: NO SR bonuses — only penalties
    if (sr < 50) pts -= 6;
    else if (sr < 60) pts -= 4;
    else if (sr < 70) pts -= 2;
  }
  pts += (s.wickets ?? 0) * 25;
  if (s.wickets >= 5) pts += 16;
  else if (s.wickets >= 4) pts += 8;
  else if (s.wickets >= 3) pts += 4;
  // Note: no 3-catch bonus in TATA IPL
  pts += (s.maidens ?? 0) * 8;
  if (s.overs_bowled >= 2) {
    const decimalOvers = cricketOversToDecimal(s.overs_bowled);
    const eco = decimalOvers > 0 ? s.runs_conceded / decimalOvers : 0;
    // TATA IPL: economy BONUSES only — no penalties
    if (eco < 5) pts += 4;
    else if (eco <= 6) pts += 2;
  }
  pts += (s.catches ?? 0) * 8;
  pts += (s.stumpings ?? 0) * 12;
  pts += (s.run_outs ?? 0) * 12;        // direct run out
  pts += (s.run_outs_assist ?? 0) * 6;  // run out assist
  return pts;
}

// Cricbuzz returns batsmen/bowlers as arrays in newer wrapper but may be objects in older format
function toArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  // Object with numeric/string keys: { "0": {...}, "1": {...} } or { bat_1: {...} }
  return Object.values(val);
}

// Cricbuzz /mcenter/v1/{id}/scard scorecard structure (confirmed from API docs):
// Top-level key: scoreCard (camelCase) — fallback to older variants
// Each innings has batTeamDetails.batsmenData (object with bat_N keys)
//            and bowlTeamDetails.bowlersData (object with bowl_N keys)
// Batsman fields: batId (player ID), runs/r, balls/b, 4s/fours, 6s/sixes, outDesc/out_desc
// Bowler fields:  bowlerId (player ID), overs/o, maidens/m, runs/r, wickets/w, wides/wd
function getScorecard(data: any): any[] {
  // scoreCard is the confirmed field name; older/unofficial wrappers use lowercase variants
  return data.scoreCard ?? data.scorecard ?? data.Scorecard ?? data.Innings ?? data.innings ?? [];
}

function getBatsmen(innings: any): any[] {
  // Confirmed structure: innings.batTeamDetails.batsmenData (object keyed by bat_1, bat_2...)
  const nested = innings.batTeamDetails?.batsmenData ?? innings.batTeamDetails?.batsmen;
  return toArray(nested ?? innings.batsmen ?? innings.batsmenData ?? innings.batcard ?? innings.bat);
}

function getBowlers(innings: any): any[] {
  // Confirmed structure: innings.bowlTeamDetails.bowlersData (object keyed by bowl_1, bowl_2...)
  const nested = innings.bowlTeamDetails?.bowlersData ?? innings.bowlTeamDetails?.bowlers;
  return toArray(nested ?? innings.bowlers ?? innings.bowlersData ?? innings.bowlcard ?? innings.bowl);
}

// Check if match has ended — Cricbuzz uses header.state === 'complete' or matchHeader.complete
function isMatchEnded(data: any): boolean {
  const h = data.matchHeader ?? data.header ?? {};
  if (h.complete === true) return true;
  if (h.matchEnded === true) return true;
  if (typeof h.state === "string" && h.state.toLowerCase().includes("complete")) return true;
  if (typeof h.status === "string") {
    const s = h.status.toLowerCase();
    if (s.includes("won") || s.includes("tied") || s.includes("abandoned") || s.includes("no result")) return true;
  }
  return false;
}

function getMatchWinner(data: any): string | null {
  const h = data.matchHeader ?? data.header ?? {};
  return h.matchWinner ?? h.result ?? null;
}

function getResultSummary(data: any): string | null {
  const h = data.matchHeader ?? data.header ?? {};
  return h.status ?? h.result ?? null;
}

Deno.serve(async () => {
  const start = Date.now();

  try {
    // Guard: only run during IPL match windows (10:00–18:30 UTC = 3:30 PM–midnight IST)
    // Covers both slots: afternoon (3:30 PM IST) and evening (7:30 PM IST).
    // Staleness check below handles the "forgot to close" case inside the window.
    const nowUTC = new Date();
    const utcMinutes = nowUTC.getUTCHours() * 60 + nowUTC.getUTCMinutes();
    const WINDOW_START = 10 * 60;      // 10:00 UTC = 3:30 PM IST
    const WINDOW_END   = 18 * 60 + 30; // 18:30 UTC = midnight IST (T20 + 1hr buffer)
    if (utcMinutes < WINDOW_START || utcMinutes > WINDOW_END) {
      return new Response(JSON.stringify({ ok: true, message: "Outside IPL match hours (3:30 PM–midnight IST), skipping" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: liveMatches } = await supabase
      .from("f11_matches")
      .select("id, cricapi_match_id, scheduled_at")
      .eq("status", "live");

    if (!liveMatches?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No live matches" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    for (const match of liveMatches) {
      // Staleness guard: if a match has been "live" for more than 5.5 hours since
      // its scheduled_at, auto-transition to "in_review" to protect RapidAPI credits.
      // Admin can review + finalize or reopen as needed.
      if (match.scheduled_at) {
        const scheduledMs = new Date(match.scheduled_at).getTime();
        const elapsedHours = (Date.now() - scheduledMs) / 3_600_000;
        if (elapsedHours > 5.5) {
          await supabase
            .from("f11_matches")
            .update({ status: "in_review" })
            .eq("id", match.id)
            .eq("status", "live");
          continue; // skip API call for this match
        }
      }

      if (!match.cricapi_match_id) continue;

      const res = await fetch(
        `${CB_BASE}/mcenter/v1/${match.cricapi_match_id}/scard`,
        { headers: cbHeaders() }
      );
      const data = await res.json();
      if (!data || data.error) continue;

      const scorecard = getScorecard(data);
      const matchEnded = isMatchEnded(data);
      const statsMap = new Map<string, any>();

      for (const innings of scorecard) {
        const batsmen = getBatsmen(innings);
        const bowlers = getBowlers(innings);

        for (const b of batsmen) {
          // Player ID: confirmed field is "batId" in official Cricbuzz API
          const cricId = String(b.batId ?? b.id ?? b.playerId ?? "");
          if (!cricId || cricId === "undefined") continue;

          const { data: player } = await supabase
            .from("f11_players")
            .select("id")
            .eq("cricapi_player_id", cricId)
            .maybeSingle();
          if (!player) continue;

          const existing = statsMap.get(player.id) ?? {
            match_id: match.id, player_id: player.id,
            runs: 0, balls_faced: 0, fours: 0, sixes: 0, is_dismissed: false,
            batting_position: null, overs_bowled: 0, wickets: 0, runs_conceded: 0,
            maidens: 0, wides: 0, catches: 0, stumpings: 0, run_outs: 0, run_outs_assist: 0,
          };

          // Confirmed field names: r=runs, b=balls, 4s=fours, 6s=sixes
          // Full-word variants as fallback (unofficial-cricbuzz host uses those)
          existing.runs += b.r ?? b.runs ?? 0;
          existing.balls_faced += b.b ?? b.balls ?? 0;
          existing.fours += b['4s'] ?? b.fours ?? 0;
          existing.sixes += b['6s'] ?? b.sixes ?? 0;
          // Dismissal: out_desc (old API), outDesc (unofficial), wicketCode (some wrappers)
          if (b.out_desc || b.outDesc || b.wicketCode) existing.is_dismissed = true;

          statsMap.set(player.id, existing);
        }

        for (const bw of bowlers) {
          // Player ID: confirmed field is "bowlerId" in official Cricbuzz API
          const cricId = String(bw.bowlerId ?? bw.id ?? bw.bowlId ?? bw.playerId ?? "");
          if (!cricId || cricId === "undefined") continue;

          const { data: player } = await supabase
            .from("f11_players")
            .select("id")
            .eq("cricapi_player_id", cricId)
            .maybeSingle();
          if (!player) continue;

          const existing = statsMap.get(player.id) ?? {
            match_id: match.id, player_id: player.id,
            runs: 0, balls_faced: 0, fours: 0, sixes: 0, is_dismissed: false,
            batting_position: null, overs_bowled: 0, wickets: 0, runs_conceded: 0,
            maidens: 0, wides: 0, catches: 0, stumpings: 0, run_outs: 0, run_outs_assist: 0,
          };

          // Confirmed: o=overs, m=maidens, r=runs conceded, w=wickets, wd=wides
          existing.overs_bowled += parseFloat(String(bw.o ?? bw.overs ?? "0"));
          existing.wickets += bw.w ?? bw.wickets ?? 0;
          existing.runs_conceded += bw.r ?? bw.runs ?? 0;
          existing.maidens += bw.m ?? bw.maidens ?? 0;
          existing.wides += bw.wd ?? bw.wides ?? 0;

          statsMap.set(player.id, existing);
        }
      }

      // Upsert stats + compute fantasy points
      for (const [, stats] of statsMap) {
        stats.fantasy_points = calcPoints(stats);
        await supabase
          .from("f11_player_stats")
          .upsert(stats, { onConflict: "match_id,player_id" });
      }

      // Bulk leaderboard update
      await supabase.rpc("f11_update_leaderboard", { p_match_id: match.id });

      if (matchEnded) {
        await supabase
          .from("f11_matches")
          .update({
            status: "completed",
            winner: getMatchWinner(data),
            result_summary: getResultSummary(data),
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", match.id);

        await supabase
          .from("f11_contests")
          .update({ status: "completed" })
          .eq("match_id", match.id)
          .eq("status", "locked");
      }
    }

    return new Response(
      JSON.stringify({ ok: true, matchesProcessed: liveMatches.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    await supabase.from("f11_sync_log").insert({
      sync_type: "sync-live",
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
