import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import TeamBuilderClient from "@/components/team-builder/TeamBuilderClient";
import type { IplPlayer } from "@/types/player";
import type { IplMatch } from "@/types/match";

export default async function TeamBuilderPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = await createServiceClient();

  const [matchRes, playersRes, teamCountRes, matchPlayersRes] = await Promise.all([
    admin.from("f11_matches").select("*").eq("id", matchId).single(),
    admin
      .from("f11_players")
      .select("*")
      .eq("is_playing", true)
      .order("credit_value", { ascending: false }),
    supabase
      .from("f11_teams")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("match_id", matchId),
    admin
      .from("f11_match_players")
      .select("player_id, is_playing_xi")
      .eq("match_id", matchId),
  ]);

  if (!matchRes.data) notFound();

  const match = matchRes.data as IplMatch;
  // Only allow team building when match is in 'open' state
  if (match.status !== "open") {
    redirect(`/matches/${matchId}`);
  }

  const allPlayers = (playersRes.data ?? []) as IplPlayer[];
  const matchPlayers = matchRes.data ? (matchPlayersRes.data ?? []) : [];

  // Build playing XI lookup
  const playingXiMap = new Map<string, boolean>();
  for (const mp of matchPlayers) {
    playingXiMap.set(mp.player_id, mp.is_playing_xi);
  }

  // Compute selection % from entries for this match's contests
  const selectionPctMap = new Map<string, number>();
  const { data: matchContests } = await admin
    .from("f11_contests")
    .select("id")
    .eq("match_id", matchId);
  if (matchContests && matchContests.length > 0) {
    const cIds = matchContests.map((c: any) => c.id);
    const { data: entries } = await admin
      .from("f11_entries")
      .select("player_ids")
      .in("contest_id", cIds);
    const total = entries?.length ?? 0;
    if (total > 0) {
      const counts = new Map<string, number>();
      for (const entry of entries ?? []) {
        for (const pid of (entry.player_ids as string[]) ?? []) {
          counts.set(pid, (counts.get(pid) ?? 0) + 1);
        }
      }
      for (const [pid, cnt] of counts) {
        selectionPctMap.set(pid, Math.round((cnt / total) * 100));
      }
    }
  }

  // Filter to match teams + add playing XI and selection meta
  const matchPlayersList = allPlayers
    .filter((p) => p.ipl_team === match.team_home || p.ipl_team === match.team_away)
    .map((p) => ({
      ...p,
      is_playing_xi: playingXiMap.has(p.id) ? playingXiMap.get(p.id) : undefined,
      selection_pct: selectionPctMap.get(p.id) ?? 0,
    }));

  return (
    <TeamBuilderClient
      match={match}
      players={matchPlayersList}
      userId={user.id}
      existingTeamCount={teamCountRes.count ?? 0}
    />
  );
}
