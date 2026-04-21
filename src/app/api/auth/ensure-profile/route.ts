/**
 * POST /api/auth/ensure-profile
 * Called after password reset (or any auth flow) to guarantee f11_profiles row exists.
 * Safe to call multiple times — idempotent upsert.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createServiceClient();

  // Check if profile exists
  const { data: existing } = await admin
    .from("f11_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, created: false });

  // Derive username from email
  let username = (user.email ?? "user").split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (username.length < 3) username = `user_${user.id.replace(/-/g, "").slice(0, 8)}`;

  // Insert profile (handle username collision)
  let suffix = 0;
  while (suffix < 10) {
    const u = suffix === 0 ? username : `${username}${suffix}`;
    const { error } = await admin.from("f11_profiles").insert({
      id: user.id,
      username: u,
      display_name: user.user_metadata?.display_name ?? u,
      wallet_balance: 10000,
    });
    if (!error) {
      // Log signup bonus
      await admin.from("f11_transactions").insert({
        user_id: user.id, type: "credit", amount: 10000,
        reason: "Signup bonus (auto-repair)", balance_after: 10000,
      }).then(() => {});
      return NextResponse.json({ ok: true, created: true, username: u });
    }
    suffix++;
  }

  return NextResponse.json({ error: "Could not create profile" }, { status: 500 });
}
