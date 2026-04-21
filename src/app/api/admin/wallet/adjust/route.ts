import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, type, amount, reason } = await req.json();

  if (!user_id || !type || !amount || !reason) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const service = createServiceClient();

  const fn = type === "credit" ? "f11_credit_wallet" : "f11_deduct_wallet";
  const { error } = await service.rpc(fn, {
    p_user_id: user_id,
    p_amount: amount,
    p_reason: `Admin: ${reason}`,
    p_reference_id: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
