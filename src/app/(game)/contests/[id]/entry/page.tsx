import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { cn } from "@/lib/utils/format";
import type { IplPlayer, PlayerMatchStats } from "@/types/player";

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

  const matchStatus = contest.match?.status;
  let statsMap: Record<string, PlayerMatchStats> = {};

  if (matchStatus === "live" || matchStatus === "completed" || matchStatus === "in_review") {
    const { data: stats } = await supabase
      .from("f11_player_stats")
      .select("*")
      .eq("match_id", contest.match_id)
      .in("player_id", entry.player_ids);

    for (const s of stats ?? []) {
      statsMap[s.player_id] = s as PlayerMatchStats;
    }
  }

  const playersById: Record<string, IplPlayer> = {};
  for (const p of players ?? []) playersById[p.id] = p as IplPlayer;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-white mb-1">{entry.team_name ?? "My Team"}</h1>
      <p className="text-slate-400 text-sm mb-4">
        Total: <span className="text-brand font-bold">{entry.total_points} pts</span>
      </p>

      <div className="space-y-2">
        {entry.player_ids.map((pid: string) => {
          const p = playersById[pid];
          if (!p) return null;
          const s = statsMap[pid];
          const isCap = entry.captain_id === pid;
          const isVC = entry.vc_id === pid;
          const basePoints = s?.fantasy_points ?? 0;
          const multiplier = isCap ? 2 : isVC ? 1.5 : 1;
          const finalPoints = basePoints * multiplier;

          return (
            <div key={pid} className={cn(
              "bg-surface-card rounded-xl p-3 border flex items-center gap-3",
              isCap ? "border-brand/40" : isVC ? "border-slate-500" : "border-slate-700"
            )}>
              <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-base shrink-0">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                  {isCap && <span className="bg-brand text-white text-xs px-1.5 py-0.5 rounded font-bold">C</span>}
                  {isVC && <span className="bg-slate-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">VC</span>}
                </div>
                <p className="text-slate-400 text-xs">{p.role} · {p.ipl_team}</p>
                {s && (
                  <p className="text-slate-300 text-xs mt-0.5">
                    {s.runs > 0 && `${s.runs}r`}
                    {s.wickets > 0 && ` ${s.wickets}wkt`}
                    {s.catches > 0 && ` ${s.catches}ct`}
                    {isCap && ` (2× = ${finalPoints})`}
                    {isVC && ` (1.5× = ${finalPoints})`}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-brand font-bold">{finalPoints > 0 ? finalPoints.toFixed(1) : "–"}</p>
                <p className="text-slate-500 text-xs">pts</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
