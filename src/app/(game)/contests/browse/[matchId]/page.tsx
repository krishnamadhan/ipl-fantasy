import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, shortTeam } from "@/lib/utils/format";
import ContestBrowseClient from "./ContestBrowseClient";

export const revalidate = 10;

export default async function BrowseContestsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [matchRes, contestsRes, teamsRes] = await Promise.all([
    supabase.from("f11_matches").select("*").eq("id", matchId).single(),
    supabase
      .from("f11_contests")
      .select("*, entry_count:f11_entries(count)")
      .eq("match_id", matchId)
      .eq("status", "open")
      .order("entry_fee", { ascending: true }),
    supabase
      .from("f11_teams")
      .select("id, team_name, captain_id, vc_id, player_ids, captain:f11_players!captain_id(name), vc:f11_players!vc_id(name)")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .order("created_at", { ascending: true }),
  ]);

  if (!matchRes.data) notFound();

  const match = matchRes.data;
  const contests = (contestsRes.data ?? []).map((c: any) => ({
    ...c,
    entry_count: c.entry_count?.[0]?.count ?? 0,
  }));
  const myTeams = teamsRes.data ?? [];

  return (
    <ContestBrowseClient
      match={match}
      contests={contests}
      myTeams={myTeams}
      userId={user.id}
    />
  );
}
