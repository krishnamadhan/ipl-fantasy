import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LiveScoreHeader from "@/components/live/LiveScoreHeader";
import PlayerPointsCard from "@/components/live/PlayerPointsCard";
import LiveLeaderboard from "@/components/live/LiveLeaderboard";

export const revalidate = 0; // always fresh — this is the live match page

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: match } = await supabase
    .from("f11_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!match) redirect("/matches");

  const isLive = match.status === "live";
  const isInReview = match.status === "in_review";

  // Only accessible during/after the match
  if (!isLive && !isInReview) {
    redirect(`/matches/${matchId}`);
  }

  // Fetch all player stats for this match (with breakdown)
  const { data: allStats } = await supabase
    .from("f11_player_stats")
    .select("*, player:f11_players(name, ipl_team, role)")
    .eq("match_id", matchId);

  const statsById: Record<string, any> = {};
  for (const s of allStats ?? []) {
    statsById[s.player_id] = s;
  }

  // Find user's first entry in any contest for this match
  const { data: userEntries } = await supabase
    .from("f11_entries")
    .select("id, contest_id, team_name, total_points, rank, player_ids, captain_id, vc_id")
    .eq("user_id", user.id)
    .in(
      "contest_id",
      // sub-select: all contest IDs for this match
      (
        await supabase
          .from("f11_contests")
          .select("id")
          .eq("match_id", matchId)
      ).data?.map((c) => c.id) ?? []
    );

  const myEntry = userEntries?.[0] ?? null;

  // Build leaderboard entries for the first contest the user is in
  let leaderboardEntries: any[] = [];
  let contestId = myEntry?.contest_id ?? null;

  if (!contestId) {
    // If user has no entry, use the first public contest for this match
    const { data: contests } = await supabase
      .from("f11_contests")
      .select("id")
      .eq("match_id", matchId)
      .in("status", ["locked", "completed"])
      .limit(1);
    contestId = contests?.[0]?.id ?? null;
  }

  if (contestId) {
    const { data: lb } = await supabase
      .from("f11_entries")
      .select(
        "id, user_id, team_name, total_points, rank, previous_rank, prize_won, profile:f11_profiles!user_id(display_name, username)"
      )
      .eq("contest_id", contestId)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("total_points", { ascending: false })
      .limit(50);
    leaderboardEntries = lb ?? [];
  }

  // Build player cards for user's team
  let myTeamStats: any[] = [];
  if (myEntry) {
    myTeamStats = (myEntry.player_ids as string[]).map((pid) => {
      const stat = statsById[pid];
      if (stat) return stat;
      // Player not in stats yet — return zeros
      return {
        player_id: pid,
        fantasy_points: 0,
        points_breakdown: null,
        runs: 0,
        wickets: 0,
        catches: 0,
        overs_bowled: 0,
        is_playing_xi: false,
        player: null,
      };
    });
  }

  return (
    <div
      className="max-w-lg mx-auto pb-32"
      style={{ background: "#0B0E14", minHeight: "100vh" }}
    >
      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3 border-b border-white/5"
        style={{ background: "rgba(8,13,26,0.97)", backdropFilter: "blur(20px)" }}
      >
        <Link
          href={`/matches/${matchId}`}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-white/10"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 text-center">
          <p className="text-white font-black text-sm">
            {match.team_home} <span className="text-slate-600 font-normal">vs</span> {match.team_away}
          </p>
        </div>
        <div className="w-9 h-9 flex items-center justify-center">
          {isLive && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-400 text-[10px] font-black">LIVE</span>
            </div>
          )}
          {isInReview && (
            <span className="text-purple-400 text-[10px] font-black">DONE</span>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* ── Live score card ── */}
        <LiveScoreHeader score={match.live_score_summary} isLive={isLive} matchId={matchId} />

        {/* ── My team section ── */}
        {myEntry ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-black text-sm">{myEntry.team_name}</p>
                <p className="text-slate-500 text-xs">
                  {myEntry.total_points > 0 ? (
                    <span>
                      <span className="text-brand font-bold">{myEntry.total_points.toFixed(1)}</span> pts
                      {myEntry.rank && (
                        <span className="ml-1.5 text-slate-600">· Rank #{myEntry.rank}</span>
                      )}
                    </span>
                  ) : (
                    "Scoring in progress…"
                  )}
                </p>
              </div>
              {userEntries && userEntries.length > 1 && (
                <p className="text-slate-500 text-xs">{userEntries.length} teams</p>
              )}
            </div>

            <div className="space-y-2">
              {myTeamStats.map((stat) => (
                <PlayerPointsCard
                  key={stat.player_id}
                  stat={stat}
                  isCaptain={stat.player_id === myEntry.captain_id}
                  isVC={stat.player_id === myEntry.vc_id}
                />
              ))}
            </div>
          </section>
        ) : (
          <div
            className="rounded-2xl border border-white/10 px-4 py-8 text-center"
            style={{ background: "#111827" }}
          >
            <p className="text-white font-bold mb-1">Not in this match</p>
            <p className="text-slate-500 text-sm">You didn't enter any contests for this match</p>
          </div>
        )}

        {/* ── Leaderboard ── */}
        {contestId && leaderboardEntries.length > 0 && (
          <section>
            <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-3">
              Leaderboard
            </p>
            <LiveLeaderboard
              contestId={contestId}
              initialEntries={leaderboardEntries}
              currentUserId={user.id}
              isLive={isLive}
            />
          </section>
        )}
      </div>
    </div>
  );
}
