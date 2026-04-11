/**
 * GET /api/bot/team-diff?match_id=X&user1=Y&user2=Z
 *
 * Returns a side-by-side team comparison for two players in the group contest.
 * user1 / user2 are matched against f11_profiles.display_name or .username (case-insensitive
 * partial match). Omit both to compare rank-1 vs rank-2 automatically.
 *
 * Response:
 * {
 *   team1: { display_name, rank, captain, vc, players: [...] },
 *   team2: { display_name, rank, captain, vc, players: [...] },
 *   only_in_1: [...],   // players unique to team1
 *   only_in_2: [...],   // players unique to team2
 *   common: [...],      // players in both
 * }
 * Each player: { id, name, ipl_team, role, credit_value, points }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

interface PlayerInfo {
  id: string;
  name: string;
  ipl_team: string;
  role: string;
  credit_value: number;
  points: number;
}

interface TeamInfo {
  display_name: string;
  team_name: string | null;
  rank: number | null;
  captain: PlayerInfo | null;
  vc: PlayerInfo | null;
  players: PlayerInfo[];
}

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  const user1Param = searchParams.get("user1")?.trim() ?? "";
  const user2Param = searchParams.get("user2")?.trim() ?? "";

  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const admin = await createServiceClient();

  // ── Find the group contest ──────────────────────────────────────────────────
  const { data: contest } = await admin
    .from("f11_contests")
    .select("id, status")
    .eq("match_id", match_id)
    .eq("contest_type", "private")
    .is("created_by", null)
    .limit(1)
    .maybeSingle();

  if (!contest) {
    return NextResponse.json({ error: "No group contest found for this match" }, { status: 404 });
  }

  // ── Fetch all entries (with profile + rank) ────────────────────────────────
  const { data: allEntries } = await admin
    .from("f11_entries")
    .select(`
      id, user_id, team_name, player_ids, captain_id, vc_id, total_points, rank,
      profile:f11_profiles!user_id(display_name, username)
    `)
    .eq("contest_id", contest.id)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("total_points", { ascending: false });

  if (!allEntries?.length) {
    return NextResponse.json({ error: "No teams in this contest yet" }, { status: 404 });
  }

  // ── Resolve the two entries ────────────────────────────────────────────────
  function findEntry(nameQuery: string) {
    if (!nameQuery) return null;
    const q = nameQuery.toLowerCase();
    return allEntries!.find((e: any) => {
      const dn = (e.profile?.display_name ?? "").toLowerCase();
      const un = (e.profile?.username ?? "").toLowerCase();
      return dn.includes(q) || un.includes(q);
    }) ?? null;
  }

  let entry1: any = findEntry(user1Param);
  let entry2: any = findEntry(user2Param);

  // Default: top 2 by rank
  if (!entry1 && !entry2) {
    entry1 = allEntries[0] ?? null;
    entry2 = allEntries[1] ?? null;
  } else if (!entry1) {
    // user1 not found — pick top entry that isn't entry2
    entry1 = allEntries.find((e: any) => e.id !== entry2?.id) ?? null;
  } else if (!entry2) {
    // user2 not found — pick top entry that isn't entry1
    entry2 = allEntries.find((e: any) => e.id !== entry1?.id) ?? null;
  }

  if (!entry1 || !entry2) {
    return NextResponse.json({ error: "Could not find two teams to compare" }, { status: 404 });
  }
  if (entry1.id === entry2.id) {
    return NextResponse.json({ error: "Both names matched the same team" }, { status: 400 });
  }

  // ── Batch-fetch all player details ────────────────────────────────────────
  const allPlayerIds: string[] = [...new Set([
    ...(entry1.player_ids as string[]),
    ...(entry2.player_ids as string[]),
  ])];

  const { data: players } = await admin
    .from("f11_players")
    .select("id, name, ipl_team, role, credit_value")
    .in("id", allPlayerIds);

  // Fetch fantasy points for this match
  const { data: stats } = await admin
    .from("f11_player_stats")
    .select("player_id, fantasy_points")
    .eq("match_id", match_id)
    .in("player_id", allPlayerIds);

  const pointsMap = new Map<string, number>(
    (stats ?? []).map((s: any) => [s.player_id, s.fantasy_points ?? 0])
  );

  const playerMap = new Map<string, PlayerInfo>(
    (players ?? []).map((p: any) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        ipl_team: p.ipl_team,
        role: p.role,
        credit_value: Number(p.credit_value),
        points: pointsMap.get(p.id) ?? 0,
      },
    ])
  );

  // ── Build team objects ─────────────────────────────────────────────────────
  function buildTeam(entry: any): TeamInfo {
    const ps = (entry.player_ids as string[]).map((id: string) => playerMap.get(id)).filter(Boolean) as PlayerInfo[];
    return {
      display_name: entry.profile?.display_name ?? entry.profile?.username ?? "Unknown",
      team_name: entry.team_name ?? null,
      rank: entry.rank ?? null,
      captain: playerMap.get(entry.captain_id) ?? null,
      vc: playerMap.get(entry.vc_id) ?? null,
      players: ps,
    };
  }

  const team1 = buildTeam(entry1);
  const team2 = buildTeam(entry2);

  // ── Compute diff ──────────────────────────────────────────────────────────
  const ids1 = new Set(entry1.player_ids as string[]);
  const ids2 = new Set(entry2.player_ids as string[]);

  const only_in_1 = team1.players.filter((p) => !ids2.has(p.id));
  const only_in_2 = team2.players.filter((p) => !ids1.has(p.id));
  const common = team1.players.filter((p) => ids2.has(p.id));

  return NextResponse.json({
    contest_status: contest.status,
    team1,
    team2,
    only_in_1,
    only_in_2,
    common,
  });
}
