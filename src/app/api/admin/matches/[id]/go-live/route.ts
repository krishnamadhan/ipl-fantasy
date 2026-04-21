import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use user's own client for admin check — RLS policy allows admin users to read all profiles
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use user's client for reads (public) and writes (RLS: matches_admin_write allows is_admin users)
  const { data: match } = await supabase.from("f11_matches").select("status").eq("id", id).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (!["locked", "open"].includes(match.status)) {
    return NextResponse.json({ error: `Cannot go live from '${match.status}'` }, { status: 400 });
  }

  // Lock contests first if coming from open
  if (match.status === "open") {
    await supabase.from("f11_contests").update({ status: "locked" }).eq("match_id", id).eq("status", "open");
  }

  const { error, count } = await supabase.from("f11_matches").update({ status: "live" }, { count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Update blocked — RLS denied write. Run SQL: UPDATE f11_matches SET status='live' WHERE id='" + id + "';" }, { status: 500 });

  // Service client for non-RLS ops (best-effort, may fail without service key)
  try {
    const service = await createServiceClient();
    await service.from("f11_contests").update({ status: "live" }).eq("match_id", id).in("status", ["open", "locked"]);
  } catch {}

  return NextResponse.json({ ok: true });
}
