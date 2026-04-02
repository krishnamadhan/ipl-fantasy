import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, shortTeam, formatDateTime } from "@/lib/utils/format";
import type { IplMatch } from "@/types/match";
import CountdownTimer from "@/components/ui/CountdownTimer";

export const revalidate = 30;

const TEAM_COLORS: Record<string, string> = {
  CSK: "#F5A623", MI: "#004BA0", RCB: "#EC1C24", KKR: "#3A225D",
  DC: "#0078BC", RR: "#EA1A85", PBKS: "#ED1B24", SRH: "#F26522",
  GT: "#1C1C1C", LSG: "#A4D65E",
};

function teamColor(team: string): string {
  return TEAM_COLORS[shortTeam(team)] ?? "#475569";
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: match } = await supabase
    .from("f11_matches")
    .select("*")
    .eq("id", id)
    .single();

  if (!match) notFound();
  const m = match as IplMatch;

  const isLive = m.status === "live";
  const isCompleted = m.status === "completed";
  const isInReview = m.status === "in_review";
  const isOpen = m.status === "open";
  const isLocked = m.status === "locked";
  const showScore = isLive || isCompleted || isInReview;

  const [contestsRes, statsRes, myTeamRes] = await Promise.all([
    supabase
      .from("f11_contests")
      .select("id, name, contest_type, entry_fee, prize_pool, max_teams, status")
      .eq("match_id", id)
      .in("status", ["open", "locked"])
      .order("entry_fee", { ascending: true })
      .limit(5),
    showScore
      ? supabase
          .from("f11_player_stats")
          .select("*, player:f11_players(name, ipl_team, role)")
          .eq("match_id", id)
          .order("fantasy_points", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("f11_teams")
      .select("id, team_name")
      .eq("user_id", user.id)
      .eq("match_id", id)
      .limit(1),
  ]);

  const contests = contestsRes.data ?? [];
  const stats = (statsRes.data ?? []) as any[];
  const myTeam = myTeamRes.data?.[0];

  const batters = stats
    .filter((s) => s.balls_faced > 0 || s.runs > 0)
    .sort((a, b) => b.runs - a.runs);
  const bowlers = stats
    .filter((s) => s.overs_bowled > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded);

  const homeColor = teamColor(m.team_home);
  const awayColor = teamColor(m.team_away);

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>

      {/* Match hero card */}
      <div className="mx-4 mt-6 rounded-3xl overflow-hidden border border-slate-700/60"
        style={{ background: "linear-gradient(145deg, #0d1b35 0%, #111827 60%, #0a0f1e 100%)" }}>
        {/* Team color gradient bar */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${homeColor}, ${awayColor})` }} />

        <div className="px-5 pt-4 pb-5">
          {/* Status + time */}
          <div className="flex items-center justify-between mb-5">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
              isLive ? "bg-red-500/15 border-red-500/30 text-red-400"
              : isCompleted ? "bg-green-500/15 border-green-500/30 text-green-400"
              : isInReview ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
              : isLocked ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
              : isOpen ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
              : "bg-slate-700 border-slate-600 text-slate-400"
            }`}>
              {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 animate-pulse align-middle" />}
              {m.status?.replace("_", " ").toUpperCase()}
            </span>
            {isLive ? (
              <span className="text-red-400 text-sm font-bold animate-pulse">LIVE</span>
            ) : !isCompleted ? (
              <CountdownTimer targetDate={m.scheduled_at} compact />
            ) : (
              <span className="text-slate-500 text-xs">{formatDateTime(m.scheduled_at)}</span>
            )}
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-lg border-2"
                style={{ borderColor: homeColor, background: homeColor + "22", color: homeColor }}>
                {shortTeam(m.team_home)}
              </div>
              <p className="text-white font-bold text-xs leading-tight">{m.team_home}</p>
            </div>

            <div className="px-4 text-center">
              <p className="text-3xl font-black text-slate-700">VS</p>
              {m.city && <p className="text-slate-600 text-[10px] mt-1">{m.city}</p>}
            </div>

            <div className="text-center flex-1">
              <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-lg border-2"
                style={{ borderColor: awayColor, background: awayColor + "22", color: awayColor }}>
                {shortTeam(m.team_away)}
              </div>
              <p className="text-white font-bold text-xs leading-tight">{m.team_away}</p>
            </div>
          </div>

          {/* Toss / result */}
          {m.result_summary && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-3 text-center">
              <p className="text-green-400 text-sm font-bold">{m.result_summary}</p>
            </div>
          )}
          {m.toss_winner && !m.result_summary && (
            <p className="text-slate-500 text-xs text-center mb-3">
              Toss: {shortTeam(m.toss_winner)} won · chose to {m.batting_first === m.toss_winner ? "bat" : "bowl"}
            </p>
          )}

          {/* Locked badge */}
          {isLocked && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 mb-3 text-center">
              <p className="text-orange-400 text-sm font-bold">Teams Locked — Match Starting Soon</p>
            </div>
          )}
          {isInReview && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 mb-3 text-center">
              <p className="text-purple-400 text-sm font-bold">Match Complete — Points Being Verified</p>
            </div>
          )}

          {/* CTAs */}
          {isOpen && (
            <div className="flex gap-3">
              <Link href={`/contests/browse/${m.id}`}
                className="flex-1 bg-brand text-white text-center font-black py-3.5 rounded-2xl text-sm shadow-lg shadow-brand/20">
                Join Contest
              </Link>
              {!myTeam ? (
                <Link href={`/team-builder/${m.id}`}
                  className="flex-1 border-2 border-brand/50 text-brand text-center font-black py-3.5 rounded-2xl text-sm hover:border-brand transition">
                  + Build Team
                </Link>
              ) : (
                <Link href={`/team-builder/${m.id}`}
                  className="flex-1 border-2 border-slate-600 text-slate-300 text-center font-black py-3.5 rounded-2xl text-sm hover:border-slate-500 transition">
                  Edit Team
                </Link>
              )}
            </div>
          )}
          {(isLive || isInReview) && (
            <Link href={`/matches/${m.id}/live`}
              className="block w-full text-center font-black py-3.5 rounded-2xl text-sm shadow-lg transition"
              style={{
                background: isLive
                  ? "linear-gradient(135deg, #EF4444, #DC2626)"
                  : "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                boxShadow: isLive ? "0 4px 16px rgba(239,68,68,0.35)" : "0 4px 16px rgba(139,92,246,0.35)",
                color: "white",
              }}>
              {isLive ? "🔴 View Live Scores" : "📊 View Final Scores"}
            </Link>
          )}
        </div>
      </div>

      {/* Contests section */}
      {contests.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 text-xs font-black uppercase tracking-wider">Contests</p>
            <Link href={`/contests/browse/${m.id}`} className="text-brand text-xs font-bold">View all →</Link>
          </div>
          <div className="space-y-2">
            {contests.map((c: any) => (
              <Link key={c.id} href={isOpen ? `/contests/browse/${m.id}` : `/contests/${c.id}`}
                className="flex items-center justify-between rounded-2xl px-4 py-3.5 border border-slate-700 hover:border-slate-600 transition"
                style={{ background: "#111827", borderColor: "rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-white font-bold text-sm">{c.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    <span className="uppercase text-[9px] font-black">{c.contest_type}</span>
                    {" · "}
                    {c.entry_fee === 0 ? "FREE" : formatCurrency(c.entry_fee)} entry
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand font-black">{formatCurrency(c.prize_pool)}</p>
                  <p className="text-slate-600 text-[9px]">Prize Pool</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Live scorecard */}
      {showScore && (
        <div className="px-4 mt-5 space-y-4">
          <p className="text-slate-400 text-xs font-black uppercase tracking-wider">
            {isLive ? "Live Scorecard" : "Final Scorecard"}
          </p>

          {batters.length > 0 && (
            <div className="rounded-2xl border border-slate-700 overflow-hidden" style={{ background: "#111827" }}>
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: homeColor }} />
                <p className="text-white text-xs font-black uppercase tracking-wider">Batting</p>
              </div>
              <div className="grid grid-cols-[1fr_36px_36px_36px_48px] gap-1 px-4 py-2 border-b border-slate-800">
                {["Batter","R","B","4s","Pts"].map((h) => (
                  <span key={h} className="text-[9px] text-slate-600 font-black uppercase text-right first:text-left">{h}</span>
                ))}
              </div>
              {batters.slice(0, 8).map((s: any) => (
                <div key={s.id} className="grid grid-cols-[1fr_36px_36px_36px_48px] gap-1 px-4 py-2.5 border-b border-slate-800/50 last:border-0">
                  <div>
                    <p className="text-white text-sm font-semibold truncate">{s.player?.name}</p>
                    <p className="text-slate-500 text-[10px]">{shortTeam(s.player?.ipl_team ?? "")} · {s.player?.role}</p>
                  </div>
                  <span className="text-white text-sm text-right self-center font-bold tabular-nums">{s.runs}</span>
                  <span className="text-slate-400 text-sm text-right self-center tabular-nums">{s.balls_faced}</span>
                  <span className="text-slate-400 text-sm text-right self-center tabular-nums">{s.fours}</span>
                  <span className="text-brand text-sm text-right self-center font-black tabular-nums">{s.fantasy_points ?? 0}</span>
                </div>
              ))}
            </div>
          )}

          {bowlers.length > 0 && (
            <div className="rounded-2xl border border-slate-700 overflow-hidden" style={{ background: "#111827" }}>
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: awayColor }} />
                <p className="text-white text-xs font-black uppercase tracking-wider">Bowling</p>
              </div>
              <div className="grid grid-cols-[1fr_36px_36px_36px_48px] gap-1 px-4 py-2 border-b border-slate-800">
                {["Bowler","Ov","W","R","Pts"].map((h) => (
                  <span key={h} className="text-[9px] text-slate-600 font-black uppercase text-right first:text-left">{h}</span>
                ))}
              </div>
              {bowlers.slice(0, 8).map((s: any) => (
                <div key={s.id} className="grid grid-cols-[1fr_36px_36px_36px_48px] gap-1 px-4 py-2.5 border-b border-slate-800/50 last:border-0">
                  <div>
                    <p className="text-white text-sm font-semibold truncate">{s.player?.name}</p>
                    <p className="text-slate-500 text-[10px]">{shortTeam(s.player?.ipl_team ?? "")} · {s.player?.role}</p>
                  </div>
                  <span className="text-slate-400 text-sm text-right self-center tabular-nums">{s.overs_bowled}</span>
                  <span className="text-white text-sm text-right self-center font-bold tabular-nums">{s.wickets}</span>
                  <span className="text-slate-400 text-sm text-right self-center tabular-nums">{s.runs_conceded}</span>
                  <span className="text-brand text-sm text-right self-center font-black tabular-nums">{s.fantasy_points ?? 0}</span>
                </div>
              ))}
            </div>
          )}

          {stats.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No scorecard data yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
