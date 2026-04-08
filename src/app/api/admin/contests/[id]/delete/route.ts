import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: contest } = await service.from("f11_contests").select("id, name, status").eq("id", id).single();
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  // Only allow deleting completed or cancelled contests — not active ones
  if (["open", "locked", "live"].includes(contest.status)) {
    return NextResponse.json(
      { error: "Cannot delete an active contest. Cancel it first." },
      { status: 400 }
    );
  }

  // Delete entries first (cascade may not be set up), then the contest
  await service.from("f11_entries").delete().eq("contest_id", id);
  const { error } = await service.from("f11_contests").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: contest.name });
}
