import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("f11_contests")
    .select("*, entry_count:f11_entries(count)")
    .eq("match_id", matchId)
    .eq("status", "open")
    .not("contest_type", "eq", "private")
    .order("entry_fee", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const f11_contests = (data ?? []).map((c: any) => ({
    ...c,
    entry_count: c.entry_count?.[0]?.count ?? 0,
  }));

  return NextResponse.json(f11_contests);
}
