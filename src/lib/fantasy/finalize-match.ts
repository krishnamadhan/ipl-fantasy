import type { SupabaseClient } from "@supabase/supabase-js";
import { calcPrizeTiers } from "@/lib/utils/prize-calc";

export interface FinalizeResult {
  ok: boolean;
  matchId: string;
  payouts: { contestId: string; ok: boolean; paid?: number; error?: string; creditErrors?: string[] }[];
}

/**
 * Finalizes a match: moves in_review → completed, pays out all contest winners,
 * and updates the season leaderboard. Uses service role — no admin session required.
 */
export async function finalizeMatch(matchId: string, service: SupabaseClient): Promise<FinalizeResult> {
  const payouts: FinalizeResult["payouts"] = [];

  const { error: matchErr } = await service
    .from("f11_matches")
    .update({ status: "completed" })
    .eq("id", matchId);
  if (matchErr) return { ok: false, matchId, payouts: [{ contestId: "match", ok: false, error: matchErr.message }] };

  await service
    .from("f11_contests")
    .update({ status: "completed" })
    .eq("match_id", matchId)
    .eq("status", "locked");

  const { data: contests } = await service
    .from("f11_contests")
    .select("id, name, prize_pool, prize_pool_type, winner_paid_at")
    .eq("match_id", matchId)
    .eq("status", "completed");

  for (const contest of contests ?? []) {
    if (contest.winner_paid_at) {
      payouts.push({ contestId: contest.id, ok: true, paid: 0 });
      continue;
    }

    try {
      await service.rpc("f11_update_leaderboard", { p_match_id: matchId });

      const { data: entries } = await service
        .from("f11_entries")
        .select("id, user_id, rank, total_points")
        .eq("contest_id", contest.id)
        .order("total_points", { ascending: false });

      if (!entries?.length) {
        payouts.push({ contestId: contest.id, ok: true, paid: 0 });
        continue;
      }

      if (contest.prize_pool <= 0) {
        const { data: paidEntries } = await service
          .from("f11_entries")
          .select("id, user_id, entry_fee_paid")
          .eq("contest_id", contest.id)
          .gt("entry_fee_paid", 0);

        const refundErrors: string[] = [];
        let totalRefunded = 0;
        for (const pe of paidEntries ?? []) {
          const { error: refErr } = await service.rpc("f11_credit_wallet", {
            p_user_id: pe.user_id,
            p_amount: pe.entry_fee_paid,
            p_reason: `Refund: ${contest.name} (no prize pool configured)`,
            p_reference_id: contest.id,
          });
          if (refErr) refundErrors.push(`user ${pe.user_id}: ${refErr.message}`);
          else totalRefunded += pe.entry_fee_paid;
        }
        if (refundErrors.length === 0) {
          await service.from("f11_contests").update({ winner_paid_at: new Date().toISOString() }).eq("id", contest.id);
        }
        payouts.push({ contestId: contest.id, ok: refundErrors.length === 0, paid: 0, creditErrors: refundErrors.length > 0 ? refundErrors : undefined });
        continue;
      }

      const tiers = calcPrizeTiers(contest.prize_pool, contest.prize_pool_type, entries.length);
      let totalPaid = 0;
      const creditErrors: string[] = [];

      for (const entry of entries) {
        const rank = entry.rank ?? (entries.findIndex((e: any) => e.id === entry.id) + 1);
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
        } else {
          creditErrors.push(`user ${entry.user_id} rank ${rank}: ${creditErr.message}`);
        }
      }

      if (creditErrors.length === 0) {
        await service.from("f11_contests").update({ winner_paid_at: new Date().toISOString() }).eq("id", contest.id);
        payouts.push({ contestId: contest.id, ok: true, paid: totalPaid });
      } else {
        payouts.push({ contestId: contest.id, ok: false, paid: totalPaid, creditErrors });
      }
    } catch (err: any) {
      payouts.push({ contestId: contest.id, ok: false, error: err.message });
    }
  }

  try {
    await service.rpc("f11_update_season_leaderboard");
  } catch {
    // non-fatal
  }

  return { ok: true, matchId, payouts };
}
