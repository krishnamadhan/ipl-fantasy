/**
 * POST /api/admin/bot-contest-refund
 *
 * One-time retroactive fix: finds all bot-created contests (created_by = null)
 * where entry_fee_paid > 0 but prize_pool = 0, and refunds each user's paid amount.
 *
 * Idempotent — skips entries that have already been credited (checked via
 * existing wallet transactions with the contest id as reference).
 *
 * Call once after deploying the entry_fee: 0 fix to make affected users whole.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(_: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("f11_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = await createServiceClient();

  // Find all bot-created contests with prize_pool = 0
  const { data: botContests } = await service
    .from("f11_contests")
    .select("id, name, prize_pool, entry_fee")
    .is("created_by", null)
    .eq("prize_pool", 0);

  if (!botContests?.length) {
    return NextResponse.json({ ok: true, message: "No bot contests found to process", refunded: 0 });
  }

  const results: Array<{ contestId: string; name: string; refunds: number; errors: string[] }> = [];

  for (const contest of botContests) {
    // Find entries that actually paid (entry_fee_paid > 0)
    const { data: paidEntries } = await service
      .from("f11_entries")
      .select("id, user_id, entry_fee_paid")
      .eq("contest_id", contest.id)
      .gt("entry_fee_paid", 0);

    if (!paidEntries?.length) continue;

    // Idempotency: skip users who already received a refund for this contest
    const { data: existingRefunds } = await service
      .from("f11_transactions")
      .select("user_id")
      .eq("reference_id", contest.id)
      .eq("type", "credit")
      .ilike("reason", "Refund:%");

    const alreadyRefunded = new Set((existingRefunds ?? []).map((t: any) => t.user_id));

    const errors: string[] = [];
    let refunds = 0;

    for (const entry of paidEntries) {
      if (alreadyRefunded.has(entry.user_id)) continue;

      const { error } = await service.rpc("f11_credit_wallet", {
        p_user_id: entry.user_id,
        p_amount: entry.entry_fee_paid,
        p_reason: `Refund: ${contest.name} (no prize pool)`,
        p_reference_id: contest.id,
      });

      if (error) {
        errors.push(`user ${entry.user_id}: ${error.message}`);
      } else {
        refunds++;
      }
    }

    results.push({ contestId: contest.id, name: contest.name, refunds, errors });
  }

  const totalRefunds = results.reduce((s, r) => s + r.refunds, 0);
  return NextResponse.json({ ok: true, totalRefunds, contests: results });
}
