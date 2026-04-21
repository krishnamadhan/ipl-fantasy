import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { contest_id, team_id } = body;

  if (!contest_id || !team_id) {
    return NextResponse.json({ error: "contest_id and team_id required" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Verify team belongs to user
  const { data: team } = await service
    .from("f11_teams")
    .select("id, user_id, match_id, player_ids, captain_id, vc_id, team_name")
    .eq("id", team_id)
    .single();

  if (!team || team.user_id !== user.id) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get contest + entry count
  const { data: contest } = await service
    .from("f11_contests")
    .select("id, name, status, entry_fee, max_teams, match_id, prize_pool")
    .eq("id", contest_id)
    .single();

  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (contest.status !== "open") return NextResponse.json({ error: "Contest is not open" }, { status: 400 });

  // Verify match is still open for entries
  const { data: contestMatch } = await service
    .from("f11_matches")
    .select("status")
    .eq("id", contest.match_id)
    .single();

  if (contestMatch?.status !== "open") {
    return NextResponse.json({ error: "Team deadline has passed — entries are closed" }, { status: 400 });
  }

  // Verify team is for the same match
  if (team.match_id !== contest.match_id) {
    return NextResponse.json({ error: "Team is for a different match" }, { status: 400 });
  }

  // Check spots (non-atomic — a race can overfill by 1 in rare cases;
  // the f11_entries unique constraint on (contest_id, team_id) is the hard guard)
  const { count: entryCount } = await service
    .from("f11_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contest_id);

  if ((entryCount ?? 0) >= contest.max_teams) {
    return NextResponse.json({ error: "Contest is full" }, { status: 400 });
  }

  // Check per-user entry count for this contest (max 3 teams)
  const MAX_TEAMS_PER_CONTEST = 3;
  const { count: userEntryCount } = await service
    .from("f11_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contest_id)
    .eq("user_id", user.id);

  if ((userEntryCount ?? 0) >= MAX_TEAMS_PER_CONTEST) {
    return NextResponse.json(
      { error: `Maximum ${MAX_TEAMS_PER_CONTEST} teams per contest` },
      { status: 400 }
    );
  }

  // Check this specific team hasn't already joined this contest
  const { data: existing } = await service
    .from("f11_entries")
    .select("id")
    .eq("contest_id", contest_id)
    .eq("team_id", team_id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "This team has already joined this contest" }, { status: 400 });

  // Deduct wallet
  if (contest.entry_fee > 0) {
    const { error: deductErr } = await service.rpc("f11_deduct_wallet", {
      p_user_id: user.id,
      p_amount: contest.entry_fee,
      p_reason: `Entry: ${contest.name}`,
      p_reference_id: contest_id,
    });
    if (deductErr) {
      return NextResponse.json({ error: deductErr.message ?? "Insufficient balance" }, { status: 400 });
    }
  }

  // Create entry
  const { data: entry, error: entryErr } = await service
    .from("f11_entries")
    .insert({
      contest_id,
      user_id: user.id,
      team_id,
      player_ids: team.player_ids,
      captain_id: team.captain_id,
      vc_id: team.vc_id,
      team_name: team.team_name,
      entry_fee_paid: contest.entry_fee,
    })
    .select()
    .single();

  if (entryErr) {
    // Refund the wallet — retry up to 3 times to ensure no silent money loss.
    if (contest.entry_fee > 0) {
      let refunded = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: refundErr } = await service.rpc("f11_credit_wallet", {
          p_user_id: user.id,
          p_amount: contest.entry_fee,
          p_reason: "Refund: entry failed",
          p_reference_id: contest_id,
        });
        if (!refundErr) { refunded = true; break; }
        console.error(`[join] refund attempt ${attempt + 1} failed:`, refundErr.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }
      if (!refunded) console.error(`[join] CRITICAL: refund failed for user ${user.id} contest ${contest_id} amount ${contest.entry_fee}`);
    }
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }

  // Fire-and-forget: queue a WhatsApp notification for the group
  // banteragent polls ba_notifications every minute and sends pending rows.
  (async () => {
    try {
      const groupId = process.env.BOT_GROUP_ID;
      if (!groupId) return;

      // Get display name from profile
      const { data: profile } = await service
        .from("f11_profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Someone";

      // Get match info
      const { data: matchInfo } = await service
        .from("f11_matches")
        .select("team_home, team_away")
        .eq("id", contest.match_id)
        .maybeSingle();
      const matchLabel = matchInfo
        ? `${matchInfo.team_home} vs ${matchInfo.team_away}`
        : "today's match";

      // Current entry count (after this join)
      const { count: totalEntries } = await service
        .from("f11_entries")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", contest_id);
      const entryCount = totalEntries ?? 1;

      const teamLabel = team.team_name ? ` with *${team.team_name}*` : "";
      const spotsLeft = contest.max_teams - entryCount;
      const spotsLine = spotsLeft > 0
        ? `${spotsLeft} spots remaining — join now!`
        : "Contest is full now 🔥";

      const message =
        `🎉 *${displayName}* joined *${contest.name}* (${matchLabel})${teamLabel}!\n` +
        `👥 ${entryCount}/${contest.max_teams} players in\n` +
        `${spotsLine}\n` +
        `▶️ ${process.env.NEXT_PUBLIC_APP_URL ?? "https://ipl11.vercel.app"}`;

      // Insert into ba_reminders with sender_phone='__system__' — banteragent's
      // 1-min cron picks this up and sends the message directly (no "REMINDER!" wrapper).
      await service.from("ba_reminders").insert({
        group_id: groupId,
        sender_phone: "__system__",
        sender_name: "Fantasy Bot",
        reminder_text: message,
        remind_at: new Date().toISOString(),
        is_group_reminder: true,
      });
    } catch (e) {
      console.error("[join] notification insert failed:", e);
    }
  })();

  return NextResponse.json({ ok: true, entry });
}
