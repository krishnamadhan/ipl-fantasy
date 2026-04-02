import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateTeam } from "@/lib/fantasy/validate-team";

// DELETE /api/teams/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Can't delete if it's tied to a locked/completed contest entry
  const { data: entry } = await supabase
    .from("f11_entries")
    .select("id, contest:f11_contests(status)")
    .eq("team_id", id)
    .maybeSingle();

  if (entry) {
    const status = (entry.contest as any)?.status;
    if (status === "locked" || status === "completed") {
      return NextResponse.json({ error: "Cannot delete a team that's in a locked contest" }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("f11_teams")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
