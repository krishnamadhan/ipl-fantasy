import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import TeamBuilderClient from "@/components/team-builder/TeamBuilderClient";
import type { IplPlayer } from "@/types/player";
import type { IplMatch } from "@/types/match";

export const dynamic = "force-dynamic";

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

  const admin = createServiceClient();

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

  // Find each team's last completed match (to show "last match" stats, not player's global last)
  const [homeLastMatchRes, awayLastMatchRes] = await Promise.all([
    admin
      .from("f11_matches")
      .select("id")
      .eq("status", "completed")
      .or(`team_home.eq.${match.team_home},team_away.eq.${match.team_home}`)
      .neq("id", matchId)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("f11_matches")
      .select("id")
      .eq("status", "completed")
      .or(`team_home.eq.${match.team_away},team_away.eq.${match.team_away}`)
      .neq("id", matchId)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const homeLastMatchId = homeLastMatchRes.data?.id ?? null;
  const awayLastMatchId = awayLastMatchRes.data?.id ?? null;

  // Fetch stats only from those two matches
  const lastMatchIds = [...new Set([homeLastMatchId, awayLastMatchId].filter(Boolean))] as string[];
  let rawStats: any[] = [];
  if (lastMatchIds.length > 0) {
    const { data } = await admin
      .from("f11_player_stats")
      .select("player_id, runs, wickets, catches, stumpings, fantasy_points, match_id")
      .in("match_id", lastMatchIds);
    rawStats = data ?? [];
  }

  // Build stats map: played=true for players with stats, played=false for bench players
  const lastStatsMap = new Map<string, { runs: number; wickets: number; catches: number; fantasy_points: number; played: boolean }>();
  for (const s of rawStats) {
    lastStatsMap.set(s.player_id, {
      runs: s.runs ?? 0,
      wickets: s.wickets ?? 0,
      catches: (s.catches ?? 0) + (s.stumpings ?? 0),
      fantasy_points: s.fantasy_points ?? 0,
      played: true,
    });
  }
  // Mark bench players (team had a last match, but player has no stats entry)
  for (const p of allPlayers) {
    if (lastStatsMap.has(p.id)) continue;
    const t = norm(p.ipl_team);
    const teamLastMatchId = t === homeNorm ? homeLastMatchId : t === awayNorm ? awayLastMatchId : null;
    if (teamLastMatchId) {
      lastStatsMap.set(p.id, { runs: 0, wickets: 0, catches: 0, fantasy_points: 0, played: false });
    }
  }
  const matchPlayersList = allPlayers
    .filter((p) => {
      const t = norm(p.ipl_team);
      return t === homeNorm || t === awayNorm;
    })
    .map((p) => ({
      ...p,
      is_playing_xi: playingXiMap.has(p.id) ? playingXiMap.get(p.id) : undefined,
      last_match_stats: lastStatsMap.get(p.id) ?? null,
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
