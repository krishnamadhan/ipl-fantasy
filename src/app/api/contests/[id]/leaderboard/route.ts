import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("f11_entries")
    .select("id, user_id, team_name, total_points, rank, previous_rank, prize_won, profile:f11_profiles!user_id(display_name, username)")
    .eq("contest_id", id)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("total_points", { ascending: false })
    .limit(100);

  return NextResponse.json({ entries: entries ?? [] });
}
