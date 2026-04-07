import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import TeamBuilderClient from "@/components/team-builder/TeamBuilderClient";
import type { IplPlayer } from "@/types/player";
import type { IplMatch } from "@/types/match";

export default async function TeamBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { matchId } = await params;
  const { teamId } = await searchParams;

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
  if (match.status !== "open") redirect(`/matches/${matchId}`);

  const allPlayers = (playersRes.data ?? []) as IplPlayer[];
  const matchPlayers = matchPlayersRes.data ?? [];

  const playingXiMap = new Map<string, boolean>();
  for (const mp of matchPlayers) {
    playingXiMap.set(mp.player_id, mp.is_playing_xi);
  }

  // Normalize for comparison — handles case differences and minor whitespace
  const norm = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const homeNorm = norm(match.team_home);
  const awayNorm = norm(match.team_away);
  const matchPlayersList = allPlayers
    .filter((p) => {
      const t = norm(p.ipl_team);
      return t === homeNorm || t === awayNorm;
    })
    .map((p) => ({
      ...p,
      is_playing_xi: playingXiMap.has(p.id) ? playingXiMap.get(p.id) : undefined,
    }));

  // If editing an existing team, load it and verify ownership
  let editTeam: {
    id: string;
    teamName: string;
    selectedPlayers: IplPlayer[];
    captainId: string;
    vcId: string;
  } | null = null;

  if (teamId) {
    const { data: existingTeam } = await supabase
      .from("f11_teams")
      .select("id, team_name, player_ids, captain_id, vc_id, user_id")
      .eq("id", teamId)
      .eq("user_id", user.id)   // ownership check
      .eq("match_id", matchId)  // safety: must be same match
      .single();

    if (existingTeam) {
      const playerIdSet = new Set<string>(existingTeam.player_ids as string[]);
      editTeam = {
        id: existingTeam.id,
        teamName: existingTeam.team_name,
        selectedPlayers: matchPlayersList.filter((p) => playerIdSet.has(p.id)),
        captainId: existingTeam.captain_id,
        vcId: existingTeam.vc_id,
      };
    }
  }

  return (
    <TeamBuilderClient
      match={match}
      players={matchPlayersList}
      userId={user.id}
      existingTeamCount={teamCountRes.count ?? 0}
      editTeam={editTeam}
    />
  );
}
