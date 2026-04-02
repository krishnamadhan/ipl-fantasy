import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { formatDateTime, shortTeam, formatCurrency } from "@/lib/utils/format";
import AdminMatchDetailClient from "./AdminMatchDetailClient";

export const revalidate = 0;

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const service = await createServiceClient();

  const [matchRes, statsRes, contestsRes, playingXiRes] = await Promise.all([
    service.from("f11_matches").select("*").eq("id", id).single(),
    service
      .from("f11_player_stats")
      .select("*, player:f11_players(name, ipl_team, role)")
      .eq("match_id", id)
      .order("fantasy_points", { ascending: false }),
    service
      .from("f11_contests")
      .select("id, name, contest_type, status, entry_fee, prize_pool, max_teams, winner_paid_at")
      .eq("match_id", id)
      .order("created_at", { ascending: true }),
    service
      .from("f11_match_players")
      .select("player_id, is_playing_xi, player:f11_players(name, ipl_team, role)")
      .eq("match_id", id)
      .order("is_playing_xi", { ascending: false }),
  ]);

  if (!matchRes.data) notFound();

  // Count entries per contest
  const contestIds = (contestsRes.data ?? []).map((c) => c.id);
  const { data: entryCounts } = await service
    .from("f11_entries")
    .select("contest_id")
    .in("contest_id", contestIds);

  const countByContest: Record<string, number> = {};
  for (const e of entryCounts ?? []) {
    countByContest[e.contest_id] = (countByContest[e.contest_id] ?? 0) + 1;
  }

  return (
    <AdminMatchDetailClient
      match={matchRes.data}
      stats={(statsRes.data ?? []) as any[]}
      contests={(contestsRes.data ?? []).map((c) => ({ ...c, entry_count: countByContest[c.id] ?? 0 }))}
      playingXi={(playingXiRes.data ?? []) as any[]}
    />
  );
}
