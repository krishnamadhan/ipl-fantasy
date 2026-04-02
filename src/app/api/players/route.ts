import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  let query = supabase.from("f11_players").select("*").eq("is_playing", true);

  const team = searchParams.get("team");
  const role = searchParams.get("role");
  const search = searchParams.get("search");
  const creditMin = searchParams.get("credit_min");
  const creditMax = searchParams.get("credit_max");

  if (team) query = query.eq("ipl_team", team);
  if (role) query = query.eq("role", role);
  if (search) query = query.ilike("name", `%${search}%`);
  if (creditMin) query = query.gte("credit_value", Number(creditMin));
  if (creditMax) query = query.lte("credit_value", Number(creditMax));

  query = query.order("credit_value", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
