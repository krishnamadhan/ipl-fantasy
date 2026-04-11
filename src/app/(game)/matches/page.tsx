import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { shortTeam } from "@/lib/utils/format";
import MatchesClient from "./MatchesClient";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matches } = await supabase
    .from("f11_matches")
    .select("id, team_home, team_away, venue, city, scheduled_at, status, result_summary, live_score_summary")
    .order("scheduled_at", { ascending: true })
    .limit(40);

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: contestData } = await supabase
    .from("f11_contests")
    .select("match_id, prize_pool, status")
    .in("status", ["open", "locked"])
    .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"]);

  const contestMap: Record<string, { count: number; totalPrize: number }> = {};
  for (const c of contestData ?? []) {
    const prev = contestMap[c.match_id] ?? { count: 0, totalPrize: 0 };
    contestMap[c.match_id] = {
      count:      prev.count + 1,
      totalPrize: prev.totalPrize + (c.prize_pool ?? 0),
    };
  }

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#0B0E14", minHeight: "100vh" }}>
      {/* Page title */}
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-white font-rajdhani font-bold text-2xl leading-none">Matches</h1>
        <p className="text-[#8A95A8] text-xs mt-0.5">IPL 2026 Schedule</p>
      </div>

      <MatchesClient matches={matches ?? []} contestMap={contestMap} />

      {/* Bottom padding so last card clears the nav */}
      <div className="h-4" />
    </div>
  );
}
