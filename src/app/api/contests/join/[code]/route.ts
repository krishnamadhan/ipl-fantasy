import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: contest } = await supabase
    .from("f11_contests")
    .select("*, match:f11_matches(id, team_home, team_away, scheduled_at)")
    .eq("invite_code", code.toUpperCase())
    .eq("status", "open")
    .single();

  if (!contest) return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });

  return NextResponse.json(contest);
}
