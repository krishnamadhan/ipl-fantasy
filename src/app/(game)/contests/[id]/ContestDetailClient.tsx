"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, shortTeam, cn } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";

type Tab = "leaderboard" | "myteam" | "prizes";

function formatPrize(amount: number): string {
  if (amount >= 1_000_000) return `₹${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `₹${(amount / 1_000).toFixed(0)}K`;
  if (amount > 0)          return `₹${amount}`;
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
  const isLive      = matchStatus === "live";
  const isCompleted = matchStatus === "completed";
  const isInReview  = matchStatus === "in_review";
  const isLocked    = matchStatus === "locked";
  const showTeams   = isLocked || isLive || isCompleted || isInReview;

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
    if (isLive || isInReview) refreshLeaderboard();
  }, [isLive, isInReview, refreshLeaderboard]);

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

  const myEntry  = myEntries[0];
  const tiers: any[] = contest.prize_tiers ?? [];
  const fillPct  = contest.max_teams > 0
    ? Math.min(100, (entries.length / contest.max_teams) * 100) : 0;
  const matchTeamHome = contest.match?.team_home ?? "";
  const matchTeamAway = contest.match?.team_away ?? "";

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-screen" style={{ background: "#0B0E14" }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0" style={{ background: "#141920", borderBottom: "1px solid #252D3D" }}>

        {/* Nav row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#1C2333", border: "1px solid #252D3D" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A95A8" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-white font-rajdhani font-bold text-base leading-tight truncate">{contest.name}</p>
            {matchTeamHome && (
              <p className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
                {shortTeam(matchTeamHome)} vs {shortTeam(matchTeamAway)}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span
            className="text-[10px] font-black uppercase px-3 py-1 rounded-full shrink-0"
            style={
              isLive
                ? { color: "#FF3B3B", background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.30)" }
                : isCompleted
                ? { color: "#21C55D", background: "rgba(33,197,93,0.12)", border: "1px solid rgba(33,197,93,0.30)" }
                : { color: "#3FEFB4", background: "rgba(63,239,180,0.10)", border: "1px solid rgba(63,239,180,0.25)" }
            }
          >
            {isLive && <span className="live-dot mr-1.5" style={{ width: 5, height: 5 }} />}
            {isLive ? "LIVE" : isCompleted ? "DONE" : (contest.status ?? "").toUpperCase()}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          <StatBox
            label="Prize Pool"
            value={formatPrize(
              contest.prize_pool > 0
                ? contest.prize_pool
                : Math.floor(entries.length * contest.entry_fee * 0.9)
            )}
            valueColor="#F7A325"
          />
          <StatBox label="Entry Fee" value={contest.entry_fee === 0 ? "FREE" : formatCurrency(contest.entry_fee)} />
          <StatBox label="Teams" value={`${entries.length}/${contest.max_teams}`} />
        </div>

        {/* Fill bar */}
        <div className="px-4 pb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${fillPct}%`,
                background: fillPct >= 90 ? "#FF3B3B" : fillPct > 70 ? "#F7A325" : "#3FEFB4",
              }}
            />
          </div>
        </div>

        {/* My rank highlight */}
        {myEntry?.rank && (
          <div
            className="mx-4 mb-3 rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(63,239,180,0.08)", border: "1px solid rgba(63,239,180,0.20)" }}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: "#3FEFB4" }}>
                Your Rank
              </p>
              <p className="font-rajdhani font-bold text-3xl leading-none text-white">#{myEntry.rank}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold mb-0.5" style={{ color: "#4A5568" }}>Points</p>
              <p className="font-rajdhani font-bold text-xl text-white">{myEntry.total_points ?? 0}</p>
            </div>
            {myEntry.prize_won > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold mb-0.5" style={{ color: "#4A5568" }}>Won</p>
                <p className="font-rajdhani font-bold text-xl" style={{ color: "#21C55D" }}>
                  {formatCurrency(myEntry.prize_won)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex" style={{ borderTop: "1px solid #252D3D" }}>
          {(["leaderboard", "myteam", "prizes"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors"
                style={{ color: active ? "#3FEFB4" : "#4A5568" }}
              >
                {t === "leaderboard" ? "Leaderboard" : t === "myteam" ? "My Team" : "Prizes"}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: 2, background: "#3FEFB4", borderRadius: "2px 2px 0 0" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {tab === "leaderboard" && (
          <LeaderboardTab
            entries={entries}
            currentUserId={currentUserId}
            showTeams={showTeams}
            isLive={isLive}
            contestId={contest.id}
            winnersCount={contest.winners_count ?? 1}
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
            prizePool={
              contest.prize_pool > 0
                ? contest.prize_pool
                : Math.floor(entries.length * contest.entry_fee * 0.9)
            }
            winnersCount={contest.winners_count ?? 1}
            maxTeams={contest.max_teams}
          />
        )}
      </div>
    </div>
  );
}

function StatBox({
  label, value, valueColor,
}: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-center"
      style={{ background: "#1C2333", border: "1px solid #252D3D" }}
    >
      <p className="font-rajdhani font-bold text-base leading-tight" style={{ color: valueColor ?? "#F0F4FF" }}>
        {value}
      </p>
      <p className="text-[9px] uppercase font-bold mt-0.5" style={{ color: "#4A5568" }}>{label}</p>
    </div>
  );
}

function LeaderboardTab({
  entries, currentUserId, showTeams, isLive, contestId, winnersCount,
}: {
  entries: any[];
  currentUserId: string;
  showTeams: boolean;
  isLive: boolean;
  contestId: string;
  winnersCount: number;
}) {
  if (!showTeams) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4"
          style={{ background: "#141920", border: "1px solid #252D3D" }}
        >
          🔒
        </div>
        <p className="text-white font-rajdhani font-bold text-lg mb-1">Teams Locked</p>
        <p className="text-sm text-center leading-relaxed" style={{ color: "#8A95A8" }}>
          Teams are revealed once the match goes live.
          <br />No peeking! 😄
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-center py-12 text-sm" style={{ color: "#4A5568" }}>No entries yet</p>;
  }

  const hasBonus = entries.some((e) => (e.bonus_points ?? 0) > 0);
  const sorted = hasBonus
    ? [...entries].sort((a, b) =>
        (b.total_points + (b.bonus_points ?? 0)) - (a.total_points + (a.bonus_points ?? 0))
      )
    : entries;

  const myIndex = sorted.findIndex((e) => e.user_id === currentUserId);
  const myRank  = myIndex >= 0 ? (sorted[myIndex].rank ?? myIndex + 1) : null;
  const spotsFromWinning = myRank !== null && myRank > winnersCount ? myRank - winnersCount : 0;

  // grid: rank | team | pts | [bonus] | prize | [compare]
  const cols = showTeams
    ? (hasBonus ? "40px 1fr 52px 44px 64px 28px" : "40px 1fr 56px 68px 28px")
    : (hasBonus ? "40px 1fr 52px 44px 64px"       : "40px 1fr 56px 68px");

  return (
    <div>
      {/* Live indicator */}
      {isLive && (
        <div
          className="flex items-center justify-center gap-2 py-2.5"
          style={{ background: "rgba(255,59,59,0.06)", borderBottom: "1px solid rgba(255,59,59,0.15)" }}
        >
          <span className="live-dot" style={{ width: 6, height: 6 }} />
          <p className="text-xs font-bold" style={{ color: "#FF3B3B" }}>Live · Auto-updating</p>
        </div>
      )}

      {/* My position strip */}
      {myRank !== null && (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            background:   myRank <= winnersCount ? "rgba(33,197,93,0.06)" : "rgba(255,255,255,0.02)",
            borderBottom: `1px solid ${myRank <= winnersCount ? "rgba(33,197,93,0.15)" : "#252D3D"}`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wide"
              style={{ color: myRank <= winnersCount ? "#21C55D" : "#8A95A8" }}>
              Your Rank
            </span>
            <span className="font-rajdhani font-bold text-sm text-white">#{myRank}</span>
          </div>
          {spotsFromWinning > 0 ? (
            <span className="text-[10px]" style={{ color: "#4A5568" }}>
              {spotsFromWinning} spot{spotsFromWinning !== 1 ? "s" : ""} from winning
            </span>
          ) : (
            <span className="text-[10px] font-bold" style={{ color: "#21C55D" }}>In the money 🏆</span>
          )}
        </div>
      )}

      {/* Column headers */}
      <div
        className="grid gap-2 px-4 py-2"
        style={{ gridTemplateColumns: cols, borderBottom: "1px solid #252D3D" }}
      >
        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#4A5568" }}>#</span>
        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#4A5568" }}>Team</span>
        <span className="text-[9px] font-black uppercase tracking-wider text-right" style={{ color: "#4A5568" }}>Pts</span>
        {hasBonus && (
          <span className="text-[9px] font-black uppercase tracking-wider text-right" style={{ color: "#A855F7" }}>📻</span>
        )}
        <span className="text-[9px] font-black uppercase tracking-wider text-right" style={{ color: "#4A5568" }}>Prize</span>
        {showTeams && <div />}
      </div>

      {sorted.map((e, i) => {
        const isMe  = e.user_id === currentUserId;
        const rank  = e.rank ?? i + 1;
        const bonus = e.bonus_points ?? 0;
        const captainName = e.captain?.name ?? null;
        const showCutoff  = winnersCount > 0 && rank === winnersCount + 1;

        const rank1Id = sorted[0]?.user_id ?? "";
        const diffOpponent = isMe
          ? (rank1Id !== currentUserId ? rank1Id : sorted[1]?.user_id ?? "")
          : e.user_id;
        const diffHref = showTeams && sorted.length > 1 && diffOpponent
          ? `/contests/${contestId}/diff?u1=${currentUserId}&u2=${diffOpponent}`
          : null;

        return (
          <div key={e.id}>
            {/* Prize cutoff line */}
            {showCutoff && (
              <div
                className="flex items-center gap-3 px-4 py-2"
                style={{ background: "rgba(255,59,59,0.04)", borderTop: "1px solid rgba(255,59,59,0.15)", borderBottom: "1px solid rgba(255,59,59,0.15)" }}
              >
                <div className="flex-1 h-px" style={{ background: "rgba(255,59,59,0.25)" }} />
                <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "#FF3B3B" }}>
                  Prize cutoff
                </span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,59,59,0.25)" }} />
              </div>
            )}

            <div
              className="grid gap-2 items-center px-4 py-3.5"
              style={{
                gridTemplateColumns: cols,
                background:   isMe ? "rgba(63,239,180,0.06)" : rank <= winnersCount ? "rgba(33,197,93,0.02)" : "transparent",
                borderBottom: "1px solid #252D3D",
                borderLeft:   isMe ? "3px solid #3FEFB4" : "3px solid transparent",
              }}
            >
              {/* Rank */}
              <div>
                {rank === 1 ? <span className="text-xl">🥇</span>
                 : rank === 2 ? <span className="text-xl">🥈</span>
                 : rank === 3 ? <span className="text-xl">🥉</span>
                 : (
                  <span
                    className="font-rajdhani font-bold text-sm"
                    style={{ color: isMe ? "#3FEFB4" : rank <= winnersCount ? "#21C55D" : "#4A5568" }}
                  >
                    {rank}
                  </span>
                )}
              </div>

              {/* Team */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p
                    className="text-sm font-bold truncate"
                    style={{ color: isMe ? "#3FEFB4" : "#F0F4FF" }}
                  >
                    {e.team_name ?? "Team"}
                  </p>
                  {isMe && (
                    <span
                      className="text-[8px] font-black px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: "#3FEFB4", background: "rgba(63,239,180,0.12)" }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                {captainName && (
                  <p className="text-xs truncate mt-0.5" style={{ color: "#4A5568" }}>
                    C: <span style={{ color: "#8A95A8" }}>{captainName}</span>
                  </p>
                )}
              </div>

              {/* Points */}
              <span
                className="text-sm font-rajdhani font-bold text-right tabular-nums"
                style={{ color: isMe ? "#3FEFB4" : "#F0F4FF" }}
              >
                {e.total_points ?? 0}
              </span>

              {/* Solli Adi bonus */}
              {hasBonus && (
                <span
                  className="text-xs font-bold text-right tabular-nums"
                  style={{ color: bonus > 0 ? "#A855F7" : "#1C2333" }}
                >
                  {bonus > 0 ? `+${bonus}` : "—"}
                </span>
              )}

              {/* Prize */}
              <span
                className="text-sm font-bold text-right tabular-nums"
                style={{ color: e.prize_won > 0 ? "#21C55D" : "#252D3D" }}
              >
                {e.prize_won > 0 ? formatPrize(e.prize_won) : "—"}
              </span>

              {/* Compare button */}
              {showTeams && (
                diffHref ? (
                  <Link
                    href={diffHref}
                    className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors active:opacity-70"
                    style={{ background: "rgba(63,239,180,0.08)" }}
                    title="Compare teams"
                  >
                    <span className="text-[11px]" style={{ color: "#3FEFB4" }}>⇄</span>
                  </Link>
                ) : (
                  <div />
                )
              )}
            </div>
          </div>
        );
      })}

      {/* Solli Adi bonus legend */}
      {hasBonus && (
        <div
          className="px-4 py-2.5"
          style={{ background: "rgba(168,85,247,0.06)", borderTop: "1px solid rgba(168,85,247,0.15)" }}
        >
          <p className="text-xs" style={{ color: "#A855F7" }}>
            📻 Solli Adi bonus — earned via over prediction game
          </p>
        </div>
      )}
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
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4"
          style={{ background: "#141920", border: "1px solid #252D3D" }}
        >
          🏏
        </div>
        <p className="text-white font-rajdhani font-bold text-lg mb-1">Not joined</p>
        <p className="text-sm text-center mb-6" style={{ color: "#8A95A8" }}>
          You haven't entered this contest
        </p>
        {matchId && (
          <Link
            href={`/contests/browse/${matchId}`}
            className="font-rajdhani font-bold px-6 py-3 rounded-2xl"
            style={{ background: "#3FEFB4", color: "#0B0E14" }}
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
          className="rounded-2xl p-4"
          style={{ background: "#141920", border: "1px solid #252D3D" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-rajdhani font-bold text-base">{e.team_name ?? "My Team"}</p>
            {e.total_points > 0 && (
              <div className="text-right">
                <p className="font-rajdhani font-bold text-xl" style={{ color: "#3FEFB4" }}>
                  {e.total_points} pts
                </p>
                {e.rank && <p className="text-xs" style={{ color: "#4A5568" }}>Rank #{e.rank}</p>}
              </div>
            )}
          </div>

          {e.prize_won > 0 && (
            <div
              className="rounded-xl px-3 py-2 mb-3 text-center"
              style={{ background: "rgba(33,197,93,0.08)", border: "1px solid rgba(33,197,93,0.20)" }}
            >
              <p className="font-bold" style={{ color: "#21C55D" }}>Won {formatCurrency(e.prize_won)} 🎉</p>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href={`/contests/${contestId}/entry`}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
              style={{ background: "#1C2333", color: "#8A95A8", border: "1px solid #252D3D" }}
            >
              View Breakdown
            </Link>
            {!showTeams && matchId && (
              <Link
                href={`/team-builder/${matchId}`}
                className="flex-1 text-center py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{ color: "#3FEFB4", border: "1px solid rgba(63,239,180,0.30)", background: "rgba(63,239,180,0.06)" }}
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
      {/* Summary card */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{ background: "rgba(247,163,37,0.06)", border: "1px solid rgba(247,163,37,0.20)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm" style={{ color: "#8A95A8" }}>Total Prize Pool</p>
          <p className="font-rajdhani font-black text-3xl leading-none" style={{ color: "#F7A325" }}>
            {formatPrize(prizePool)}
          </p>
        </div>
        {winPct !== null && (
          <p className="text-xs" style={{ color: "#4A5568" }}>
            Top <span className="text-white font-bold">{winPct}%</span> win ·{" "}
            {winnersCount} winner{winnersCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {tiers.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#4A5568" }}>No prize breakdown available</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #252D3D" }}>
          <div
            className="grid grid-cols-[1fr_80px] px-4 py-2 text-[9px] font-black uppercase tracking-wider"
            style={{ background: "#1C2333", borderBottom: "1px solid #252D3D", color: "#4A5568" }}
          >
            <span>Rank</span>
            <span className="text-right">Prize</span>
          </div>

          {tiers.map((t: any, i: number) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_80px] items-center px-4 py-3.5"
              style={{
                background:   i === 0 ? "rgba(33,197,93,0.04)" : "transparent",
                borderBottom: i < tiers.length - 1 ? "1px solid #252D3D" : "none",
              }}
            >
              <div>
                <p className="text-white font-bold text-sm">{t.label}</p>
                {t.maxRank > t.minRank && (
                  <p className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
                    #{t.minRank}–#{t.maxRank} · {t.maxRank - t.minRank + 1} winners
                  </p>
                )}
              </div>
              <p
                className="font-rajdhani font-black text-base text-right"
                style={{ color: i === 0 ? "#21C55D" : "#8A95A8" }}
              >
                {formatPrize(t.prizeAmount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-center mt-6" style={{ color: "#252D3D" }}>
        10% platform fee applied · Prizes per winner in each tier
      </p>
    </div>
  );
}
