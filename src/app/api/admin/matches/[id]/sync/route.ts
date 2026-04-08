import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";

function cbHeaders() {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

function mapStatus(state: string, startMs?: number): string {
  const s = state.toLowerCase();
  if (s.includes("complete") || s.includes("won") || s.includes("tied") || s.includes("result")) return "completed";
  if (s.includes("live") || s.includes("progress") || s.includes("in play")) return "live";
  if (startMs) {
    const until = startMs - Date.now();
    if (until > 0 && until <= 4 * 60 * 60 * 1000) return "open";
  }
  return "scheduled";
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json({ error: "RAPIDAPI_KEY not set" }, { status: 500 });
  }

  const service = await createServiceClient();
  const { data: match } = await service
    .from("f11_matches")
    .select("cricapi_match_id, status")
    .eq("id", id)
    .single();

  if (!match?.cricapi_match_id) {
    return NextResponse.json({ error: "Match has no Cricbuzz ID — run Sync Schedule first" }, { status: 400 });
  }

  const res = await fetch(`https://${CB_HOST}/mcenter/v1/${match.cricapi_match_id}`, {
    headers: cbHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `Cricbuzz ${res.status}: ${text.slice(0, 100)}` }, { status: 500 });
  }

  const body = await res.text();
  if (!body || body.trim() === "") {
    return NextResponse.json({ error: "Cricbuzz returned empty response" }, { status: 502 });
  }

  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Cricbuzz returned invalid JSON" }, { status: 502 });
  }

  const mi = data.matchInfo ?? data.matchHeader ?? data;
  const startMs = mi.startTimestamp ?? mi.startDate ?? null;
  const stateStr = mi.state ?? mi.status ?? mi.matchFormat ?? "";

  const updates: Record<string, any> = {
    last_synced_at: new Date().toISOString(),
    raw_api_payload: data,
  };

  // Update status only if match is not manually set to live/completed by admin
  if (match.status !== "live" && match.status !== "completed") {
    updates.status = mapStatus(stateStr, startMs ? Number(startMs) : undefined);
  }

  if (mi.tossResults?.tossWinnerName) {
    updates.toss_winner = mi.tossResults.tossWinnerName;
    // Set toss_detected_at only if not already set (marks when toss was first seen)
    const { data: existing } = await service
      .from("f11_matches")
      .select("toss_detected_at")
      .eq("id", id)
      .single();
    if (!existing?.toss_detected_at) {
      updates.toss_detected_at = new Date().toISOString();
    }
  }
  if (mi.matchWinner) updates.winner = mi.matchWinner;
  if (mi.status) updates.result_summary = mi.status;
  if (mi.venueInfo?.ground) updates.venue = mi.venueInfo.ground;
  if (mi.venueInfo?.city) updates.city = mi.venueInfo.city;

  const { error } = await service.from("f11_matches").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, synced: Object.keys(updates) });
}
