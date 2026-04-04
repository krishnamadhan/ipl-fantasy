import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

async function cbGet(path: string) {
  const res = await fetch(`https://${CB_HOST}${path}`, { headers: cbHeaders() });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

/** GET /api/admin/debug-cricbuzz?cricId=149695
 *  Dumps raw Cricbuzz responses for debugging playing XI parsing. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await createServiceClient();
  const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cricId = req.nextUrl.searchParams.get("cricId");
  if (!cricId) return NextResponse.json({ error: "cricId param required" }, { status: 400 });

  const [mcenter, scard, comm] = await Promise.all([
    cbGet(`/mcenter/v1/${cricId}`),
    cbGet(`/mcenter/v1/${cricId}/scard`),
    cbGet(`/mcenter/v1/${cricId}/comm`),
  ]);

  // Surface the keys at each level to understand the structure without flooding the response
  function topKeys(obj: any, depth = 2): any {
    if (depth === 0 || typeof obj !== "object" || obj === null) return typeof obj;
    if (Array.isArray(obj)) return `Array(${obj.length}) → ${topKeys(obj[0], depth - 1)}`;
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, topKeys(v, depth - 1)])
    );
  }

  return NextResponse.json({
    cricId,
    mcenter: {
      status: mcenter.status,
      keys: topKeys(mcenter.data, 3),
      // Include raw Players / playing11 paths if they exist
      Players: (mcenter.data as any)?.Players,
      players: (mcenter.data as any)?.players,
      matchInfo_teams: {
        team1: (mcenter.data as any)?.matchInfo?.team1,
        team2: (mcenter.data as any)?.matchInfo?.team2,
      },
    },
    scard: {
      status: scard.status,
      keys: topKeys(scard.data, 2),
      scoreCard_length: Array.isArray((scard.data as any)?.scoreCard) ? (scard.data as any).scoreCard.length : null,
    },
    comm: {
      status: comm.status,
      keys: topKeys(comm.data, 2),
    },
  });
}
