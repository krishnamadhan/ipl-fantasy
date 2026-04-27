/**
 * GET /api/bot/team-view?match_id=X&user=Y
 *
 * Returns a single user's full fantasy team for the group contest.
 * `user` is matched against f11_profiles.display_name or .username (case-insensitive
 * partial/prefix match, same logic as team-diff).
 *
 * Response:
 * {
 *   display_name, team_name, rank, total_points,
 *   captain: PlayerInfo,
 *   vc: PlayerInfo,
 *   players: PlayerInfo[],   // all 11, sorted by role
 *   contest_status: string,
 * }
 * Each PlayerInfo: { id, name, ipl_team, role, credit_value, points, is_captain, is_vc }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { botAuth, unauthorized } from "../_lib/auth";

const ROLE_ORDER: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };

export async function GET(req: NextRequest) {
  if (!botAuth(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const match_id = searchParams.get("match_id");
  const userParam = searchParams.get("user")?.trim() ?? "";

  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });
  if (!userParam) return NextResponse.json({ error: "user required" }, { status: 400 });

  const admin = createServiceClient();

  // ── Find the group contest ─────────────────────────────────────────────────
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

  // ── Fetch all entries ──────────────────────────────────────────────────────
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

  // ── Find the requested user's entry ───────────────────────────────────────
  const q = userParam.toLowerCase();

  const entry =
    allEntries.find((e: any) => {
      const dn = (e.profile?.display_name ?? "").toLowerCase();
      const un = (e.profile?.username ?? "").toLowerCase();
      return (
        dn.startsWith(q) ||
        un.startsWith(q) ||
        dn.split(/[\s_]+/).some((w: string) => w.startsWith(q)) ||
        un.split(/[\s_]+/).some((w: string) => w.startsWith(q))
      );
    }) ??
    allEntries.find((e: any) => {
      const dn = (e.profile?.display_name ?? "").toLowerCase();
      const un = (e.profile?.username ?? "").toLowerCase();
      return dn.includes(q) || un.includes(q);
    }) ??
    null;

  if (!entry) {
    const names = allEntries
      .map((e: any) => e.profile?.display_name ?? e.profile?.username ?? "?")
      .join(", ");
    return NextResponse.json(
      { error: `"${userParam}" not found. Teams in contest: ${names}` },
      { status: 404 }
    );
  }

  // ── Fetch player details + fantasy points ──────────────────────────────────
  const playerIds: string[] = entry.player_ids as string[];

  const [{ data: players }, { data: stats }] = await Promise.all([
    admin.from("f11_players").select("id, name, ipl_team, role, credit_value").in("id", playerIds),
    admin
      .from("f11_player_stats")
      .select("player_id, fantasy_points")
      .eq("match_id", match_id)
      .in("player_id", playerIds),
  ]);

  const pointsMap = new Map<string, number>(
    (stats ?? []).map((s: any) => [s.player_id, s.fantasy_points ?? 0])
  );

  const playerMap = new Map(
    (players ?? []).map((p: any) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        ipl_team: p.ipl_team,
        role: p.role,
        credit_value: Number(p.credit_value),
        points: pointsMap.get(p.id) ?? 0,
        is_captain: p.id === entry.captain_id,
        is_vc: p.id === entry.vc_id,
      },
    ])
  );

  const teamPlayers = playerIds
    .map((id) => playerMap.get(id))
    .filter(Boolean)
    .sort((a: any, b: any) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)) as any[];

  const profile = entry.profile as any;

  return NextResponse.json({
    contest_status: contest.status,
    display_name: profile?.display_name ?? profile?.username ?? "Unknown",
    team_name: entry.team_name ?? null,
    rank: entry.rank ?? null,
    total_points: entry.total_points ?? 0,
    captain: playerMap.get(entry.captain_id) ?? null,
    vc: playerMap.get(entry.vc_id) ?? null,
    players: teamPlayers,
  });
}
