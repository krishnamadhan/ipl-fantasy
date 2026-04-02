import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [matchRes, squadRes] = await Promise.all([
    supabase.from("f11_matches").select("*").eq("id", id).single(),
    supabase.from("f11_players").select("*").eq("is_playing", true),
  ]);

  if (!matchRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const match = matchRes.data;
  const allPlayers = squadRes.data ?? [];
  const squads = {
    home: allPlayers.filter((p: any) => p.ipl_team === match.team_home),
    away: allPlayers.filter((p: any) => p.ipl_team === match.team_away),
  };

  return NextResponse.json({ match, squads });
}
