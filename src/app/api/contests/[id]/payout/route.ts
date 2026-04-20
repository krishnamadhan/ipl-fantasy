import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calcPrizeTiers } from "@/lib/utils/prize-calc";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await createServiceClient();

  const { data: contest } = await service
    .from("f11_contests")
    .select("*")
    .eq("id", id)
    .single();

  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (contest.status !== "completed") return NextResponse.json({ error: "Contest not completed" }, { status: 400 });
  if (contest.winner_paid_at) return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const { data: entries } = await service
    .from("f11_entries")
    .select("id, user_id, rank, total_points, entry_fee_paid")
    .eq("contest_id", id)
    .order("total_points", { ascending: false });

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, message: "No entries" });
  }

  // Use actual collected fees as prize pool for non-guaranteed contests.
  // For guaranteed (platform-subsidized) contests, prize_pool is already set correctly.
  const collected = entries.reduce((s, e) => s + (e.entry_fee_paid ?? 0), 0);
  const actualPrizePool = Math.min(collected, contest.prize_pool);
  const tiers = calcPrizeTiers(actualPrizePool, contest.prize_pool_type, entries.length);

  for (const entry of entries) {
    const rank = entry.rank ?? entries.findIndex((e) => e.id === entry.id) + 1;
    const tier = tiers.find((t) => rank >= t.minRank && rank <= t.maxRank);
    if (!tier || tier.perPlayerAmount <= 0) continue;

    await service.rpc("f11_credit_wallet", {
      p_user_id: entry.user_id,
      p_amount: tier.perPlayerAmount,
      p_reason: `Prize: ${contest.name}`,
      p_reference_id: contest.id,
    });

    await service
      .from("f11_entries")
      .update({ prize_won: tier.perPlayerAmount })
      .eq("id", entry.id);
  }

  await service
    .from("f11_contests")
    .update({ winner_paid_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
