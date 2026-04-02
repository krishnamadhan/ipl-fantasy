import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [playerRes, statsRes, historyRes] = await Promise.all([
    supabase.from("f11_players").select("*").eq("id", id).single(),
    supabase
      .from("f11_player_stats")
      .select("*, match:f11_matches(team_home, team_away, scheduled_at)")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("f11_credit_history")
      .select("*")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!playerRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    player: playerRes.data,
    stats: statsRes.data ?? [],
    creditHistory: historyRes.data ?? [],
  });
}
