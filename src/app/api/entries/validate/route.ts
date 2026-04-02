import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateTeam } from "@/lib/fantasy/validate-team";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { player_ids, captain_id, vc_id } = await req.json();

  const { data: players } = await supabase
    .from("f11_players")
    .select("*")
    .in("id", player_ids ?? []);

  const result = validateTeam(players as any ?? [], captain_id ?? null, vc_id ?? null);
  return NextResponse.json(result);
}
