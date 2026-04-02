import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: history } = await supabase
    .from("f11_credit_history")
    .select("*, player:f11_players(name, ipl_team, role, credit_value)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!history) return NextResponse.json([]);

  // Aggregate delta per player
  const deltaMap: Record<string, { player: any; delta: number }> = {};
  for (const h of history) {
    if (!h.player_id) continue;
    if (!deltaMap[h.player_id]) {
      deltaMap[h.player_id] = { player: h.player, delta: 0 };
    }
    deltaMap[h.player_id].delta += h.new_value - h.old_value;
  }

  const sorted = Object.values(deltaMap).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return NextResponse.json({
    gainers: sorted.filter((x) => x.delta > 0).slice(0, 5),
    losers: sorted.filter((x) => x.delta < 0).slice(0, 5),
  });
}
