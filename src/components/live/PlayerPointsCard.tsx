"use client";
import { useState } from "react";
import { shortTeam, TEAM_COLORS } from "@/lib/utils/format";

interface PointsBreakdown {
  playing_xi: number;
  batting: { runs: number; fours: number; sixes: number; milestone: number; duck: number; strike_rate: number };
  bowling: { wickets: number; haul_bonus: number; maidens: number; economy: number };
  fielding: { catches: number; stumpings: number; run_outs: number };
  total: number;
}

interface PlayerStat {
  player_id: string;
  fantasy_points: number;
  points_breakdown: PointsBreakdown | null;
  runs: number;
  wickets: number;
  catches: number;
  overs_bowled: number;
  is_playing_xi: boolean;
  player: { name: string; ipl_team: string; role: string } | null;
}

function initials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerPointsCard({
  stat,
  isCaptain,
  isVC,
}: {
  stat: PlayerStat;
  isCaptain: boolean;
  isVC: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const player = Array.isArray(stat.player) ? stat.player[0] : stat.player;
  if (!player) return null;

  const teamShort = shortTeam(player.ipl_team);
  const teamColor = TEAM_COLORS[teamShort] ?? "#475569";
  const multiplier = isCaptain ? 2 : isVC ? 1.5 : 1;
  const basePoints = stat.fantasy_points ?? 0;
  const finalPoints = basePoints * multiplier;
  const bd = stat.points_breakdown;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition"
      style={{
        background: "#111827",
        borderColor: isCaptain ? "rgba(245,166,35,0.30)" : isVC ? "rgba(148,163,184,0.20)" : "rgba(255,255,255,0.06)",
      }}
    >
      <button className="w-full text-left" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-3 p-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border-2 shrink-0"
            style={{ borderColor: teamColor, background: teamColor + "22", color: teamColor }}>
            {initials(player.name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-white font-bold text-sm break-words leading-snug">{player.name}</p>
              {isCaptain && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(245,166,35,0.20)", color: "#F5A623" }}>C 2×</span>
              )}
              {isVC && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(148,163,184,0.15)", color: "#94A3B8" }}>VC 1.5×</span>
              )}
            </div>
            <p className="text-slate-500 text-xs">
              {teamShort} · {player.role}
              {stat.is_playing_xi && <span className="text-green-400 ml-1">✓XI</span>}
            </p>
            {/* Quick stats line */}
            <p className="text-slate-400 text-xs mt-0.5">
              {stat.runs > 0 && `${stat.runs}r `}
              {stat.wickets > 0 && `${stat.wickets}w `}
              {stat.catches > 0 && `${stat.catches}ct`}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="font-black text-base leading-none tabular-nums"
              style={{ color: finalPoints > 0 ? "#F5A623" : "#475569" }}>
              {finalPoints > 0 ? finalPoints.toFixed(1) : "—"}
            </p>
            {multiplier > 1 && basePoints > 0 && (
              <p className="text-slate-500 text-[10px]">{basePoints} base</p>
            )}
            <p className="text-slate-600 text-[9px] mt-0.5">{expanded ? "▲" : "▼"}</p>
          </div>
        </div>
      </button>

      {/* Breakdown panel */}
      {expanded && bd && (
        <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.20)" }}>
          <BreakdownRow label="Playing XI" value={bd.playing_xi} />
          {/* Batting */}
          {bd.batting.runs > 0 && <BreakdownRow label={`Runs (${stat.runs})`} value={bd.batting.runs} />}
          {bd.batting.fours > 0 && <BreakdownRow label="Boundary bonus" value={bd.batting.fours} />}
          {bd.batting.sixes > 0 && <BreakdownRow label="Six bonus" value={bd.batting.sixes} />}
          {bd.batting.milestone !== 0 && (
            <BreakdownRow label={stat.runs >= 100 ? "Century bonus" : "Half-century bonus"} value={bd.batting.milestone} />
          )}
          {bd.batting.duck < 0 && <BreakdownRow label="Duck" value={bd.batting.duck} />}
          {bd.batting.strike_rate !== 0 && <BreakdownRow label="Strike rate" value={bd.batting.strike_rate} />}
          {/* Bowling */}
          {bd.bowling.wickets > 0 && <BreakdownRow label={`Wickets (${stat.wickets}×25)`} value={bd.bowling.wickets} />}
          {bd.bowling.haul_bonus > 0 && <BreakdownRow label="Wicket haul bonus" value={bd.bowling.haul_bonus} />}
          {bd.bowling.maidens > 0 && <BreakdownRow label="Maidens" value={bd.bowling.maidens} />}
          {bd.bowling.economy !== 0 && <BreakdownRow label="Economy bonus" value={bd.bowling.economy} />}
          {/* Fielding */}
          {bd.fielding.catches > 0 && <BreakdownRow label={`Catches (${stat.catches}×8)`} value={bd.fielding.catches} />}
          {bd.fielding.stumpings > 0 && <BreakdownRow label="Stumpings" value={bd.fielding.stumpings} />}
          {bd.fielding.run_outs > 0 && <BreakdownRow label="Run outs" value={bd.fielding.run_outs} />}

          {/* Divider + total */}
          <div className="border-t pt-1.5 flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-slate-400 text-xs font-bold">Base Total</span>
            <span className="text-white font-black text-sm tabular-nums">{bd.total}</span>
          </div>
          {multiplier > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold">
                {isCaptain ? "Captain 2×" : "Vice-captain 1.5×"}
              </span>
              <span className="font-black text-sm tabular-nums" style={{ color: "#F5A623" }}>{finalPoints.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${value > 0 ? "text-slate-300" : "text-red-400"}`}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}
