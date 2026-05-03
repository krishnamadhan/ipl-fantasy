import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ContestDetailClient from "./ContestDetailClient";

export const dynamic = "force-dynamic";

export default async function ContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceClient();

  const { data: contest } = await admin
    .from("f11_contests")
    .select("*, match:f11_matches(*)")
    .eq("id", id)
    .single();

  if (!contest) notFound();

  const match = contest.match;
  const showTeams = ["locked", "live", "in_review", "completed"].includes(match?.status ?? "");

  const [entriesRes, myEntriesRes] = await Promise.all([
    admin
      .from("f11_entries")
      .select("id, user_id, team_name, total_points, rank, prize_won")
      .eq("contest_id", id)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("total_points", { ascending: false })
      .limit(100),
    admin
      .from("f11_entries")
      .select("id, user_id, team_name, total_points, rank, prize_won")
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
