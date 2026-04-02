import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { shortTeam } from "@/lib/utils/format";
import type { IplPlayer, PlayerMatchStats, PlayerCreditHistory } from "@/types/player";
import CreditHistoryChart from "@/components/players/CreditHistoryChart";

export const revalidate = 300;

const ROLE_COLOR: Record<string, string> = {
  WK: "bg-purple-500/20 text-purple-300",
  BAT: "bg-blue-500/20 text-blue-300",
  AR: "bg-green-500/20 text-green-300",
  BOWL: "bg-orange-500/20 text-orange-300",
};

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [playerRes, statsRes, historyRes] = await Promise.all([
    supabase.from("f11_players").select("*").eq("id", id).single(),
    supabase
      .from("f11_player_stats")
      .select("*, match:f11_matches(team_home,team_away,scheduled_at)")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("f11_credit_history")
      .select("*")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!playerRes.data) notFound();

  const player = playerRes.data as IplPlayer;
  const stats = (statsRes.data ?? []) as (PlayerMatchStats & { match: any })[];
  const history = (historyRes.data ?? []) as PlayerCreditHistory[];

  const avgPoints = stats.length > 0
    ? (stats.reduce((s, r) => s + r.fantasy_points, 0) / stats.length).toFixed(1)
    : "–";

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-6">
      {/* Player header */}
      <div className="bg-surface-card rounded-2xl p-5 border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center text-3xl">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full rounded-full object-cover" />
            ) : "👤"}
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">{player.name}</h1>
            <p className="text-slate-400 text-sm">{player.ipl_team}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLOR[player.role] ?? ""}`}>
                {player.role}
              </span>
              <span className="text-brand font-bold">{player.credit_value} cr</span>
              {player.credit_override && (
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">Locked</span>
              )}
            </div>
          </div>
        </div>

        {(player.batting_style || player.bowling_style) && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {player.batting_style && (
              <div className="bg-surface-elevated rounded-lg p-2">
                <p className="text-slate-400">Batting</p>
                <p className="text-white">{player.batting_style}</p>
              </div>
            )}
            {player.bowling_style && (
              <div className="bg-surface-elevated rounded-lg p-2">
                <p className="text-slate-400">Bowling</p>
                <p className="text-white">{player.bowling_style}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avg Pts", value: avgPoints },
          { label: "Matches", value: stats.length },
          { label: "Credits", value: player.credit_value },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-card rounded-xl p-3 text-center border border-slate-700">
            <p className="text-brand font-bold text-xl">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Last 5 matches */}
      {stats.length > 0 && (
        <div>
          <h2 className="text-white font-bold mb-3">Last 5 Matches</h2>
          <div className="space-y-2">
            {stats.map((s) => (
              <div key={s.id} className="bg-surface-card rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs">
                    {shortTeam(s.match?.team_home ?? "")} vs {shortTeam(s.match?.team_away ?? "")}
                  </p>
                  <span className="text-brand font-bold">{s.fantasy_points} pts</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  {s.runs > 0 || s.balls_faced > 0 ? (
                    <>
                      <div><p className="text-white font-semibold">{s.runs}</p><p className="text-slate-400">Runs</p></div>
                      <div><p className="text-white font-semibold">{s.balls_faced}</p><p className="text-slate-400">Balls</p></div>
                    </>
                  ) : null}
                  {s.wickets > 0 || s.overs_bowled > 0 ? (
                    <>
                      <div><p className="text-white font-semibold">{s.wickets}</p><p className="text-slate-400">Wkts</p></div>
                      <div><p className="text-white font-semibold">{s.overs_bowled}</p><p className="text-slate-400">Overs</p></div>
                    </>
                  ) : null}
                  {s.catches > 0 && (
                    <div><p className="text-white font-semibold">{s.catches}</p><p className="text-slate-400">Catch</p></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit history chart */}
      {history.length > 0 && (
        <div>
          <h2 className="text-white font-bold mb-3">Credit History</h2>
          <CreditHistoryChart history={history} currentCredit={player.credit_value} />
        </div>
      )}
    </div>
  );
}
