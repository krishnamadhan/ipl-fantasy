"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/format";

interface Entry {
  id: string;
  user_id: string;
  team_name: string | null;
  total_points: number;
  rank: number | null;
  prize_won: number;
  profile: { username: string; display_name: string | null } | null;
}

export default function Leaderboard({
  contestId,
  initialEntries,
  currentUserId,
  showTeams,
  matchStatus,
}: {
  contestId: string;
  initialEntries: Entry[];
  currentUserId: string;
  showTeams: boolean;
  matchStatus: string;
}) {
  const [entries, setEntries] = useState<Entry[]>(
    [...initialEntries].sort((a, b) => b.total_points - a.total_points)
  );

  useEffect(() => {
    if (matchStatus !== "live") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`leaderboard:${contestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "f11_entries", filter: `contest_id=eq.${contestId}` },
        (payload) => {
          setEntries((prev) => {
            const updated = prev.map((e) =>
              e.id === payload.new.id ? { ...e, ...(payload.new as Partial<Entry>) } : e
            );
            return [...updated].sort((a, b) => b.total_points - a.total_points);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [contestId, matchStatus]);

  if (entries.length === 0) {
    return <p className="text-slate-400 text-center py-8">No entries yet</p>;
  }

  return (
    <div className="bg-surface-card rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[32px_1fr_64px_64px] gap-2 px-4 py-2.5 text-xs text-slate-400 border-b border-slate-700">
        <span>#</span>
        <span>Team</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Prize</span>
      </div>

      {entries.map((entry, i) => {
        const isMe = entry.user_id === currentUserId;
        const rank = entry.rank ?? i + 1;

        return (
          <div
            key={entry.id}
            className={cn(
              "grid grid-cols-[32px_1fr_64px_64px] gap-2 px-4 py-3 border-b border-slate-800 last:border-0 items-center",
              isMe ? "bg-brand/5" : ""
            )}
          >
            <span className={cn(
              "text-sm font-bold",
              rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-slate-400"
            )}>
              {rank}
            </span>
            <div>
              <p className={cn("text-sm font-semibold", isMe ? "text-brand" : "text-white")}>
                {entry.team_name ?? "My Team"}
                {isMe && <span className="text-xs ml-1 text-brand">(you)</span>}
              </p>
              <p className="text-slate-400 text-xs">
                {entry.profile?.display_name ?? entry.profile?.username ?? "—"}
              </p>
            </div>
            <span className="text-white font-bold text-sm text-right">
              {entry.total_points > 0 ? entry.total_points : "–"}
            </span>
            <span className={cn(
              "text-sm text-right font-semibold",
              entry.prize_won > 0 ? "text-green-400" : "text-slate-500"
            )}>
              {entry.prize_won > 0 ? `₹${entry.prize_won}` : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
