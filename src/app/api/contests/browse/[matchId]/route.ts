import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const admin = await createServiceClient();

  const { data, error } = await supabase
    .from("f11_contests")
    .select("*")
    .eq("match_id", matchId)
    .in("status", ["open", "locked"])
    .not("contest_type", "eq", "private")
    .order("entry_fee", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contests = data ?? [];
  if (contests.length === 0) return NextResponse.json([]);

  // Use service client to get accurate entry counts (bypasses RLS)
  const contestIds = contests.map((c: any) => c.id);
  const { data: entryCounts } = await admin
    .from("f11_entries")
    .select("contest_id")
    .in("contest_id", contestIds);

  const countMap = new Map<string, number>();
  for (const e of entryCounts ?? []) {
    countMap.set(e.contest_id, (countMap.get(e.contest_id) ?? 0) + 1);
  }

  const f11_contests = contests.map((c: any) => ({
    ...c,
    entry_count: countMap.get(c.id) ?? 0,
  }));

  return NextResponse.json(f11_contests);
}
