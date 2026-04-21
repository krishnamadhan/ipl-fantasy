import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, shortTeam } from "@/lib/utils/format";
import ContestBrowseClient from "./ContestBrowseClient";

export const dynamic = "force-dynamic";

export default async function BrowseContestsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [matchRes, contestsRes, teamsRes] = await Promise.all([
    supabase.from("f11_matches").select("*").eq("id", matchId).maybeSingle(),
    supabase
      .from("f11_contests")
      .select("*")
      .eq("match_id", matchId)
      .in("status", ["open", "locked"])
      .order("entry_fee", { ascending: true }),
    supabase
      .from("f11_teams")
      .select("id, team_name, captain_id, vc_id, player_ids")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .order("created_at", { ascending: true }),
  ]);

  if (!matchRes.data) notFound();

  const match = matchRes.data;
  const rawContests = contestsRes.data ?? [];

  // Fetch entry counts using service client to bypass RLS.
  // User-session client only sees own entries in open/locked matches (RLS policy),
  // so counts would always return 1. Service client sees all entries.
  const contestIds = rawContests.map((c: any) => c.id);
  const entryCounts: Record<string, number> = {};
  if (contestIds.length > 0) {
    const admin = createServiceClient();
    const { data: entryRows } = await admin
      .from("f11_entries")
      .select("contest_id")
      .in("contest_id", contestIds);
    for (const row of entryRows ?? []) {
      entryCounts[row.contest_id] = (entryCounts[row.contest_id] ?? 0) + 1;
    }
  }

  const contests = rawContests.map((c: any) => ({
    ...c,
    entry_count: entryCounts[c.id] ?? 0,
  }));
  const rawTeams = teamsRes.data ?? [];

  // Fetch captain/vc names separately (no FK constraint on these columns)
  const playerIds = [...new Set(rawTeams.flatMap((t: any) => [t.captain_id, t.vc_id]).filter(Boolean))];
  const { data: playerNames } = playerIds.length > 0
    ? await supabase.from("f11_players").select("id, name").in("id", playerIds)
    : { data: [] };
  const playerMap = Object.fromEntries((playerNames ?? []).map((p: any) => [p.id, p]));
  const myTeams = rawTeams.map((t: any) => ({
    ...t,
    captain: playerMap[t.captain_id] ?? null,
    vc: playerMap[t.vc_id] ?? null,
  }));

  // Fetch user's existing entries for all contests in this match
  const { data: myEntries } = contestIds.length > 0
    ? await supabase
        .from("f11_entries")
        .select("id, contest_id, team_id, team_name")
        .eq("user_id", user.id)
        .in("contest_id", contestIds)
    : { data: [] };

  return (
    <ContestBrowseClient
      match={match}
      contests={contests}
      myTeams={myTeams}
      myEntries={myEntries ?? []}
      userId={user.id}
    />
  );
}
