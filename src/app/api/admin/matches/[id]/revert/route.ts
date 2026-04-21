import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: match } = await admin.from("f11_matches").select("status").eq("id", matchId).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const revertMap: Record<string, string> = {
    open:       "scheduled",
    locked:     "open",
    live:       "locked",
    in_review:  "live",
    completed:  "in_review",
  };

  const newStatus = revertMap[match.status];
  if (!newStatus) return NextResponse.json({ error: `Cannot revert status: ${match.status}` }, { status: 400 });

  // If reverting from locked/live, re-open contests so joins are possible again
  if (match.status === "locked" || match.status === "live") {
    await admin
      .from("f11_contests")
      .update({ status: "open" })
      .eq("match_id", matchId)
      .eq("status", "locked");
  }

  const { error } = await admin.from("f11_matches").update({ status: newStatus }).eq("id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, previousStatus: match.status, newStatus });
}
