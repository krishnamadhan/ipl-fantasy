import { createClient } from "@/lib/supabase/server";
import PlayerGrid from "@/components/players/PlayerGrid";
import Link from "next/link";
import type { IplPlayer } from "@/types/player";

export const revalidate = 300;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; team?: string; search?: string }>;
}) {
  const { role, team, search } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("f11_players")
    .select("*")
    .eq("is_playing", true)
    .order("credit_value", { ascending: false });

  if (role) query = query.eq("role", role);
  if (team) query = query.eq("ipl_team", team);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data: players } = await query;

  // Get unique teams for filter
  const teams = [...new Set((players ?? []).map((p) => p.ipl_team))].sort();

  // Role counts
  const all = players ?? [];
  const roleCounts = {
    WK: all.filter((p) => p.role === "WK").length,
    BAT: all.filter((p) => p.role === "BAT").length,
    AR: all.filter((p) => p.role === "AR").length,
    BOWL: all.filter((p) => p.role === "BOWL").length,
  };

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>
      <div className="px-4 pt-6 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-white font-black text-xl">IPL Players</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {all.length} players · {roleCounts.WK}WK · {roleCounts.BAT}BAT · {roleCounts.AR}AR · {roleCounts.BOWL}BOWL
          </p>
        </div>
        <Link
          href="/players/trending"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-500/25 text-orange-400 text-xs font-black hover:bg-orange-500/8 transition shrink-0"
          style={{ background: "rgba(251,146,60,0.06)" }}
        >
          🔥 Trending
        </Link>
      </div>
      <PlayerGrid players={all as IplPlayer[]} teams={teams} />
    </div>
  );
}
