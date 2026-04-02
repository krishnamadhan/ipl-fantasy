import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Redirect to the real sync-squads Next.js route (no edge functions)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Forward to the real sync-squads handler
  const origin = req.nextUrl.origin;
  const res = await fetch(`${origin}/api/admin/sync-squads`, {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
