// Supabase Edge Function — triggered after match completes
// Runs credit update algorithm for all players who played
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function computeNewCredit(
  currentCredit: number,
  thisMatchPoints: number,
  last5Points: number[],
  selectionPct: number,
  overridden: boolean
): number | null {
  if (overridden) return null;

  const avg = last5Points.length > 0
    ? last5Points.reduce((a, b) => a + b, 0) / last5Points.length
    : thisMatchPoints;

  const delta = thisMatchPoints - avg;

  let creditDelta = 0;
  if (delta >= 20) creditDelta += 0.5;
  else if (delta <= -15) creditDelta -= 0.5;

  if (selectionPct > 60 && delta < 0) creditDelta -= 0.5;
  if (selectionPct < 15 && delta > 0) creditDelta += 0.5;

  const raw = currentCredit + creditDelta;
  const rounded = Math.round(raw * 2) / 2;
  return Math.min(12.0, Math.max(6.0, rounded));
}

Deno.serve(async (req: Request) => {
  const { match_id } = await req.json();
  if (!match_id) {
    return new Response(JSON.stringify({ error: "match_id required" }), { status: 400 });
  }

  const { data: stats } = await supabase
    .from("f11_player_stats")
    .select("player_id, fantasy_points")
    .eq("match_id", match_id);

  if (!stats?.length) {
    return new Response(JSON.stringify({ ok: true, message: "No stats" }));
  }

  // Get total entries for this match to compute selection %
  const { data: matchContests } = await supabase
    .from("f11_contests")
    .select("id")
    .eq("match_id", match_id);
  const contestIds = (matchContests ?? []).map((c: any) => c.id);
  const { count: totalEntries } = await supabase
    .from("f11_entries")
    .select("*", { count: "exact", head: true })
    .in("contest_id", contestIds.length ? contestIds : ["00000000-0000-0000-0000-000000000000"]);

  for (const s of stats) {
    const { data: player } = await supabase
      .from("f11_players")
      .select("credit_value, credit_override")
      .eq("id", s.player_id)
      .single();

    if (!player || player.credit_override) continue;

    // Get last 5 match points
    const { data: last5 } = await supabase
      .from("f11_player_stats")
      .select("fantasy_points")
      .eq("player_id", s.player_id)
      .neq("match_id", match_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const last5Points = (last5 ?? []).map((r: any) => r.fantasy_points);

    // Selection %: how many contest entries include this player
    const { count: playerEntries } = await supabase
      .from("f11_entries")
      .select("*", { count: "exact", head: true })
      .contains("player_ids", [s.player_id]);

    const selectionPct = totalEntries && playerEntries
      ? (playerEntries / totalEntries) * 100
      : 50;

    const newCredit = computeNewCredit(
      player.credit_value,
      s.fantasy_points,
      last5Points,
      selectionPct,
      player.credit_override
    );

    if (newCredit === null || newCredit === player.credit_value) continue;

    // Update credit
    await supabase
      .from("f11_players")
      .update({ credit_value: newCredit, updated_at: new Date().toISOString() })
      .eq("id", s.player_id);

    // Log history
    await supabase.from("f11_credit_history").insert({
      player_id: s.player_id,
      old_value: player.credit_value,
      new_value: newCredit,
      reason: `Post-match update (M${match_id.slice(0, 8)})`,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
