import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, shortTeam, TEAM_COLORS, formatTimeIST } from "@/lib/utils/format";
import type { IplMatch } from "@/types/match";
import CountdownTimer from "@/components/ui/CountdownTimer";
import DashboardLiveCard from "@/components/live/DashboardLiveCard";

export const revalidate = 30;

function teamColor(team: string): string {
  return TEAM_COLORS[shortTeam(team)] ?? "#F5A623";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, matchesRes] = await Promise.all([
    supabase
      .from("f11_profiles")
      .select("username, display_name, wallet_balance")
      .eq("id", user.id)
      .single(),
    supabase
      .from("f11_matches")
      .select("id, team_home, team_away, venue, city, scheduled_at, status, live_score_summary")
      .in("status", ["open", "locked", "scheduled", "live"])
      .gt("scheduled_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(6),
  ]);

  const profile = profileRes.data;
  const matches = (matchesRes.data ?? []) as IplMatch[];

  const { data: myEntries } = await (supabase as any)
    .from("f11_entries")
    .select("id, total_points, rank, contest:f11_contests(id, name, status, prize_pool, match:f11_matches(id, team_home, team_away))")
    .eq("user_id", user.id)
    .in("contest.status", ["open", "locked", "live"])
    .order("created_at", { ascending: false })
    .limit(5);

  const activeEntries = (myEntries ?? []).filter((e: any) => e.contest);
  const liveMatches = matches.filter((m) => m.status === "live");
  const nextMatch = matches.find((m) => m.status !== "live");
  const otherMatches = matches.filter((m) => m.id !== nextMatch?.id && m.status !== "live");

  const firstName = (profile?.display_name ?? profile?.username ?? "Player").split(" ")[0];

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>

      {/* ── Greeting ── */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-white font-black text-xl leading-tight">
          Hey, {firstName} 👋
        </p>
        <p className="text-[#8A95A8] text-xs mt-0.5">IPL 2026 · Ready to play?</p>
      </div>

      {/* ── LIVE banner — Realtime client component, self-updating ── */}
      {liveMatches.length > 0 && (
        <DashboardLiveCard matches={liveMatches as any} />
      )}

      {/* ── Featured match hero ── */}
      {nextMatch && (
        <div className="mx-4 mb-4 rounded-3xl overflow-hidden border"
          style={{
            background: "linear-gradient(145deg, #0d1b35 0%, #0f1e30 60%, #080d1a 100%)",
            borderColor: "rgba(255,255,255,0.08)",
          }}>
          {/* Team color gradient top bar */}
          <div className="h-1 w-full"
            style={{ background: `linear-gradient(90deg, ${teamColor(nextMatch.team_home)}, ${teamColor(nextMatch.team_away)})` }} />

          <div className="px-5 py-5">
            {/* Status chip + time */}
            <div className="flex items-center justify-between mb-5">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                nextMatch.status === "open"
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : nextMatch.status === "locked"
                  ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}>
                {nextMatch.status === "open" ? "⚡ Deadline Active" : nextMatch.status === "locked" ? "🔒 Teams Locked" : "Upcoming"}
              </span>
              <CountdownTimer targetDate={nextMatch.scheduled_at} compact />
            </div>

            {/* Teams row */}
            <div className="flex items-center justify-between mb-5">
              {/* Home */}
              <div className="text-center flex-1">
                <div
                  className="w-[72px] h-[72px] rounded-full mx-auto mb-2 flex items-center justify-center font-black text-xl border-2 shadow-xl"
                  style={{
                    borderColor: teamColor(nextMatch.team_home),
                    background: `linear-gradient(135deg, ${teamColor(nextMatch.team_home)}33 0%, ${teamColor(nextMatch.team_home)}15 100%)`,
                    color: teamColor(nextMatch.team_home),
                    boxShadow: `0 0 20px ${teamColor(nextMatch.team_home)}30`,
                  }}
                >
                  {shortTeam(nextMatch.team_home)}
                </div>
                <p className="text-white font-bold text-xs leading-tight max-w-[90px] mx-auto">
                  {nextMatch.team_home}
                </p>
              </div>

              {/* VS */}
              <div className="text-center px-2">
                <p className="text-slate-700 text-[10px] font-black uppercase mb-1">
                  {nextMatch.city ?? nextMatch.venue?.split(",")[0] ?? ""}
                </p>
                <p className="text-4xl font-black text-slate-700 leading-none">VS</p>
                {nextMatch.scheduled_at && (
                  <p className="text-slate-600 text-[10px] mt-1">
                    {formatTimeIST(nextMatch.scheduled_at)}
                  </p>
                )}
              </div>

              {/* Away */}
              <div className="text-center flex-1">
                <div
                  className="w-[72px] h-[72px] rounded-full mx-auto mb-2 flex items-center justify-center font-black text-xl border-2 shadow-xl"
                  style={{
                    borderColor: teamColor(nextMatch.team_away),
                    background: `linear-gradient(135deg, ${teamColor(nextMatch.team_away)}33 0%, ${teamColor(nextMatch.team_away)}15 100%)`,
                    color: teamColor(nextMatch.team_away),
                    boxShadow: `0 0 20px ${teamColor(nextMatch.team_away)}30`,
                  }}
                >
                  {shortTeam(nextMatch.team_away)}
                </div>
                <p className="text-white font-bold text-xs leading-tight max-w-[90px] mx-auto">
                  {nextMatch.team_away}
                </p>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-2.5">
              <Link
                href={`/contests/browse/${nextMatch.id}`}
                className="flex-1 text-white text-center font-black py-3.5 rounded-2xl text-sm shadow-lg transition hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #F5A623, #E8950F)",
                  boxShadow: "0 4px 16px rgba(245,166,35,0.35)",
                }}
              >
                Join Contests
              </Link>
              <Link
                href={`/team-builder/${nextMatch.id}`}
                className="flex-1 text-brand text-center font-black py-3.5 rounded-2xl text-sm border-2 border-brand/40 hover:border-brand transition"
                style={{ background: "rgba(245,166,35,0.05)" }}
              >
                + Build Team
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Other upcoming matches ── */}
      {otherMatches.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 text-xs font-black uppercase tracking-wider">More Matches</p>
            <Link href="/matches" className="text-brand text-xs font-bold hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {otherMatches.slice(0, 3).map((m) => {
              const hc = teamColor(m.team_home);
              const ac = teamColor(m.team_away);
              return (
                <Link key={m.id} href={`/contests/browse/${m.id}`}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-white/6 hover:border-white/12 transition"
                  style={{ background: "rgba(255,255,255,0.025)" }}>
                  {/* Mini team badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-[9px] font-black"
                      style={{ borderColor: hc, background: hc + "25", color: hc }}>
                      {shortTeam(m.team_home).slice(0, 2)}
                    </div>
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-[9px] font-black"
                      style={{ borderColor: ac, background: ac + "25", color: ac }}>
                      {shortTeam(m.team_away).slice(0, 2)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm">
                      {shortTeam(m.team_home)} <span className="text-slate-600 font-normal text-xs">vs</span> {shortTeam(m.team_away)}
                    </p>
                    {m.city && <p className="text-slate-600 text-xs truncate">{m.city}</p>}
                  </div>

                  <div className="text-right shrink-0">
                    <CountdownTimer targetDate={m.scheduled_at} compact />
                    {m.status === "open" && (
                      <p className="text-amber-400 text-[9px] font-black mt-0.5">DEADLINE</p>
                    )}
                    {m.status === "locked" && (
                      <p className="text-orange-400 text-[9px] font-black mt-0.5">LOCKED</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── My active contests ── */}
      {activeEntries.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 text-xs font-black uppercase tracking-wider">My Contests</p>
            <Link href="/contests" className="text-brand text-xs font-bold hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {activeEntries.map((e: any) => {
              const c = e.contest;
              const m = Array.isArray(c?.match) ? c.match[0] : c?.match;
              return (
                <Link key={e.id} href={`/contests/${c.id}`}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 border border-white/6 hover:border-brand/30 transition"
                  style={{ background: "rgba(255,255,255,0.025)" }}>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{c.name}</p>
                    {m && (
                      <p className="text-slate-500 text-xs mt-0.5">
                        {shortTeam(m.team_home)} vs {shortTeam(m.team_away)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {e.rank ? (
                      <>
                        <p className="text-brand font-black text-lg leading-none">#{e.rank}</p>
                        <p className="text-slate-500 text-xs">{e.total_points} pts</p>
                      </>
                    ) : (
                      <p className="text-slate-500 text-xs">{formatCurrency(c.prize_pool)}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Season Leaderboard CTA ── */}
      <div className="px-4 mb-4">
        <Link
          href="/leaderboard"
          className="flex items-center justify-between rounded-2xl px-4 py-4 border border-brand/15 hover:border-brand/30 transition"
          style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.06) 0%, rgba(245,166,35,0.02) 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(245,166,35,0.15)" }}>
              <span className="text-xl">🏆</span>
            </div>
            <div>
              <p className="text-white font-black text-sm">Season Leaderboard</p>
              <p className="text-slate-500 text-xs">IPL 2026 standings</p>
            </div>
          </div>
          <span className="text-brand text-sm font-black">View →</span>
        </Link>
      </div>

      {/* ── Empty state ── */}
      {matches.length === 0 && (
        <div className="text-center py-20 px-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl border border-white/10"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            🏏
          </div>
          <p className="text-white font-black text-lg">No upcoming matches</p>
          <p className="text-slate-500 text-sm mt-1">Schedule will appear once admin syncs</p>
        </div>
      )}
    </div>
  );
}
