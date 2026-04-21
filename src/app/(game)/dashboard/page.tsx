import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, shortTeam, TEAM_COLORS } from "@/lib/utils/format";
import type { IplMatch } from "@/types/match";
import CountdownTimer from "@/components/ui/CountdownTimer";
import DashboardLiveCard from "@/components/live/DashboardLiveCard";
import HeroMatchCard from "@/components/matches/HeroMatchCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, matchesRes] = await Promise.all([
    supabase
      .from("f11_profiles")
      .select("username, display_name, wallet_balance")
      .eq("id", user.id)
      .maybeSingle(),
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

  // Extra data for hero card + active entries + leaderboard preview
  const [heroContestsRes, heroTeamRes, myEntriesRes, lbEntriesRes] = await Promise.all([
    nextMatch
      ? Promise.resolve(supabase.from("f11_contests").select("id, prize_pool").eq("match_id", nextMatch.id).in("status", ["open", "locked"])).catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] }),
    nextMatch
      ? Promise.resolve(
          supabase.from("f11_entries")
            .select("id, contest:f11_contests!inner(match_id)")
            .eq("user_id", user.id)
            .eq("f11_contests.match_id", nextMatch.id)
            .limit(1)
        ).catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] }),
    Promise.resolve(
      (supabase as any)
        .from("f11_entries")
        .select("id, total_points, rank, contest:f11_contests(id, name, status, prize_pool, match:f11_matches!match_id(id, team_home, team_away))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
    ).catch(() => ({ data: [] })),
    // Leaderboard: aggregate completed entries per user
    Promise.resolve(
      (supabase as any)
        .from("f11_entries")
        .select("user_id, total_points, prize_won, contest:f11_contests!inner(status)")
        .limit(500)
    ).catch(() => ({ data: [] })),
  ]);

  const heroContests     = (heroContestsRes as any).data ?? [];
  const heroTeam         = (heroTeamRes as any).data ?? [];
  const allEntries       = ((myEntriesRes as any).data ?? []) as any[];
  const activeEntries    = allEntries.filter(
    (e: any) => e.contest && ["open", "locked", "live"].includes(e.contest.status)
  );
  const heroContestCount = heroContests.length;
  const heroTotalPrize   = heroContests.reduce((s: number, c: any) => s + (c.prize_pool ?? 0), 0);
  const hasTeam          = heroTeam.length > 0;

  // Aggregate leaderboard in JS — top 5 + current user
  const lbRows = (lbEntriesRes as any).data ?? [];
  const lbMap  = new Map<string, { userId: string; totalPoints: number; totalWinnings: number }>();
  for (const row of lbRows) {
    if (!row.user_id) continue;
    const prev = lbMap.get(row.user_id) ?? { userId: row.user_id, totalPoints: 0, totalWinnings: 0 };
    lbMap.set(row.user_id, {
      ...prev,
      totalPoints:    prev.totalPoints + (row.total_points ?? 0),
      totalWinnings:  prev.totalWinnings + (row.prize_won ?? 0),
    });
  }
  const lbSorted = Array.from(lbMap.values())
    .sort((a, b) => b.totalPoints - a.totalPoints || b.totalWinnings - a.totalWinnings);
  const top5    = lbSorted.slice(0, 5);
  const myLbIdx = lbSorted.findIndex((r) => r.userId === user.id);
  // If current user is outside top 5, append them
  if (myLbIdx >= 5) {
    const myRow = lbSorted[myLbIdx];
    if (myRow) top5.push(myRow);
  }

  // Fetch profile names for leaderboard users
  const lbUserIds = [...new Set(top5.map((r) => r.userId).filter(Boolean))];
  const { data: lbProfiles } = lbUserIds.length
    ? await supabase.from("f11_profiles").select("id, username, display_name").in("id", lbUserIds)
    : { data: [] };
  const lbProfileMap = new Map((lbProfiles ?? []).map((p: any) => [p.id, p]));

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

      {/* ── Phase 6: Your Contests — horizontal scroll ── */}
      {activeEntries.length > 0 && (
        <div className="mb-5">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 mb-3">
            <div>
              <p className="text-white font-rajdhani font-bold text-base leading-none">Your Contests</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#8A95A8" }}>Across all active matches</p>
            </div>
            <Link href="/contests" className="text-xs font-bold" style={{ color: "#3FEFB4" }}>View all →</Link>
          </div>

          {/* Horizontal scroll strip */}
          <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar pb-1">
            {activeEntries.map((e: any) => {
              const c = e.contest;
              const m = Array.isArray(c?.match) ? c.match[0] : c?.match;
              const rank = e.rank as number | null;
              const pts  = e.total_points ?? 0;

              // Derive status + colors from rank
              const isWinning  = rank === 1;
              const isSafe     = rank !== null && rank <= 3;
              const isTrailing = rank !== null && rank > 3;
              const noRank     = rank === null;

              const statusLabel = isWinning ? "🏆 Winning" : isSafe ? "✅ Safe" : isTrailing ? "📉 Trailing" : "Joined";
              const statusColor = isWinning ? "#3FEFB4" : isSafe ? "#21C55D" : isTrailing ? "#F7A325" : "#8A95A8";
              const statusBg    = isWinning ? "rgba(63,239,180,0.15)" : isSafe ? "rgba(33,197,93,0.12)" : isTrailing ? "rgba(247,163,37,0.12)" : "rgba(255,255,255,0.05)";
              const leftBorder  = isWinning ? "#3FEFB4" : isSafe ? "#21C55D" : isTrailing ? "#F7A325" : "#252D3D";
              const rankColor   = isWinning ? "#3FEFB4" : isSafe ? "#21C55D" : isTrailing ? "#F7A325" : "#F0F4FF";

              return (
                <Link
                  key={e.id}
                  href={`/contests/${c.id}`}
                  className="shrink-0 flex flex-col justify-between rounded-xl p-3 card-press"
                  style={{
                    minWidth:   208,
                    background: "#141920",
                    border:     "1px solid #252D3D",
                    borderLeft: `3px solid ${leftBorder}`,
                  }}
                >
                  {/* TOP — match + contest name */}
                  <div className="mb-3">
                    {m && (
                      <p className="text-[10px] truncate mb-0.5" style={{ color: "#8A95A8" }}>
                        {shortTeam(m.team_home)} vs {shortTeam(m.team_away)}
                      </p>
                    )}
                    <p className="text-white font-rajdhani font-bold text-sm leading-tight truncate">{c.name}</p>
                  </div>

                  {/* MIDDLE — rank + points */}
                  <div className="mb-3">
                    {noRank ? (
                      <p className="font-rajdhani text-sm" style={{ color: "#8A95A8" }}>Awaiting start</p>
                    ) : (
                      <>
                        <p className="font-rajdhani font-bold text-2xl leading-none" style={{ color: rankColor }}>
                          #{rank}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#8A95A8" }}>{pts} pts</p>
                      </>
                    )}
                  </div>

                  {/* BOTTOM — status chip + View link */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: statusColor, background: statusBg, border: `1px solid ${statusColor}30` }}
                    >
                      {statusLabel}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "#3FEFB4" }}>View →</span>
                  </div>
                </Link>
              );
            })}

            {/* "Join more" end card */}
            <Link
              href="/matches"
              className="shrink-0 flex flex-col items-center justify-center rounded-xl card-press gap-2"
              style={{
                minWidth:   120,
                background: "rgba(63,239,180,0.04)",
                border:     "1px dashed rgba(63,239,180,0.20)",
              }}
            >
              <span className="text-2xl">+</span>
              <span className="text-[10px] font-bold text-center leading-tight" style={{ color: "#3FEFB4" }}>
                Join More
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Season Leaderboard Preview ── */}
      {top5.length > 0 && (
        <div className="px-4 mb-4">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-rajdhani font-bold text-base leading-none">Season Standings</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#8A95A8" }}>IPL 2026 leaderboard</p>
            </div>
            <Link href="/leaderboard" className="text-xs font-bold" style={{ color: "#3FEFB4" }}>View all →</Link>
          </div>

          {/* Leaderboard rows */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#141920", border: "1px solid #252D3D" }}
          >
            {top5.map((row, idx) => {
              const isMe    = row.userId === user.id;
              const rank    = lbSorted.findIndex((r) => r.userId === row.userId) + 1;
              const p       = lbProfileMap.get(row.userId) as any;
              const name    = p?.display_name ?? p?.username ?? "Player";
              const initial = name.charAt(0).toUpperCase();
              const medalColor = rank === 1 ? "#F7A325" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7C3A" : null;

              return (
                <div
                  key={row.userId}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    background:   isMe ? "#1C2333" : "transparent",
                    borderLeft:   isMe ? "3px solid #3FEFB4" : "3px solid transparent",
                    borderBottom: idx < top5.length - 1 ? "1px solid #252D3D" : "none",
                  }}
                >
                  {/* Rank */}
                  <div className="w-6 text-center shrink-0">
                    {medalColor ? (
                      <span className="font-rajdhani font-bold text-sm" style={{ color: medalColor }}>
                        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                      </span>
                    ) : (
                      <span className="font-rajdhani font-bold text-sm" style={{ color: "#4A5568" }}>
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-rajdhani font-bold text-sm shrink-0"
                    style={{
                      background: isMe ? "rgba(63,239,180,0.15)" : "rgba(255,255,255,0.06)",
                      color:      isMe ? "#3FEFB4" : "#F0F4FF",
                      border:     isMe ? "1.5px solid #3FEFB4" : "1.5px solid #252D3D",
                    }}
                  >
                    {initial}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm truncate leading-none"
                      style={{ color: isMe ? "#3FEFB4" : "#F0F4FF" }}
                    >
                      {name}{isMe && <span className="text-[10px] font-normal ml-1" style={{ color: "#8A95A8" }}>(you)</span>}
                    </p>
                    {row.totalWinnings > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#F7A325" }}>
                        ₹{row.totalWinnings.toLocaleString("en-IN")} won
                      </p>
                    )}
                  </div>

                  {/* Points */}
                  <p className="font-rajdhani font-bold text-sm shrink-0" style={{ color: isMe ? "#3FEFB4" : "#F0F4FF" }}>
                    {row.totalPoints.toFixed(1)} <span className="text-[10px] font-normal" style={{ color: "#4A5568" }}>pts</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard CTA (shown when no data yet) */}
      {top5.length === 0 && (
        <div className="px-4 mb-4">
          <Link
            href="/leaderboard"
            className="flex items-center justify-between rounded-2xl px-4 py-4 card-press"
            style={{ background: "rgba(63,239,180,0.04)", border: "1px solid rgba(63,239,180,0.15)" }}
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
      )}

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
