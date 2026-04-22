import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { finalizeMatch } from "@/lib/fantasy/finalize-match";

// Finalizes a match: in_review → completed + auto-pays all contest winners
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Guard: only from in_review
  const { data: match } = await service.from("f11_matches").select("status").eq("id", id).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status !== "in_review") {
    return NextResponse.json({
      error: `Cannot finalize from '${match.status}' — match must be in_review`
    }, { status: 400 });
  }

  const result = await finalizeMatch(id, service);
  if (!result.ok && result.payouts[0]?.error) {
    return NextResponse.json({ error: result.payouts[0].error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, payouts: result.payouts });
}
