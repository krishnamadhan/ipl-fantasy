"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/format";

interface Entry {
  id: string;
  user_id: string;
  team_name: string;
  total_points: number;
  rank: number | null;
  previous_rank: number | null;
  prize_won: number;
  profile?: { display_name: string | null; username: string | null } | null;
}

function RankDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (!current || !previous || current === previous) {
    return <span className="text-slate-600 text-[10px] font-bold">—</span>;
  }
  const diff = previous - current; // positive = moved up
  if (diff > 0) return <span className="text-green-400 text-[10px] font-black">↑{diff}</span>;
  return <span className="text-red-400 text-[10px] font-black">↓{Math.abs(diff)}</span>;
}

export default function LiveLeaderboard({
  contestId,
  initialEntries,
  currentUserId,
  isLive,
}: {
  contestId: string;
  initialEntries: Entry[];
  currentUserId: string;
  isLive: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const channelRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch {}
  }, [contestId]);

  useEffect(() => {
    if (!isLive) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`live-lb:${contestId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "f11_entries", filter: `contest_id=eq.${contestId}`,
      }, () => refresh())
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [isLive, contestId, refresh]);

  const sorted = [...entries].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  return (
    <div className="space-y-1.5">
      {sorted.map((e, i) => {
        const isMe = e.user_id === currentUserId;
        const displayName =
          (Array.isArray(e.profile) ? e.profile[0] : e.profile)?.display_name
          ?? (Array.isArray(e.profile) ? e.profile[0] : e.profile)?.username
          ?? "Player";
        const rank = e.rank ?? i + 1;

        return (
          <div
            key={e.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition",
              isMe
                ? "border-brand/20"
                : "border-white/5"
            )}
            style={{
              background: isMe ? "rgba(245,166,35,0.05)" : "#111827",
            }}
          >
            {/* Rank */}
            <div className="w-8 text-center shrink-0">
              {rank <= 3 ? (
                <span className="text-base">{["🥇","🥈","🥉"][rank - 1]}</span>
              ) : (
                <span className="text-slate-500 text-sm font-black tabular-nums">{rank}</span>
              )}
            </div>

            {/* Name + team */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn("text-sm font-bold truncate", isMe ? "text-brand" : "text-white")}>
                  {isMe ? "You" : displayName}
                </p>
                {isMe && <span className="text-[9px] bg-brand/20 text-brand px-1.5 py-0.5 rounded font-black">YOU</span>}
              </div>
              <p className="text-slate-600 text-xs truncate">{e.team_name}</p>
            </div>

            {/* Rank delta */}
            <div className="text-center w-6 shrink-0">
              <RankDelta current={e.rank} previous={e.previous_rank} />
            </div>

            {/* Points */}
            <div className="text-right shrink-0">
              <p className={cn("font-black text-sm tabular-nums", isMe ? "text-brand" : "text-white")}>
                {e.total_points > 0 ? e.total_points.toFixed(1) : "—"}
              </p>
              <p className="text-slate-600 text-[9px]">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
