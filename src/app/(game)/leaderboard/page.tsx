import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, cn } from "@/lib/utils/format";

export const revalidate = 60;

export default async function SeasonLeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Aggregate per-user: total winnings, total entries, wins (prize_won > 0), total points earned
  // Only count completed contest entries for the season leaderboard
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — Supabase type inference depth limit with nested joins
  const { data: rows } = await supabase
    .from("f11_entries")
    .select(`
      user_id,
      prize_won,
      total_points,
      contest:f11_contests!inner(status)
    `)
    .in("contest.status" as any, ["completed"]);

  // Also fetch entries in open/locked/live contests to count total participations
  const { data: allRows } = await supabase
    .from("f11_entries")
    .select("user_id, total_points, prize_won, contest:f11_contests!inner(status)")
    .in("contest.status" as any, ["completed", "live", "locked", "open"]) as any;

  // Aggregate in JS
  type UserStat = {
    userId: string;
    totalWinnings: number;
    totalPoints: number;
    contests: number;  // completed contests only
    totalContests: number; // all contests (for display)
    wins: number;
  };

  const statMap = new Map<string, UserStat>();
  // First pass: completed contests only (for rankings)
  for (const row of rows ?? []) {
    const uid = row.user_id;
    const prev = statMap.get(uid) ?? { userId: uid, totalWinnings: 0, totalPoints: 0, contests: 0, totalContests: 0, wins: 0 };
    statMap.set(uid, {
      ...prev,
      totalWinnings: prev.totalWinnings + (row.prize_won ?? 0),
      totalPoints: prev.totalPoints + (row.total_points ?? 0),
      contests: prev.contests + 1,
      wins: prev.wins + (row.prize_won > 0 ? 1 : 0),
    });
  }
  // Second pass: all contests for total count
  for (const row of (allRows as any[]) ?? []) {
    const uid = row.user_id;
    if (!statMap.has(uid)) continue; // only show users with completed entries
    const prev = statMap.get(uid)!;
    statMap.set(uid, { ...prev, totalContests: prev.totalContests + 1 });
  }

  if (statMap.size === 0) {
    return (
      <div className="max-w-lg mx-auto pb-24" style={{ background: "#0a0f1e", minHeight: "100vh" }}>
        <div className="px-4 pt-6 pb-3">
          <h1 className="text-white font-black text-xl">Season Leaderboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">IPL 2026</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-white font-bold text-lg">No results yet</p>
          <p className="text-slate-500 text-sm mt-1 text-center">Leaderboard updates after contests complete</p>
        </div>
      </div>
    );
  }

  // Fetch profile names for all users
  const userIds = Array.from(statMap.keys());
  const { data: profiles } = await supabase
    .from("f11_profiles")
    .select("id, username, display_name")
    .in("id", userIds);

  const profileMap = new Map<string, { username: string; display_name: string }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, { username: p.username, display_name: p.display_name });
  }

  // Sort by total points desc (primary), then winnings as tiebreaker
  const sorted = Array.from(statMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.totalWinnings - a.totalWinnings;
  });

  const myRank = sorted.findIndex((s) => s.userId === user.id) + 1;
  const myStat = statMap.get(user.id);

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#0a0f1e", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-white font-black text-xl">Season Leaderboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">IPL 2026 · All contests</p>
      </div>

      {/* My rank card */}
      {myStat && (
        <div className="mx-4 mb-4 rounded-2xl px-4 py-4 border border-brand/30 flex items-center justify-between"
          style={{ background: "rgba(245,166,35,0.06)" }}>
          <div>
            <p className="text-brand text-[10px] font-black uppercase tracking-wider mb-0.5">Your Rank</p>
            <p className="text-white font-black text-4xl leading-none">#{myRank}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold">Pts</p>
            <p className="text-brand font-black text-xl tabular-nums">{myStat.totalPoints.toFixed(0)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold">Played</p>
            <p className="text-white font-black text-xl">{myStat.totalContests}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-[10px] uppercase font-bold">Won</p>
            <p className="text-green-400 font-black text-xl">
              {myStat.totalWinnings > 0 ? formatCurrency(myStat.totalWinnings) : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[36px_1fr_64px_72px] gap-2 px-4 py-2.5 border-b border-slate-800">
        <span className="text-[9px] text-slate-600 font-black uppercase">#</span>
        <span className="text-[9px] text-slate-600 font-black uppercase">Player</span>
        <span className="text-[9px] text-slate-600 font-black uppercase text-right">Pts</span>
        <span className="text-[9px] text-slate-600 font-black uppercase text-right">Winnings</span>
      </div>

      {/* Rows */}
      {sorted.map((s, i) => {
        const rank = i + 1;
        const isMe = s.userId === user.id;
        const p = profileMap.get(s.userId);
        const name = p?.display_name || p?.username || "Player";
        const medals = ["🥇", "🥈", "🥉"];

        return (
          <div key={s.userId}
            className={cn(
              "grid grid-cols-[36px_1fr_64px_72px] gap-2 items-center px-4 py-3.5 border-b border-slate-800/40",
              isMe ? "bg-brand/5" : "hover:bg-slate-800/20"
            )}>
            {/* Rank */}
            <div>
              {rank <= 3 ? (
                <span className="text-base leading-none">{medals[rank - 1]}</span>
              ) : (
                <span className={cn("font-black text-sm", isMe ? "text-brand" : "text-slate-500")}>
                  {rank}
                </span>
              )}
            </div>

            {/* Name */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn("text-sm font-bold truncate", isMe ? "text-brand" : "text-white")}>{name}</p>
                {isMe && (
                  <span className="text-[9px] font-black text-brand/60 bg-brand/10 px-1.5 py-0.5 rounded shrink-0">You</span>
                )}
              </div>
              <p className="text-slate-600 text-xs">
                {s.contests} completed{s.totalContests > s.contests ? ` · ${s.totalContests} total` : ""}
              </p>
            </div>

            {/* Total Points */}
            <span className={cn(
              "text-sm font-black text-right tabular-nums",
              isMe ? "text-brand" : "text-white"
            )}>
              {s.totalPoints > 0 ? s.totalPoints.toFixed(0) : "—"}
            </span>

            {/* Winnings */}
            <span className={cn(
              "text-sm font-bold text-right tabular-nums",
              s.totalWinnings > 0 ? "text-green-400" : "text-slate-700"
            )}>
              {s.totalWinnings > 0 ? formatCurrency(s.totalWinnings) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
