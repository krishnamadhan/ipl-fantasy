import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createServiceClient();

  const { data: entries } = await admin
    .from("f11_entries")
    .select("id, user_id, team_name, total_points, rank, previous_rank, prize_won, captain:f11_players!captain_id(name), profile:f11_profiles!user_id(display_name, username)")
    .eq("contest_id", id)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("total_points", { ascending: false })
    .limit(100);

  return NextResponse.json({ entries: entries ?? [] });
}
