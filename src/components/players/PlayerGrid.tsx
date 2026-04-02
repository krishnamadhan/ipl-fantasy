"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { cn, shortTeam, TEAM_COLORS } from "@/lib/utils/format";
import type { IplPlayer, PlayerRole } from "@/types/player";

const ROLE_TABS: Array<{ value: PlayerRole | "ALL"; label: string }> = [
  { value: "ALL",  label: "All" },
  { value: "WK",   label: "WK" },
  { value: "BAT",  label: "BAT" },
  { value: "AR",   label: "AR" },
  { value: "BOWL", label: "BOWL" },
];

const ROLE_STYLE: Record<PlayerRole, { bg: string; text: string }> = {
  WK:   { bg: "bg-purple-500/20", text: "text-purple-300" },
  BAT:  { bg: "bg-blue-500/20",   text: "text-blue-300" },
  AR:   { bg: "bg-green-500/20",  text: "text-green-300" },
  BOWL: { bg: "bg-orange-500/20", text: "text-orange-300" },
};

export default function PlayerGrid({ players, teams = [] }: { players: IplPlayer[]; teams?: string[] }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<PlayerRole | "ALL">("ALL");
  const [team, setTeam] = useState<string>("ALL");

  const filtered = useMemo(() => players.filter((p) => {
    if (role !== "ALL" && p.role !== role) return false;
    if (team !== "ALL" && p.ipl_team !== team) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [players, role, team, search]);

  const counts = useMemo(() => ({
    ALL: players.length,
    WK:   players.filter((p) => p.role === "WK").length,
    BAT:  players.filter((p) => p.role === "BAT").length,
    AR:   players.filter((p) => p.role === "AR").length,
    BOWL: players.filter((p) => p.role === "BOWL").length,
  }), [players]);

  return (
    <div>
      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Search player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl pl-9 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none text-sm transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          />
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 px-4 mb-3 overflow-x-auto scrollbar-none">
        {ROLE_TABS.map(({ value, label }) => (
          <button key={value} onClick={() => setRole(value)}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition",
              role === value
                ? "bg-brand border-brand text-white"
                : "border-slate-700 text-slate-400 bg-transparent hover:border-slate-500"
            )}>
            {label}
            <span className={cn("ml-1", role === value ? "text-white/60" : "text-slate-600")}>
              ({counts[value]})
            </span>
          </button>
        ))}
      </div>

      {/* Team filter */}
      {teams.length > 1 && (
        <div className="px-4 mb-4">
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none appearance-none transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}>
            <option value="ALL">All Teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Player list */}
      <div className="px-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🔍</p>
            <p className="text-white font-bold">No players found</p>
            <p className="text-slate-500 text-sm mt-1">Try a different filter or sync squads from admin</p>
          </div>
        )}

        {filtered.map((p) => {
          const teamShort = shortTeam(p.ipl_team);
          const teamColor = TEAM_COLORS[teamShort] ?? "#475569";
          const roleStyle = ROLE_STYLE[p.role] ?? { bg: "bg-slate-700", text: "text-slate-400" };

          return (
            <Link key={p.id} href={`/players/${p.id}`}
              className="flex items-center gap-3 rounded-2xl border hover:border-white/15 transition p-3"
              style={{ background: "#111827", borderColor: "rgba(255,255,255,0.07)" }}>

              {/* Team color ring */}
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-xs border-2 shrink-0"
                style={{ borderColor: teamColor, background: teamColor + "22", color: teamColor }}>
                {teamShort}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{p.name}</p>
                <p className="text-slate-500 text-xs truncate">{p.ipl_team}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full uppercase", roleStyle.bg, roleStyle.text)}>
                  {p.role}
                </span>
                <div className="text-right min-w-[36px]">
                  <p className="text-brand font-black text-sm leading-none">{p.credit_value}</p>
                  <p className="text-slate-600 text-[9px]">CR</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
