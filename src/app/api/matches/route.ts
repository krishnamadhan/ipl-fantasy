import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  let query = supabase.from("f11_matches").select("*").order("scheduled_at", { ascending: true });

  const status = searchParams.get("status");
  if (status) {
    const statuses = status.split(",");
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
