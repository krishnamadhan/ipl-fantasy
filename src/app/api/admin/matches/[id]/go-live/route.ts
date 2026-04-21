import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Allow transition from 'locked' or 'open' (open can happen if cron missed the auto-lock)
  const { data: match } = await service.from("f11_matches").select("status").eq("id", id).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (!["locked", "open"].includes(match.status)) {
    return NextResponse.json({
      error: `Cannot go live from '${match.status}'`
    }, { status: 400 });
  }

  // Lock contests first if coming from open
  if (match.status === "open") {
    await service.from("f11_contests").update({ status: "locked" }).eq("match_id", id).eq("status", "open");
  }

  const { error } = await service.from("f11_matches").update({ status: "live" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
