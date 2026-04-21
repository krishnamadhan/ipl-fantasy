import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export interface PrizeTier {
  minRank: number;
  maxRank: number;
  prizeAmount: number;
  label: string;
}

function buildPrizeTiers(
  contestType: string,
  prizePool: number,
  maxTeams: number
): PrizeTier[] {
  const rake = 0.10;
  const net = prizePool * (1 - rake);

  if (contestType === "h2h") {
    return [{ minRank: 1, maxRank: 1, prizeAmount: Math.floor(net), label: "Winner" }];
  }

  // Tier structure: [{ pct of pool, top% winners, label }]
  type TierSpec = { share: number; fromPct: number; toPct: number; label: string };

  let specs: TierSpec[];

  if (maxTeams <= 10) {
    specs = [
      { share: 0.60, fromPct: 0,    toPct: 10,  label: "1st" },
      { share: 0.25, fromPct: 10,   toPct: 20,  label: "2nd" },
      { share: 0.15, fromPct: 20,   toPct: 50,  label: "3rd–5th" },
    ];
  } else if (maxTeams <= 100) {
    specs = [
      { share: 0.40, fromPct: 0,    toPct: 1,   label: "1st" },
      { share: 0.20, fromPct: 1,    toPct: 5,   label: "2nd–5th" },
      { share: 0.20, fromPct: 5,    toPct: 15,  label: "Top 15%" },
      { share: 0.20, fromPct: 15,   toPct: 40,  label: "Top 40%" },
    ];
  } else {
    specs = [
      { share: 0.20, fromPct: 0,    toPct: 1,   label: "Top 1%" },
      { share: 0.20, fromPct: 1,    toPct: 5,   label: "Top 5%" },
      { share: 0.25, fromPct: 5,    toPct: 15,  label: "Top 15%" },
      { share: 0.35, fromPct: 15,   toPct: 50,  label: "Top 50%" },
    ];
  }

  const tiers: PrizeTier[] = [];
  for (const spec of specs) {
    const minRank = Math.max(1, Math.ceil(maxTeams * spec.fromPct / 100));
    const maxRank = Math.max(minRank, Math.floor(maxTeams * spec.toPct / 100));
    const count = maxRank - minRank + 1;
    if (count <= 0) continue;
    const totalForTier = net * spec.share;
    const perWinner = Math.floor(totalForTier / count);
    tiers.push({ minRank, maxRank, prizeAmount: perWinner, label: spec.label });
  }

  return tiers;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  const { data: profile } = await admin.from("f11_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    match_id,
    name,
    contest_type = "small",
    entry_fee,
    max_teams,
    guaranteed_pool = false,
  } = body;

  if (!match_id || !entry_fee || !max_teams) {
    return NextResponse.json({ error: "match_id, entry_fee, max_teams required" }, { status: 400 });
  }

  const prizePool = Number(entry_fee) * Number(max_teams) * 0.9; // 10% rake
  const prizeTiers = buildPrizeTiers(contest_type, prizePool, Number(max_teams));
  const winnersCount = prizeTiers.reduce((s, t) => s + (t.maxRank - t.minRank + 1), 0);

  const { data, error } = await admin.from("f11_contests").insert({
    match_id,
    created_by: user.id,
    name: name || `${contest_type.charAt(0).toUpperCase() + contest_type.slice(1)} Contest`,
    contest_type,
    entry_fee: Number(entry_fee),
    max_teams: Number(max_teams),
    prize_pool: prizePool,
    prize_pool_type: "tiered",
    prize_tiers: prizeTiers,
    guaranteed_pool,
    winners_count: winnersCount,
    status: "open",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contest: data, prizeTiers });
}
