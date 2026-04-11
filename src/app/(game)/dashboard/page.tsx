import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, shortTeam, TEAM_COLORS } from "@/lib/utils/format";
import type { IplMatch } from "@/types/match";
import CountdownTimer from "@/components/ui/CountdownTimer";
import DashboardLiveCard from "@/components/live/DashboardLiveCard";
import HeroMatchCard from "@/components/matches/HeroMatchCard";

export const revalidate = 30;

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

  const profile      = profileRes.data;
  const matches      = (matchesRes.data ?? []) as IplMatch[];
  const liveMatches  = matches.filter((m) => m.status === "live");
  const nextMatch    = matches.find((m) => m.status !== "live");
  const otherMatches = matches.filter((m) => m.id !== nextMatch?.id && m.status !== "live");
  const firstName    = (profile?.display_name ?? profile?.username ?? "Player").split(" ")[0];

  // Extra data for hero card
  const [heroContestsRes, heroTeamRes, myEntriesRes] = await Promise.all([
    nextMatch
      ? supabase.from("f11_contests").select("id, prize_pool").eq("match_id", nextMatch.id).in("status", ["open", "locked"])
      : Promise.resolve({ data: [] }),
    nextMatch
      ? supabase.from("f11_teams").select("id").eq("match_id", nextMatch.id).eq("user_id", user.id).limit(1)
      : Promise.resolve({ data: [] }),
    (supabase as any)
      .from("f11_entries")
      .select("id, total_points, rank, contest:f11_contests(id, name, status, prize_pool, match:f11_matches(id, team_home, team_away))")
      .eq("user_id", user.id)
      .in("contest.status", ["open", "locked", "live"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const heroContests     = (heroContestsRes as any).data ?? [];
  const heroTeam         = (heroTeamRes as any).data ?? [];
  const activeEntries    = ((myEntriesRes as any).data ?? []).filter((e: any) => e.contest);
  const heroContestCount = heroContests.length;
  const heroTotalPrize   = heroContests.reduce((s: number, c: any) => s + (c.prize_pool ?? 0), 0);
  const hasTeam          = heroTeam.length > 0;

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#0B0E14", minHeight: "100vh" }}>

      {/* ── Greeting ── */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-white font-rajdhani font-bold text-xl leading-tight">
          Hey, {firstName} 👋
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#8A95A8" }}>IPL 2026 · Ready to play?</p>
      </div>

      {/* ── Live banner ── */}
      {liveMatches.length > 0 && <DashboardLiveCard matches={liveMatches as any} />}

      {/* ── Hero match card ── */}
      {nextMatch && (
        <HeroMatchCard
          match={nextMatch as any}
          contestCount={heroContestCount}
          totalPrize={heroTotalPrize}
          hasTeam={hasTeam}
        />
      )}

      {/* ── Other upcoming matches ── */}
      {otherMatches.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#8A95A8" }}>More Matches</p>
            <Link href="/matches" className="text-xs font-bold" style={{ color: "#3FEFB4" }}>View all →</Link>
          </div>
          <div className="space-y-2">
            {otherMatches.slice(0, 3).map((m) => {
              const hc = TEAM_COLORS[shortTeam(m.team_home)] ?? "#475569";
              const ac = TEAM_COLORS[shortTeam(m.team_away)] ?? "#475569";
              return (
                <Link key={m.id} href={`/contests/browse/${m.id}`}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 border hover:border-white/12 transition"
                  style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.06)" }}
                >
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
                    {m.city && <p className="text-xs truncate" style={{ color: "#4A5568" }}>{m.city}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <CountdownTimer targetDate={m.scheduled_at} compact />
                    {m.status === "open"   && <p className="text-[9px] font-black mt-0.5" style={{ color: "#F7A325" }}>DEADLINE</p>}
                    {m.status === "locked" && <p className="text-[9px] font-black mt-0.5" style={{ color: "#4A5568" }}>LOCKED</p>}
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
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#8A95A8" }}>My Contests</p>
            <Link href="/contests" className="text-xs font-bold" style={{ color: "#3FEFB4" }}>View all →</Link>
          </div>
          <div className="space-y-2">
            {activeEntries.map((e: any) => {
              const c = e.contest;
              const m = Array.isArray(c?.match) ? c.match[0] : c?.match;
              return (
                <Link key={e.id} href={`/contests/${c.id}`}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 border transition"
                  style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{c.name}</p>
                    {m && (
                      <p className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
                        {shortTeam(m.team_home)} vs {shortTeam(m.team_away)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {e.rank ? (
                      <>
                        <p className="font-rajdhani font-bold text-lg leading-none" style={{ color: "#3FEFB4" }}>#{e.rank}</p>
                        <p className="text-xs" style={{ color: "#8A95A8" }}>{e.total_points} pts</p>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: "#8A95A8" }}>{formatCurrency(c.prize_pool)}</p>
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
          className="flex items-center justify-between rounded-2xl px-4 py-4 card-press"
          style={{
            background: "rgba(63,239,180,0.04)",
            border:     "1px solid rgba(63,239,180,0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(63,239,180,0.10)" }}>
              <span className="text-xl">🏆</span>
            </div>
            <div>
              <p className="text-white font-black text-sm">Season Leaderboard</p>
              <p className="text-xs" style={{ color: "#8A95A8" }}>IPL 2026 standings</p>
            </div>
          </div>
          <span className="text-xs font-bold" style={{ color: "#3FEFB4" }}>View →</span>
        </Link>
      </div>

      {/* ── Empty state ── */}
      {matches.length === 0 && (
        <div className="text-center py-20 px-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl"
            style={{ background: "#141920", border: "1px solid #252D3D" }}>
            🏏
          </div>
          <p className="text-white font-rajdhani font-bold text-lg">No upcoming matches</p>
          <p className="text-sm mt-1" style={{ color: "#8A95A8" }}>Schedule will appear once admin syncs</p>
        </div>
      )}
    </div>
  );
}
