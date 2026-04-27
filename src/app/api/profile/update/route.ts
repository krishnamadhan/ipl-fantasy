import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { display_name } = body;

  if (!display_name || typeof display_name !== "string") {
    return NextResponse.json({ error: "display_name is required" }, { status: 400 });
  }

  const trimmed = display_name.trim();
  if (trimmed.length < 2 || trimmed.length > 30) {
    return NextResponse.json({ error: "Name must be 2–30 characters" }, { status: 400 });
  }

  const { error } = await supabase
    .from("f11_profiles")
    .update({ display_name: trimmed })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
