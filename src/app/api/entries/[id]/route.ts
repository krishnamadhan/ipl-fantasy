import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Update captain/vc before match locks
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { captain_id, vc_id } = await req.json();

  // Check entry belongs to user
  const { data: entry } = await supabase
    .from("f11_entries")
    .select("*, contest:f11_contests(status, match:f11_matches(status))")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const matchStatus = entry.contest?.match?.status;
  if (matchStatus === "live" || matchStatus === "completed") {
    return NextResponse.json({ error: "Match already started" }, { status: 400 });
  }

  const ids = entry.player_ids;
  if (captain_id && !ids.includes(captain_id)) {
    return NextResponse.json({ error: "Captain must be in your team" }, { status: 400 });
  }
  if (vc_id && !ids.includes(vc_id)) {
    return NextResponse.json({ error: "VC must be in your team" }, { status: 400 });
  }

  const updates: any = {};
  if (captain_id) updates.captain_id = captain_id;
  if (vc_id) updates.vc_id = vc_id;

  const { error } = await supabase
    .from("f11_entries")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
