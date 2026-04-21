import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens team creation (scheduled → open) OR force-locks (open → locked)
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: match } = await supabase.from("f11_matches").select("status").eq("id", id).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  if (match.status === "scheduled") {
    const { error } = await supabase.from("f11_matches").update({ status: "open" }).eq("id", id).eq("status", "scheduled");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("f11_contests").update({ status: "open" }).eq("match_id", id).eq("status", "scheduled");
    return NextResponse.json({ ok: true, transition: "scheduled→open" });
  }

  if (match.status === "open") {
    const { error } = await supabase.from("f11_matches").update({ status: "locked" }).eq("id", id).eq("status", "open");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("f11_contests").update({ status: "locked" }).eq("match_id", id).eq("status", "open");
    return NextResponse.json({ ok: true, transition: "open→locked" });
  }

  return NextResponse.json({ error: `Cannot lock from '${match.status}'` }, { status: 400 });
}
