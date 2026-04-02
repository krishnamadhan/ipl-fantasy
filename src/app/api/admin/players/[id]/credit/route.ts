import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const service = await createServiceClient();

  // Get current player
  const { data: player } = await service.from("f11_players").select("*").eq("id", id).single();
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: any = {};
  if (body.credit_value !== undefined) {
    updates.credit_value = body.credit_value;
    updates.credit_override = body.override ?? true;
    updates.updated_at = new Date().toISOString();

    // Log history
    await service.from("f11_credit_history").insert({
      player_id: id,
      old_value: player.credit_value,
      new_value: body.credit_value,
      reason: "Admin override",
      changed_by: user.id,
    });
  }
  if (body.is_playing !== undefined) {
    updates.is_playing = body.is_playing;
  }
  if (body.credit_override !== undefined) {
    updates.credit_override = body.credit_override;
  }

  const { error } = await service.from("f11_players").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
