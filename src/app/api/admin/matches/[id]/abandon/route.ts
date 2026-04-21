import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Abandons a match and refunds all contest entry fees
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const { data: match } = await service.from("f11_matches").select("status").eq("id", id).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "completed" || match.status === "abandoned") {
    return NextResponse.json({ error: `Cannot abandon a ${match.status} match` }, { status: 400 });
  }

  // Get all contests for this match with paid entries
  const { data: contests } = await service
    .from("f11_contests")
    .select("id, name, entry_fee")
    .eq("match_id", id)
    .not("status", "eq", "cancelled");

  let totalRefunded = 0;
  const refundErrors: string[] = [];

  for (const contest of contests ?? []) {
    if (contest.entry_fee <= 0) continue;

    // Get all entries that paid
    const { data: entries } = await service
      .from("f11_entries")
      .select("id, user_id, entry_fee_paid")
      .eq("contest_id", contest.id)
      .gt("entry_fee_paid", 0);

    for (const entry of entries ?? []) {
      const { error } = await service.rpc("f11_credit_wallet", {
        p_user_id: entry.user_id,
        p_amount: entry.entry_fee_paid,
        p_reason: `Refund: ${contest.name} (match abandoned)`,
        p_reference_id: contest.id,
      });
      if (error) {
        refundErrors.push(`Entry ${entry.id}: ${error.message}`);
      } else {
        totalRefunded += entry.entry_fee_paid;
      }
    }

    // Mark contest cancelled
    await service.from("f11_contests").update({ status: "cancelled" }).eq("id", contest.id);
  }

  // Mark match abandoned
  await service.from("f11_matches").update({ status: "abandoned" }).eq("id", id);

  return NextResponse.json({
    ok: true,
    totalRefunded,
    errors: refundErrors.length ? refundErrors : undefined,
  });
}
