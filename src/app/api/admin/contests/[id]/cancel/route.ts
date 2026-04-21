import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const { data: contest } = await service.from("f11_contests").select("*").eq("id", id).single();
  if (!contest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contest.status === "cancelled") return NextResponse.json({ error: "Already cancelled" }, { status: 400 });

  // Refund all entry fees
  const { data: entries } = await service
    .from("f11_entries")
    .select("user_id, entry_fee_paid")
    .eq("contest_id", id)
    .gt("entry_fee_paid", 0);

  const errors: string[] = [];
  for (const entry of entries ?? []) {
    const { error } = await service.rpc("f11_credit_wallet", {
      p_user_id: entry.user_id,
      p_amount: entry.entry_fee_paid,
      p_reason: `Refund: ${contest.name} cancelled`,
      p_reference_id: contest.id,
    });
    if (error) errors.push(error.message);
  }

  await service.from("f11_contests").update({ status: "cancelled" }).eq("id", id);

  return NextResponse.json({ ok: true, refunded: (entries ?? []).length, errors });
}
