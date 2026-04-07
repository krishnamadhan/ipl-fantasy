import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calcPrizeTiers } from "@/lib/utils/prize-calc";

// Finalizes a match: in_review → completed + auto-pays all contest winners
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = await createServiceClient();

  // Guard: only from in_review
  const { data: match } = await service.from("f11_matches").select("status").eq("id", id).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status !== "in_review") {
    return NextResponse.json({
      error: `Cannot finalize from '${match.status}' — match must be in_review`
    }, { status: 400 });
  }

  // Mark match completed
  const { error: matchErr } = await service
    .from("f11_matches")
    .update({ status: "completed" })
    .eq("id", id);
  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });

  // Mark all locked contests completed
  await service
    .from("f11_contests")
    .update({ status: "completed" })
    .eq("match_id", id)
    .eq("status", "locked");

  // Auto-payout: process each completed contest for this match
  const { data: contests } = await service
    .from("f11_contests")
    .select("id, name, prize_pool, prize_pool_type, winner_paid_at")
    .eq("match_id", id)
    .eq("status", "completed");

  const payoutResults: { contestId: string; ok: boolean; paid?: number; error?: string }[] = [];

  for (const contest of contests ?? []) {
    // Skip if already paid (idempotency guard)
    if (contest.winner_paid_at) {
      payoutResults.push({ contestId: contest.id, ok: true, paid: 0 });
      continue;
    }

    try {
      const { data: entries } = await service
        .from("f11_entries")
        .select("id, user_id, rank, total_points")
        .eq("contest_id", contest.id)
        .order("total_points", { ascending: false });

      if (!entries?.length) {
        payoutResults.push({ contestId: contest.id, ok: true, paid: 0 });
        continue;
      }

      const tiers = calcPrizeTiers(contest.prize_pool, contest.prize_pool_type, entries.length);
      let totalPaid = 0;

      for (const entry of entries) {
        const rank = entry.rank ?? (entries.findIndex((e) => e.id === entry.id) + 1);
        const tier = tiers.find((t) => rank >= t.minRank && rank <= t.maxRank);
        if (!tier || tier.perPlayerAmount <= 0) continue;

        const { error: creditErr } = await service.rpc("f11_credit_wallet", {
          p_user_id: entry.user_id,
          p_amount: tier.perPlayerAmount,
          p_reason: `Prize: ${contest.name}`,
          p_reference_id: contest.id,
        });
        if (!creditErr) {
          await service.from("f11_entries").update({ prize_won: tier.perPlayerAmount }).eq("id", entry.id);
          totalPaid += tier.perPlayerAmount;
        }
      }

      // Mark paid to prevent double-payout
      await service
        .from("f11_contests")
        .update({ winner_paid_at: new Date().toISOString() })
        .eq("id", contest.id);

      payoutResults.push({ contestId: contest.id, ok: true, paid: totalPaid });
    } catch (err: any) {
      payoutResults.push({ contestId: contest.id, ok: false, error: err.message });
    }
  }

  // Update season leaderboard — aggregate total_points per user across all completed matches
  try {
    await service.rpc("f11_update_season_leaderboard");
  } catch {
    // Non-fatal — season leaderboard update is best-effort
  }

  return NextResponse.json({ ok: true, payouts: payoutResults });
}
