import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { shortTeam, TEAM_COLORS, cn } from "@/lib/utils/format";
import type { IplPlayer, PlayerMatchStats } from "@/types/player";

const ROLE_ORDER = ["WK", "BAT", "AR", "BOWL"];
const ROLE_LABELS: Record<string, string> = { WK: "Wicket-Keeper", BAT: "Batters", AR: "All-Rounders", BOWL: "Bowlers" };
const ROLE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  WK:   { text: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)" },
  BAT:  { text: "#60A5FA", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.20)" },
  AR:   { text: "#34D399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.20)" },
  BOWL: { text: "#FB923C", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.20)" },
};

export default async function EntryBreakdownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contest } = await supabase
    .from("f11_contests")
    .select("*, match:f11_matches(*)")
    .eq("id", id)
    .single();

  if (!contest) notFound();

  const { data: entry } = await supabase
    .from("f11_entries")
    .select("*")
    .eq("contest_id", id)
    .eq("user_id", user.id)
    .single();

  if (!entry) notFound();

  const { data: players } = await supabase
    .from("f11_players")
    .select("*")
    .in("id", entry.player_ids);

  const match = Array.isArray(contest.match) ? contest.match[0] : contest.match;
  const matchStatus = match?.status;
  const showStats = ["live", "in_review", "completed"].includes(matchStatus ?? "");

  let statsMap: Record<string, PlayerMatchStats> = {};
  if (showStats) {
    const { data: stats } = await supabase
      .from("f11_player_stats")
      .select("*")
      .eq("match_id", contest.match_id)
      .in("player_id", entry.player_ids);
    for (const s of stats ?? []) statsMap[s.player_id] = s as PlayerMatchStats;
  }

  const playersById: Record<string, IplPlayer> = {};
  for (const p of players ?? []) playersById[p.id] = p as IplPlayer;

  // Group by role
  const byRole: Record<string, Array<{ player: IplPlayer; stat: PlayerMatchStats | null; isCap: boolean; isVC: boolean }>> = {
    WK: [], BAT: [], AR: [], BOWL: [],
  };

  for (const pid of (entry.player_ids as string[]) ?? []) {
    const p = playersById[pid];
    if (!p) continue;
    const isCap = entry.captain_id === pid;
    const isVC  = entry.vc_id === pid;
    const stat  = statsMap[pid] ?? null;
    byRole[p.role]?.push({ player: p, stat, isCap, isVC });
  }

  const totalPoints = (entry.total_points ?? 0) as number;

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-white/5"
        style={{ background: "rgba(8,13,26,0.97)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href={`/contests/${id}`}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 shrink-0"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base truncate">{entry.team_name ?? "My Team"}</p>
            {match && (
              <p className="text-slate-500 text-xs">
                {shortTeam(match.team_home)} vs {shortTeam(match.team_away)}
              </p>
            )}
          </div>
          {showStats && totalPoints > 0 && (
            <div className="text-right shrink-0">
              <p className="text-brand font-black text-xl leading-none">{totalPoints.toFixed(1)}</p>
              <p className="text-slate-500 text-[9px] uppercase font-bold">pts</p>
            </div>
          )}
        </div>

        {/* Rank strip */}
        {entry.rank && (
          <div
            className="flex items-center justify-center gap-6 px-4 py-2.5 border-t"
            style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(245,166,35,0.04)" }}
          >
            <div className="text-center">
              <p className="text-brand font-black text-2xl leading-none">#{entry.rank}</p>
              <p className="text-slate-600 text-[9px] uppercase font-bold">Rank</p>
            </div>
            {entry.prize_won > 0 && (
              <div className="text-center">
                <p className="text-green-400 font-black text-2xl leading-none">
                  ₹{entry.prize_won.toLocaleString("en-IN")}
                </p>
                <p className="text-slate-600 text-[9px] uppercase font-bold">Won</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Captain/VC legend */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-[9px] font-black text-white">C</div>
          <span className="text-slate-400 text-xs">Captain (2×)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[9px] font-black text-white">VC</div>
          <span className="text-slate-400 text-xs">Vice-Captain (1.5×)</span>
        </div>
        {!showStats && (
          <span className="text-slate-600 text-xs ml-auto">Scoring not started</span>
        )}
      </div>

      {/* Player groups by role */}
      <div className="px-4 space-y-4">
        {ROLE_ORDER.map((role) => {
          const group = byRole[role];
          if (!group || group.length === 0) return null;
          const rc = ROLE_COLORS[role];
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border"
                  style={{ color: rc.text, background: rc.bg, borderColor: rc.border }}
                >
                  {role}
                </span>
                <span className="text-slate-600 text-xs">{ROLE_LABELS[role]}</span>
              </div>

              <div className="space-y-2">
                {group.map(({ player: p, stat: s, isCap, isVC }) => {
                  const tc = TEAM_COLORS[shortTeam(p.ipl_team)] ?? "#475569";
                  const basePoints = s?.fantasy_points ?? 0;
                  const multiplier = isCap ? 2 : isVC ? 1.5 : 1;
                  const finalPoints = basePoints * multiplier;
                  const bd = s?.points_breakdown as any;

                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        background: isCap
                          ? "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, #111827 100%)"
                          : isVC
                          ? "linear-gradient(135deg, rgba(148,163,184,0.06) 0%, #111827 100%)"
                          : "#111827",
                        borderColor: isCap
                          ? "rgba(245,166,35,0.30)"
                          : isVC
                          ? "rgba(148,163,184,0.20)"
                          : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Team badge */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border"
                          style={{ borderColor: tc, background: tc + "25", color: tc }}
                        >
                          {shortTeam(p.ipl_team).slice(0, 2)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-bold text-sm truncate">{p.name}</p>
                            {isCap && (
                              <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-[8px] font-black text-white shrink-0">C</div>
                            )}
                            {isVC && (
                              <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[8px] font-black text-white shrink-0">VC</div>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs">
                            {shortTeam(p.ipl_team)} · ₹{p.credit_value} Cr
                          </p>
                          {/* In-game summary */}
                          {s && showStats && (
                            <p className="text-slate-400 text-xs mt-0.5">
                              {s.runs > 0 && <span>{s.runs}r({s.balls_faced}b) </span>}
                              {s.wickets > 0 && <span>{s.wickets}/{s.runs_conceded} </span>}
                              {s.catches > 0 && <span>{s.catches}ct </span>}
                              {s.stumpings > 0 && <span>{s.stumpings}st </span>}
                              {s.run_outs > 0 && <span>{s.run_outs}ro </span>}
                            </p>
                          )}
                        </div>

                        {/* Points */}
                        {showStats && (
                          <div className="text-right shrink-0">
                            <p className="text-brand font-black text-xl leading-none">
                              {finalPoints > 0 ? finalPoints.toFixed(1) : "0"}
                            </p>
                            {multiplier > 1 && (
                              <p className="text-slate-500 text-[9px] mt-0.5">
                                {basePoints.toFixed(1)} × {multiplier}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Breakdown detail (collapsible if exists) */}
                      {showStats && bd && Object.keys(bd).length > 0 && (
                        <div
                          className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-t text-[10px]"
                          style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}
                        >
                          {bd.playing_xi > 0 && <span className="text-slate-400">Playing XI <span className="text-white">+{bd.playing_xi}</span></span>}
                          {bd.batting?.runs > 0 && <span className="text-blue-400">Runs <span className="text-white">+{bd.batting.runs}</span></span>}
                          {bd.batting?.fours > 0 && <span className="text-blue-400">4s <span className="text-white">+{bd.batting.fours}</span></span>}
                          {bd.batting?.sixes > 0 && <span className="text-blue-400">6s <span className="text-white">+{bd.batting.sixes}</span></span>}
                          {bd.batting?.milestone > 0 && <span className="text-blue-400">Milestone <span className="text-white">+{bd.batting.milestone}</span></span>}
                          {bd.batting?.duck < 0 && <span className="text-red-400">Duck <span className="text-white">{bd.batting.duck}</span></span>}
                          {bd.batting?.strike_rate < 0 && <span className="text-red-400">SR <span className="text-white">{bd.batting.strike_rate}</span></span>}
                          {bd.bowling?.wickets > 0 && <span className="text-orange-400">Wkts <span className="text-white">+{bd.bowling.wickets}</span></span>}
                          {bd.bowling?.haul_bonus > 0 && <span className="text-orange-400">Haul <span className="text-white">+{bd.bowling.haul_bonus}</span></span>}
                          {bd.bowling?.maidens > 0 && <span className="text-orange-400">Maiden <span className="text-white">+{bd.bowling.maidens}</span></span>}
                          {bd.bowling?.economy > 0 && <span className="text-orange-400">Eco <span className="text-white">+{bd.bowling.economy}</span></span>}
                          {bd.fielding?.catches > 0 && <span className="text-green-400">Catch <span className="text-white">+{bd.fielding.catches}</span></span>}
                          {bd.fielding?.stumpings > 0 && <span className="text-green-400">Stump <span className="text-white">+{bd.fielding.stumpings}</span></span>}
                          {bd.fielding?.run_outs > 0 && <span className="text-green-400">RO <span className="text-white">+{bd.fielding.run_outs}</span></span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* View in contest */}
      <div className="px-4 mt-6">
        <Link
          href={`/contests/${id}`}
          className="block w-full text-center font-black py-3.5 rounded-2xl text-sm border border-brand/30 text-brand hover:bg-brand/5 transition"
        >
          Back to Contest →
        </Link>
      </div>
    </div>
  );
}
