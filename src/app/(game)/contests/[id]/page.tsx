import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ContestDetailClient from "./ContestDetailClient";

export const revalidate = 30;

export default async function ContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const match = contest.match;
  const showTeams = ["live", "in_review", "completed"].includes(match?.status ?? "");

  const [entriesRes, myEntriesRes] = await Promise.all([
    supabase
      .from("f11_entries")
      .select("id, user_id, team_name, total_points, rank, prize_won, captain_id, captain:f11_players!fk_entries_captain(name)")
      .eq("contest_id", id)
      .order("total_points", { ascending: false })
      .limit(100),
    supabase
      .from("f11_entries")
      .select("id, user_id, team_name, total_points, rank, prize_won, captain_id")
      .eq("contest_id", id)
      .eq("user_id", user.id),
  ]);

  return (
    <ContestDetailClient
      contest={contest}
      initialEntries={entriesRes.data ?? []}
      myEntries={myEntriesRes.data ?? []}
      currentUserId={user.id}
      matchStatus={match?.status ?? "scheduled"}
    />
  );
}
