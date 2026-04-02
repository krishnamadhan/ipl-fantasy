"use client";
import { shortTeam, TEAM_COLORS } from "@/lib/utils/format";

interface LiveScore {
  team1: string; team1_runs: number; team1_wickets: number; team1_overs: string;
  team2: string; team2_runs: number; team2_wickets: number; team2_overs: string;
  current_batting: string; situation: string;
}

export default function LiveScoreHeader({ score, isLive }: { score: LiveScore | null; isLive: boolean }) {
  if (!score) {
    return (
      <div className="rounded-2xl border border-slate-700/60 px-4 py-3 text-center"
        style={{ background: "#0d1b35" }}>
        <p className="text-slate-500 text-sm">Score loading…</p>
      </div>
    );
  }

  const t1Short = shortTeam(score.team1);
  const t2Short = shortTeam(score.team2);
  const t1Color = TEAM_COLORS[t1Short] ?? "#F5A623";
  const t2Color = TEAM_COLORS[t2Short] ?? "#3B82F6";
  const isBatting1 = score.current_batting && score.team1.toLowerCase().includes(score.current_batting.toLowerCase());

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8"
      style={{ background: "linear-gradient(145deg, #0d1b35 0%, #111827 100%)" }}>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${t1Color}, ${t2Color})` }} />

      <div className="px-4 py-3">
        {/* Score row */}
        <div className="flex items-center justify-between mb-2">
          {/* Team 1 */}
          <div className={`flex-1 ${isBatting1 ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] border"
                style={{ borderColor: t1Color, background: t1Color + "22", color: t1Color }}>
                {t1Short.slice(0, 2)}
              </div>
              <div>
                <p className="text-white font-black text-lg leading-none tabular-nums">
                  {score.team1_runs}/{score.team1_wickets}
                </p>
                <p className="text-slate-500 text-[10px]">{score.team1_overs} ov</p>
              </div>
            </div>
          </div>

          {/* VS / live indicator */}
          <div className="px-3 text-center">
            {isLive ? (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-[10px] font-black uppercase">Live</span>
              </div>
            ) : (
              <span className="text-slate-600 text-xs font-bold">vs</span>
            )}
          </div>

          {/* Team 2 */}
          <div className={`flex-1 text-right ${!isBatting1 ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-end gap-2">
              <div>
                <p className="text-white font-black text-lg leading-none tabular-nums">
                  {score.team2_runs}/{score.team2_wickets}
                </p>
                <p className="text-slate-500 text-[10px]">{score.team2_overs} ov</p>
              </div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] border"
                style={{ borderColor: t2Color, background: t2Color + "22", color: t2Color }}>
                {t2Short.slice(0, 2)}
              </div>
            </div>
          </div>
        </div>

        {/* Situation text */}
        {score.situation && (
          <p className="text-slate-400 text-xs text-center truncate">{score.situation}</p>
        )}
      </div>
    </div>
  );
}
