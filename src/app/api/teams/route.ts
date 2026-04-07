import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateTeam } from "@/lib/fantasy/validate-team";

// GET /api/teams?matchId=xxx — list user's saved teams for a match
export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("f11_teams")
    .select("*")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/teams — create or update a saved team
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { match_id, player_ids, captain_id, vc_id, team_name, team_id } = body;

  if (!match_id || !player_ids || !captain_id || !vc_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch players + match for validation
  const admin = await createServiceClient();
  const [playersRes, matchRes] = await Promise.all([
    admin.from("f11_players").select("id, role, ipl_team, credit_value").in("id", player_ids),
    admin.from("f11_matches").select("status, team_home, team_away").eq("id", match_id).single(),
  ]);

  const match = matchRes.data;

  // Only allow saves when match is open
  if (!match || match.status !== "open") {
    const reason = !match ? "Match not found" :
      match.status === "locked" ? "Team deadline has passed" :
      match.status === "scheduled" ? "Match is not open yet" :
      "Match has started — teams are locked";
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  const validation = validateTeam(
    (playersRes.data ?? []) as any,
    captain_id,
    vc_id,
    { home: match.team_home, away: match.team_away }
  );
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
  }

  // Max 6 teams per user per match
  let existingTeamCount = 0;
  if (!team_id) {
    const { count } = await supabase
      .from("f11_teams")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("match_id", match_id);

    existingTeamCount = count ?? 0;
    if (existingTeamCount >= 6) {
      return NextResponse.json({ error: "Maximum 6 teams per match" }, { status: 400 });
    }
  }

  // Default team name: "{DisplayName} - Team {N}" so leaderboard shows distinct names
  let defaultName = "My Team";
  if (!team_name) {
    const { data: profile } = await admin
      .from("f11_profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();
    const displayName = profile?.display_name || profile?.username || "Player";
    const teamNum = existingTeamCount + 1;
    defaultName = teamNum === 1 ? `${displayName}'s Team` : `${displayName} - Team ${teamNum}`;
  }

  const payload = {
    user_id: user.id,
    match_id,
    player_ids,
    captain_id,
    vc_id,
    team_name: team_name || defaultName,
    updated_at: new Date().toISOString(),
  };

  if (team_id) {
    // Update existing — verify ownership
    const { data, error } = await supabase
      .from("f11_teams")
      .update(payload)
      .eq("id", team_id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ team: data });
  } else {
    const { data, error } = await supabase
      .from("f11_teams")
      .insert(payload)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ team: data });
  }
}
