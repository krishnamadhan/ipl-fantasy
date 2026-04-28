import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Fetch entry + contest in one shot
  const { data: entry } = await service
    .from("f11_entries")
    .select("id, user_id, contest_id, entry_fee_paid, contest:f11_contests(status, match:f11_matches(status))")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const contestStatus = (entry.contest as any)?.status;
  const matchStatus   = (entry.contest as any)?.match?.status;

  if (contestStatus !== "open" || matchStatus !== "open") {
    return NextResponse.json({ error: "Cannot leave after deadline has passed" }, { status: 400 });
  }

  // Delete the entry first
  const { error: deleteErr } = await service
    .from("f11_entries")
    .delete()
    .eq("id", entryId);

  if (deleteErr) return NextResponse.json({ error: "Failed to leave contest" }, { status: 500 });

  // Refund entry fee if applicable
  if ((entry.entry_fee_paid ?? 0) > 0) {
    const { error: refundErr } = await service.rpc("f11_credit_wallet", {
      p_user_id: user.id,
      p_amount:  entry.entry_fee_paid,
      p_reason:  "Refund: left contest",
      p_reference_id: entry.contest_id,
    });
    if (refundErr) {
      console.error("[leave] refund failed:", refundErr.message);
    }
  }

  return NextResponse.json({ ok: true });
}
