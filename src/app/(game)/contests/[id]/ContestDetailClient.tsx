"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, shortTeam, cn } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";

type Tab = "leaderboard" | "myteam" | "prizes";

function formatPrize(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M pts`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}K pts`;
  if (amount > 0)          return `${amount} pts`;
  return "—";
}

export default function ContestDetailClient({
  contest,
  initialEntries,
  myEntries,
  currentUserId,
  matchStatus,
}: {
  contest: any;
  initialEntries: any[];
  myEntries: any[];
  currentUserId: string;
  matchStatus: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [entries, setEntries] = useState(initialEntries);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const isLive = matchStatus === "live";
  const isCompleted = matchStatus === "completed";
  const isInReview = matchStatus === "in_review";
  const showTeams = isLive || isCompleted || isInReview;

  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/contests/${contest.id}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch {}
  }, [contest.id]);

  useEffect(() => {
    if (!isLive && !isInReview) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`leaderboard:${contest.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "f11_entries", filter: `contest_id=eq.${contest.id}`,
      }, () => refreshLeaderboard())
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [isLive, isInReview, contest.id, refreshLeaderboard]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(refreshLeaderboard, 60_000);
    return () => clearInterval(id);
  }, [isLive, refreshLeaderboard]);

  const myEntry = myEntries[0];
  const tiers: any[] = contest.prize_tiers ?? [];
  const fillPct = contest.max_teams > 0
    ? Math.min(100, (entries.length / contest.max_teams) * 100)
    : 0;

  const matchTeamHome = contest.match?.team_home ?? "";
  const matchTeamAway = contest.match?.team_away ?? "";

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-screen" style={{ background: "#080d1a" }}>

      {/* ── Header ── */}
      <div
        className="border-b flex-shrink-0"
        style={{
          background: "linear-gradient(180deg, #0f1e35 0%, #0a1520 100%)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        {/* Nav row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-white/10"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight truncate">{contest.name}</p>
            {matchTeamHome && (
              <p className="text-slate-500 text-xs">
                {shortTeam(matchTeamHome)} vs {shortTeam(matchTeamAway)}
              </p>
            )}
          </div>

          <span
            className={cn(
              "text-[10px] font-black uppercase px-3 py-1 rounded-full border shrink-0",
              isLive
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : isCompleted
                ? "bg-green-500/15 border-green-500/30 text-green-400"
                : "bg-brand/15 border-brand/30 text-brand"
            )}
          >
            {isLive && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 animate-pulse align-middle" />
            )}
            {isLive ? "LIVE" : isCompleted ? "DONE" : contest.status?.toUpperCase()}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          <StatBox label="Prize Pool" value={formatPrize(contest.prize_pool)} accent />
          <StatBox label="Entry Fee" value={contest.entry_fee === 0 ? "FREE" : formatCurrency(contest.entry_fee)} />
          <StatBox label="Teams" value={`${entries.length}/${contest.max_teams}`} />
        </div>

        {/* Fill bar */}
        <div className="px-4 pb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${fillPct}%`, background: "linear-gradient(90deg, #F5A623, #E8950F)" }}
            />
          </div>
        </div>

        {/* My rank highlight */}
        {myEntry?.rank && (
          <div
            className="mx-4 mb-3 rounded-2xl px-4 py-3 border border-brand/25 flex items-center justify-between"
            style={{ background: "rgba(245,166,35,0.07)" }}
          >
            <div>
              <p className="text-brand text-[10px] font-black uppercase tracking-wider">Your Rank</p>
              <p className="text-white font-black text-3xl leading-none">#{myEntry.rank}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500 text-[10px] uppercase font-bold">Points</p>
              <p className="text-white font-black text-xl">{myEntry.total_points ?? 0}</p>
            </div>
            {myEntry.prize_won > 0 && (
              <div className="text-right">
                <p className="text-slate-500 text-[10px] uppercase font-bold">Won</p>
                <p className="text-green-400 font-black text-xl">{formatCurrency(myEntry.prize_won)}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {(["leaderboard", "myteam", "prizes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2",
                tab === t ? "text-brand border-brand" : "text-slate-600 border-transparent hover:text-slate-400"
              )}
            >
              {t === "leaderboard" ? "Leaderboard" : t === "myteam" ? "My Team" : "Prizes"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {tab === "leaderboard" && (
          <LeaderboardTab
            entries={entries}
            currentUserId={currentUserId}
            showTeams={showTeams}
            isLive={isLive}
            contestId={contest.id}
          />
        )}
        {tab === "myteam" && (
          <MyTeamTab
            myEntries={myEntries}
            contestId={contest.id}
            showTeams={showTeams}
            matchId={contest.match?.id}
          />
        )}
        {tab === "prizes" && (
          <PrizesTab
            tiers={tiers}
            prizePool={contest.prize_pool}
            winnersCount={contest.winners_count ?? 1}
            maxTeams={contest.max_teams}
          />
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl px-3 py-2.5 text-center border"
      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <p className={cn("font-black text-base leading-tight", accent ? "text-brand" : "text-white")}>
        {value}
      </p>
      <p className="text-slate-600 text-[9px] uppercase font-bold mt-0.5">{label}</p>
    </div>
  );
}

function LeaderboardTab({
  entries, currentUserId, showTeams, isLive, contestId,
}: {
  entries: any[];
  currentUserId: string;
  showTeams: boolean;
  isLive: boolean;
  contestId: string;
}) {
  if (!showTeams) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4 border border-white/10"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          🔒
        </div>
        <p className="text-white font-black text-lg mb-1">Teams Locked</p>
        <p className="text-slate-500 text-sm text-center leading-relaxed">
          Teams are revealed once the match goes live.
          <br />No peeking! 😄
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-center text-slate-500 py-12 text-sm">No entries yet</p>;
  }

  return (
    <div>
      {isLive && (
        <div
          className="flex items-center justify-center gap-2 py-2.5 border-b"
          style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.15)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <p className="text-red-400 text-xs font-bold">Live · Auto-updating</p>
        </div>
      )}

      {/* Column headers */}
      <div
        className="grid grid-cols-[40px_1fr_56px_68px] gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <span className="text-[9px] text-slate-600 font-black uppercase">#</span>
        <span className="text-[9px] text-slate-600 font-black uppercase">Team</span>
        <span className="text-[9px] text-slate-600 font-black uppercase text-right">Pts</span>
        <span className="text-[9px] text-slate-600 font-black uppercase text-right">Prize</span>
      </div>

      {entries.map((e, i) => {
        const isMe = e.user_id === currentUserId;
        const rank = e.rank ?? i + 1;
        const captainName = e.captain_name ?? null;

        return (
          <div
            key={e.id}
            className={cn(
              "grid grid-cols-[40px_1fr_56px_68px] gap-2 items-center px-4 py-3.5 border-b transition",
              isMe
                ? "bg-brand/5 border-brand/10"
                : "hover:bg-white/[0.02]"
            )}
            style={{ borderColor: isMe ? undefined : "rgba(255,255,255,0.04)" }}
          >
            {/* Rank */}
            <div>
              {rank === 1 ? <span className="text-xl">🥇</span>
               : rank === 2 ? <span className="text-xl">🥈</span>
               : rank === 3 ? <span className="text-xl">🥉</span>
               : (
                <span className={cn("font-black text-sm", isMe ? "text-brand" : "text-slate-500")}>
                  {rank}
                </span>
              )}
            </div>

            {/* Team */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn("text-sm font-bold truncate", isMe ? "text-brand" : "text-white")}>
                  {e.team_name ?? "Team"}
                </p>
                {isMe && (
                  <span className="text-[8px] font-black text-brand/70 bg-brand/10 px-1.5 py-0.5 rounded shrink-0">
                    YOU
                  </span>
                )}
              </div>
              {captainName && (
                <p className="text-slate-500 text-xs truncate mt-0.5">
                  C: <span className="text-slate-400">{captainName}</span>
                </p>
              )}
            </div>

            {/* Points */}
            <span className={cn("text-sm font-black text-right tabular-nums", isMe ? "text-brand" : "text-white")}>
              {e.total_points ?? 0}
            </span>

            {/* Prize */}
            <span className={cn("text-sm text-right font-bold tabular-nums",
              e.prize_won > 0 ? "text-green-400" : "text-slate-700"
            )}>
              {e.prize_won > 0 ? formatPrize(e.prize_won) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MyTeamTab({
  myEntries, contestId, showTeams, matchId,
}: {
  myEntries: any[];
  contestId: string;
  showTeams: boolean;
  matchId?: string;
}) {
  if (myEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4 border border-white/10"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          🏏
        </div>
        <p className="text-white font-black text-lg mb-1">Not joined</p>
        <p className="text-slate-500 text-sm text-center mb-6">You haven't entered this contest</p>
        {matchId && (
          <Link
            href={`/contests/browse/${matchId}`}
            className="text-white font-black px-6 py-3 rounded-2xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, #F5A623, #E8950F)",
              boxShadow: "0 4px 16px rgba(245,166,35,0.35)",
            }}
          >
            Join Contest →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {myEntries.map((e: any) => (
        <div
          key={e.id}
          className="rounded-2xl border p-4"
          style={{ background: "#111827", borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-black text-base">{e.team_name ?? "My Team"}</p>
            {e.total_points > 0 && (
              <div className="text-right">
                <p className="text-brand font-black text-xl">{e.total_points} pts</p>
                {e.rank && <p className="text-slate-500 text-xs">Rank #{e.rank}</p>}
              </div>
            )}
          </div>

          {e.prize_won > 0 && (
            <div
              className="rounded-xl px-3 py-2 mb-3 text-center border border-green-500/20"
              style={{ background: "rgba(34,197,94,0.08)" }}
            >
              <p className="text-green-400 font-black">Won {formatCurrency(e.prize_won)} 🎉</p>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href={`/contests/${contestId}/entry`}
              className="flex-1 text-center py-2.5 rounded-xl border text-slate-300 text-sm font-bold hover:border-slate-500 transition"
              style={{ borderColor: "rgba(255,255,255,0.10)" }}
            >
              View Breakdown
            </Link>
            {!showTeams && (
              <Link
                href={`/team-builder/${e.match_id}`}
                className="flex-1 text-center py-2.5 rounded-xl border border-brand/30 text-brand text-sm font-bold hover:bg-brand/5 transition"
              >
                Edit Team
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrizesTab({
  tiers, prizePool, winnersCount, maxTeams,
}: {
  tiers: any[];
  prizePool: number;
  winnersCount: number;
  maxTeams: number;
}) {
  const winPct = maxTeams > 0 ? Math.round((winnersCount / maxTeams) * 100) : null;

  return (
    <div className="p-4">
      <div
        className="rounded-2xl p-4 mb-4 border border-brand/20"
        style={{ background: "rgba(245,166,35,0.06)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-400 text-sm">Total Prize Pool</p>
          <p className="text-brand font-black text-3xl leading-none">{formatPrize(prizePool)}</p>
        </div>
        {winPct !== null && (
          <p className="text-slate-500 text-xs">
            Top <span className="text-white font-bold">{winPct}%</span> win ·{" "}
            {winnersCount} winner{winnersCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {tiers.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No prize breakdown available</p>
      ) : (
        <div>
          <div
            className="grid grid-cols-[1fr_80px] px-4 py-2 text-[9px] text-slate-600 font-black uppercase tracking-wider border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span>Rank</span>
            <span className="text-right">Prize</span>
          </div>

          {tiers.map((t: any, i: number) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_80px] items-center px-4 py-3.5 border-b"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}
            >
              <div>
                <p className="text-white font-bold text-sm">{t.label}</p>
                {t.maxRank > t.minRank && (
                  <p className="text-slate-500 text-xs">
                    #{t.minRank}–#{t.maxRank} · {t.maxRank - t.minRank + 1} winners
                  </p>
                )}
              </div>
              <p
                className="font-black text-base text-right"
                style={{ color: i === 0 ? "#22C55E" : "#94A3B8" }}
              >
                {formatPrize(t.prizeAmount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-slate-700 text-xs text-center mt-6">
        10% platform fee applied · Prizes per winner in each tier
      </p>
    </div>
  );
}
