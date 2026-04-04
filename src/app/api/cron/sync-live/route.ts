/**
 * Live scoring sync — called every 60s during live matches.
 * Can be triggered via Vercel Cron or manually via admin.
 *
 * Flow:
 * 1. Fetch all live matches
 * 2. For each: fetch Cricbuzz scorecard
 * 3. Parse batsmen + bowlers → player stats
 * 4. Map Cricbuzz player IDs → our player IDs via cricapi_player_id
 * 5. Calculate fantasy points (exact TATA IPL scoring)
 * 6. Upsert f11_player_stats
 * 7. Call f11_update_leaderboard() to recalculate all team totals
 * 8. If match complete → set status = "completed"
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calcFantasyPoints } from "@/lib/fantasy/scoring";
import { parseDismissal } from "@/lib/fantasy/dismissal-parser";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

// Convert cricket notation overs (3.4 = 3 overs 4 balls) to decimal
function cnToDecimal(cn: number): number {
  const full = Math.floor(cn);
  const balls = Math.round((cn - full) * 10);
  return full + balls / 6;
}

interface ParsedPlayerStat {
  cricbuzzId: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_dismissed: boolean;
  overs_bowled: number; // cricket notation
  wickets: number;
  runs_conceded: number;
  maidens: number;
  catches: number;
  stumpings: number;
  run_outs: number;
  run_outs_assist: number;
  is_playing_xi: boolean;
}

interface LiveScoreSummary {
  team1: string; team1_runs: number; team1_wickets: number; team1_overs: string;
  team2: string; team2_runs: number; team2_wickets: number; team2_overs: string;
  current_batting: string; situation: string;
}

function parseLiveScore(scorecard: any, teamHome: string, teamAway: string): LiveScoreSummary | null {
  try {
    const innings: any[] = scorecard.scoreCard ?? scorecard.scorecard ?? scorecard.Scorecard ?? scorecard.Innings ?? [];
    if (!innings.length) return null;

    const summary: LiveScoreSummary = {
      team1: teamHome, team1_runs: 0, team1_wickets: 0, team1_overs: "0.0",
      team2: teamAway, team2_runs: 0, team2_wickets: 0, team2_overs: "0.0",
      current_batting: "", situation: "",
    };

    for (let i = 0; i < Math.min(innings.length, 2); i++) {
      const inn = innings[i];
      const score = inn.score ?? inn.runs ?? 0;
      const wickets = inn.wickets ?? 0;
      const overs = String(inn.overs ?? inn.currentOver ?? "0.0");
      // Live API uses "batteamname" / "batteamsname", nested uses "bat" / "battingTeam"
      const battingTeam = inn.batteamname ?? inn.battingTeam ?? inn.bat ?? "";

      if (i === 0) {
        summary.team1 = battingTeam || teamHome;
        summary.team1_runs = score;
        summary.team1_wickets = typeof wickets === "number" ? wickets : 0;
        summary.team1_overs = overs;
      } else {
        summary.team2 = battingTeam || teamAway;
        summary.team2_runs = score;
        summary.team2_wickets = typeof wickets === "number" ? wickets : 0;
        summary.team2_overs = overs;
      }
    }

    // Current batting / chase situation
    const latestInn = innings[innings.length - 1];
    summary.current_batting = latestInn?.batteamname ?? latestInn?.battingTeam ?? latestInn?.bat ?? "";
    summary.situation = scorecard.status ?? scorecard.matchHeader?.statusText ?? "";

    return summary;
  } catch {
    return null;
  }
}

function parseScorecardStats(scorecard: any): { stats: ParsedPlayerStat[]; matchComplete: boolean } {
  // Confirmed top-level key is "scoreCard" (camelCase) in official Cricbuzz API
  const innings: any[] = scorecard.scoreCard ?? scorecard.scorecard ?? scorecard.Scorecard ?? scorecard.Innings ?? [];
  const statMap = new Map<string, ParsedPlayerStat>();

  function getOrCreate(cricbuzzId: string): ParsedPlayerStat {
    if (!statMap.has(cricbuzzId)) {
      statMap.set(cricbuzzId, {
        cricbuzzId,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0, is_dismissed: false,
        overs_bowled: 0, wickets: 0, runs_conceded: 0, maidens: 0,
        catches: 0, stumpings: 0, run_outs: 0, run_outs_assist: 0,
        is_playing_xi: true,
      });
    }
    return statMap.get(cricbuzzId)!;
  }

  for (const inn of innings) {
    // Live Cricbuzz API (scard endpoint) uses:
    //   inn.batsman  — singular array of all batting XI with fields: id, runs, balls, fours, sixes, outdec
    //   inn.bowler   — singular array of bowlers who've bowled with fields: id, overs, wickets, runs, maidens
    // Nested/historical API uses:
    //   inn.batTeamDetails.batsmenData — object keyed by bat_1/bat_2 with fields: batId, r, b, 4s, 6s, outDesc
    //   inn.bowlTeamDetails.bowlersData — object keyed by bowl_1/bowl_2 with fields: bowlerId, o, w, r, m
    const rawBat =
      inn.batTeamDetails?.batsmenData ??
      inn.batTeamDetails?.batsmen ??
      inn.batsmen ??
      inn.batsman ?? {};  // live API: singular "batsman"
    const rawBowl =
      inn.bowlTeamDetails?.bowlersData ??
      inn.bowlTeamDetails?.bowlers ??
      inn.bowlers ??
      inn.bowler ?? {};   // live API: singular "bowler"
    const batsmen = Array.isArray(rawBat) ? rawBat : Object.values(rawBat);
    const bowlers = Array.isArray(rawBowl) ? rawBowl : Object.values(rawBowl);
    // wickets in live API is a count (number), not an array — only treat as array if it is one
    const wickets: any[] = Array.isArray(inn.wickets) ? inn.wickets : [];

    for (const b of batsmen as any[]) {
      // Live API: id (number). Nested API: batId. Fallback: playerId
      const id = String(b.batId ?? b.id ?? b.playerId ?? "");
      if (!id || id === "0") continue;
      const s = getOrCreate(id);
      s.runs += (b.r ?? b.runs ?? 0);
      s.balls_faced += (b.b ?? b.balls ?? 0);
      s.fours += (b["4s"] ?? b.fours ?? 0);
      s.sixes += (b["6s"] ?? b.sixes ?? 0);
      // Live API uses "outdec" (lowercase), nested uses "outDesc"
      const outDesc = (b.outDesc ?? b.outdec ?? b.out_desc ?? "").toLowerCase().trim();
      s.is_dismissed = s.is_dismissed || (outDesc !== "" && outDesc !== "not out" && outDesc !== "batting");
    }

    for (const bw of bowlers as any[]) {
      // Live API: id (number). Nested API: bowlerId. Fallback: bowlId/playerId
      const id = String(bw.bowlerId ?? bw.bowlId ?? bw.id ?? bw.playerId ?? "");
      if (!id || id === "0") continue;
      const s = getOrCreate(id);
      // Live API: overs as string e.g. "0.1". Nested API: o as number.
      const newOvCN = parseFloat(String(bw.o ?? bw.overs ?? "0"));
      const newBalls = Math.floor(newOvCN) * 6 + Math.round((newOvCN % 1) * 10);
      const existingBalls = Math.floor(s.overs_bowled) * 6 + Math.round((s.overs_bowled % 1) * 10);
      const totalBalls = existingBalls + newBalls;
      s.overs_bowled = parseFloat((Math.floor(totalBalls / 6) + (totalBalls % 6) / 10).toFixed(1));
      s.wickets += (bw.w ?? bw.wickets ?? 0);
      s.runs_conceded += (bw.r ?? bw.runs ?? 0);
      s.maidens += (bw.m ?? bw.maidens ?? 0);
    }

    // Parse fielding credits from wicket array (only available in nested/historical API)
    for (const w of wickets) {
      const wktDesc: string = w.wktDesc ?? w.dismissal ?? "";
      const parsed = parseDismissal(wktDesc);

      // Cricbuzz provides numeric fielder IDs directly on the wicket object
      const f1Id = String(w.fielderId1 ?? w.fielder1Id ?? "");
      const f2Id = String(w.fielderId2 ?? w.fielder2Id ?? "");

      switch (parsed.type) {
        case "caught": {
          if (f1Id) getOrCreate(f1Id).catches += 1;
          break;
        }
        case "caught_and_bowled": {
          // Bowler gets both +25 (wicket) and +8 (catch) — catch credit on bowler
          const bowlerId = String(w.bowlerId ?? w.bowler ?? "");
          if (bowlerId) getOrCreate(bowlerId).catches += 1;
          break;
        }
        case "stumped": {
          if (f1Id) getOrCreate(f1Id).stumpings += 1;
          break;
        }
        case "run_out": {
          if (parsed.isDirectHit) {
            // Direct hit: primary fielder gets full run-out credit (+12)
            if (f1Id) getOrCreate(f1Id).run_outs += 1;
          } else {
            // Relay: both fielders get assist credit (+6 each)
            if (f1Id) getOrCreate(f1Id).run_outs_assist += 1;
            if (f2Id && f2Id !== f1Id) getOrCreate(f2Id).run_outs_assist += 1;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // Detect match complete — Cricbuzz uses several different signals
  const state = (scorecard.matchHeader?.state ?? scorecard.header?.state ?? "").toLowerCase();
  const statusText = (
    scorecard.status ??
    scorecard.matchHeader?.statusText ??
    scorecard.matchHeader?.status ??
    ""
  ).toLowerCase();
  const matchComplete =
    state === "complete" ||
    state === "result" ||
    scorecard.matchHeader?.complete === true ||
    // Status text contains a result phrase
    /\b(won by|tied|no result|match drawn)\b/.test(statusText);

  return { stats: Array.from(statMap.values()), matchComplete };
}

export async function GET(req: NextRequest) {
  // Verify cron secret (set CRON_SECRET in .env.local)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: "RAPIDAPI_KEY not set" }, { status: 500 });
  }

  // Time guard: only run during IPL match windows (10:00–18:30 UTC = 3:30 PM–midnight IST)
  // Covers both slots: afternoon (3:30 PM IST) and evening (7:30 PM IST).
  // Staleness check handles the "forgot to close" case inside the window.
  const nowUTC = new Date();
  const utcMinutes = nowUTC.getUTCHours() * 60 + nowUTC.getUTCMinutes();
  const WINDOW_START = 10 * 60;      // 10:00 UTC = 3:30 PM IST
  const WINDOW_END   = 18 * 60 + 30; // 18:30 UTC = midnight IST
  if (utcMinutes < WINDOW_START || utcMinutes > WINDOW_END) {
    return NextResponse.json({ ok: true, message: "Outside IPL match hours (3:30 PM–midnight IST), skipping", synced: 0 });
  }

  const admin = await createServiceClient();

  // 1. Get all live matches that aren't paused
  const { data: liveMatches } = await admin
    .from("f11_matches")
    .select("id, cricapi_match_id, team_home, team_away, scheduled_at")
    .eq("status", "live")
    .eq("is_scoring_paused", false);

  if (!liveMatches?.length) {
    return NextResponse.json({ ok: true, message: "No live matches", synced: 0 });
  }

  const results: any[] = [];

  for (const match of liveMatches) {
    try {
      // Staleness guard: auto-transition to in_review if match has been "live"
      // for more than 5.5 hours — protects credits if admin forgets to close it.
      if (match.scheduled_at) {
        const elapsedHours = (Date.now() - new Date(match.scheduled_at).getTime()) / 3_600_000;
        if (elapsedHours > 5.5) {
          await admin.from("f11_matches")
            .update({ status: "in_review" })
            .eq("id", match.id)
            .eq("status", "live");
          results.push({ matchId: match.id, skipped: "stale — auto-moved to in_review", elapsedHours: elapsedHours.toFixed(1) });
          continue;
        }
      }

      if (!match.cricapi_match_id) {
        results.push({ matchId: match.id, skipped: "no cricbuzz ID" });
        continue;
      }

      // 2. Fetch scorecard
      const res = await fetch(`https://${CB_HOST}/mcenter/v1/${match.cricapi_match_id}/scard`, {
        headers: cbHeaders(),
      });
      if (!res.ok) throw new Error(`Cricbuzz returned ${res.status}`);
      const data = await res.json();

      // 3. Parse stats
      const { stats, matchComplete } = parseScorecardStats(data);
      if (stats.length === 0) {
        results.push({ matchId: match.id, skipped: "no scorecard data yet" });
        continue;
      }

      // 4. Map cricbuzz IDs → our player IDs
      const cricIds = stats.map((s) => s.cricbuzzId);
      const { data: players } = await admin
        .from("f11_players")
        .select("id, cricapi_player_id, role")
        .in("cricapi_player_id", cricIds);

      const playerMap = new Map<string, { id: string; role: string }>();
      for (const p of players ?? []) {
        playerMap.set(p.cricapi_player_id, { id: p.id, role: p.role });
      }

      // 5. Calculate + upsert player stats
      let upsertCount = 0;
      for (const s of stats) {
        const player = playerMap.get(s.cricbuzzId);
        if (!player) continue;

        const role = player.role as "WK" | "BAT" | "AR" | "BOWL";
        const breakdown = calcFantasyPoints(
          {
            runs: s.runs,
            balls_faced: s.balls_faced,
            fours: s.fours,
            sixes: s.sixes,
            is_dismissed: s.is_dismissed,
            overs_bowled: s.overs_bowled,
            wickets: s.wickets,
            runs_conceded: s.runs_conceded,
            maidens: s.maidens,
            catches: s.catches,
            stumpings: s.stumpings,
            run_outs: s.run_outs,
            run_outs_assist: s.run_outs_assist,
            batting_position: null,
            wides: 0,
          },
          role,
          s.is_playing_xi,
        );

        const { error } = await admin.from("f11_player_stats").upsert(
          {
            match_id: match.id,
            player_id: player.id,
            runs: s.runs,
            balls_faced: s.balls_faced,
            fours: s.fours,
            sixes: s.sixes,
            is_dismissed: s.is_dismissed,
            overs_bowled: s.overs_bowled,
            wickets: s.wickets,
            runs_conceded: s.runs_conceded,
            maidens: s.maidens,
            catches: s.catches,
            stumpings: s.stumpings,
            run_outs: s.run_outs,
            run_outs_assist: s.run_outs_assist,
            fantasy_points: breakdown.total,
            points_breakdown: breakdown,
          },
          { onConflict: "match_id,player_id" }
        );
        if (!error) upsertCount++;
      }

      // 6. Update live score summary (for LiveScoreHeader component)
      const liveScore = parseLiveScore(data, match.team_home, match.team_away);
      if (liveScore) {
        await admin.from("f11_matches").update({ live_score_summary: liveScore }).eq("id", match.id);
      }

      // 7. Recalculate leaderboard
      await admin.rpc("f11_update_leaderboard", { p_match_id: match.id });

      // 8. Move to in_review if match ended (admin will verify + finalize)
      if (matchComplete) {
        const resultText = liveScore?.situation ||
          (data.status ?? data.matchHeader?.statusText ?? "Match complete");
        await admin.from("f11_matches")
          .update({ status: "in_review", result_summary: resultText })
          .eq("id", match.id)
          .eq("status", "live"); // guard: don't overwrite if already in_review
        // Do NOT complete contests yet — admin must click Finalize
      }

      results.push({ matchId: match.id, playersUpdated: upsertCount, matchComplete });
    } catch (err: any) {
      results.push({ matchId: match.id, error: err.message });
    }
  }

  return NextResponse.json({ ok: true, results });
}

// Also allow POST for manual admin trigger
export async function POST(req: NextRequest) {
  return GET(req);
}
