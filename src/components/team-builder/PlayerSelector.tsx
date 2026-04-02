"use client";
import { useState, useMemo } from "react";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import { cn } from "@/lib/utils/format";
import type { IplPlayer, PlayerRole } from "@/types/player";

export interface PlayerWithMeta extends IplPlayer {
  selection_pct?: number;
  last_points?: number;
  is_playing_xi?: boolean;
}

type SortKey = "credits_desc" | "credits_asc" | "points_desc" | "sel_desc";
type RoleFilter = PlayerRole | "ALL";

const ROLES: RoleFilter[] = ["ALL", "WK", "BAT", "AR", "BOWL"];

const ROLE_LABELS: Record<string, string> = {
  ALL: "All", WK: "WK", BAT: "BAT", AR: "AR", BOWL: "BOWL"
};

const ROLE_COLOR: Record<PlayerRole, string> = {
  WK:   "text-purple-400",
  BAT:  "text-blue-400",
  AR:   "text-green-400",
  BOWL: "text-orange-400",
};

const ROLE_BG: Record<PlayerRole, string> = {
  WK:   "bg-purple-500/15 border-purple-500/40",
  BAT:  "bg-blue-500/15 border-blue-500/40",
  AR:   "bg-green-500/15 border-green-500/40",
  BOWL: "bg-orange-500/15 border-orange-500/40",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function shortTeamName(team: string) {
  const map: Record<string, string> = {
    "Chennai Super Kings": "CSK", "Mumbai Indians": "MI",
    "Royal Challengers Bengaluru": "RCB", "Royal Challengers Bangalore": "RCB",
    "Kolkata Knight Riders": "KKR", "Delhi Capitals": "DC",
    "Rajasthan Royals": "RR", "Punjab Kings": "PBKS",
    "Sunrisers Hyderabad": "SRH", "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
  };
  if (map[team]) return map[team];
  const parts = team.trim().split(" ");
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

export default function PlayerSelector({
  players,
  teamHome,
  teamAway,
}: {
  players: PlayerWithMeta[];
  teamHome: string;
  teamAway: string;
}) {
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("credits_desc");
  const [teamFilter, setTeamFilter] = useState<"both" | "home" | "away">("both");
  const [search, setSearch] = useState("");

  const store = useTeamBuilderStore();
  // NOTE: selectedPlayers is a function in the store
  const selectedPlayers = store.selectedPlayers();
  const selectedIds = useMemo(() => new Set(selectedPlayers.map((p) => p.id)), [selectedPlayers]);
  const credits = store.totalCredits();

  const homeShort = shortTeamName(teamHome);
  const awayShort = shortTeamName(teamAway);

  function canAdd(player: PlayerWithMeta): { ok: boolean; reason?: string } {
    if (selectedIds.has(player.id)) return { ok: false };
    if (selectedPlayers.length >= 11) return { ok: false, reason: "11 players selected" };
    if (credits + player.credit_value > 100) return { ok: false, reason: "Not enough credits" };
    const fromTeam = selectedPlayers.filter((p) => p.ipl_team === player.ipl_team).length;
    if (fromTeam >= 7) return { ok: false, reason: "Max 7 from one team" };
    return { ok: true };
  }

  const filtered = useMemo(() => {
    let list = players.filter((p) => {
      if (role !== "ALL" && p.role !== role) return false;
      if (teamFilter === "home" && p.ipl_team !== teamHome) return false;
      if (teamFilter === "away" && p.ipl_team !== teamAway) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    list.sort((a, b) => {
      // Selected float to top
      const aS = selectedIds.has(a.id) ? 0 : 1;
      const bS = selectedIds.has(b.id) ? 0 : 1;
      if (aS !== bS) return aS - bS;
      switch (sort) {
        case "credits_desc": return b.credit_value - a.credit_value;
        case "credits_asc":  return a.credit_value - b.credit_value;
        case "points_desc":  return (b.last_points ?? 0) - (a.last_points ?? 0);
        case "sel_desc":     return (b.selection_pct ?? 0) - (a.selection_pct ?? 0);
      }
    });

    return list;
  }, [players, role, teamFilter, search, sort, selectedIds, teamHome, teamAway]);

  // Count XI status
  const xiSynced = players.some((p) => p.is_playing_xi !== undefined);
  const playingCount = players.filter((p) => p.is_playing_xi === true).length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* XI status bar */}
      {xiSynced && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/20">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <p className="text-green-400 text-xs font-semibold">Playing XI confirmed · {playingCount} players</p>
        </div>
      )}

      {/* Filters row */}
      <div className="px-4 pt-3 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search" placeholder="Search player…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-elevated border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand"
          />
        </div>

        {/* Role tabs */}
        <div className="flex gap-1.5">
          {ROLES.map((r) => {
            const count = r === "ALL" ? selectedPlayers.length : selectedPlayers.filter((p) => p.role === r).length;
            return (
              <button key={r} onClick={() => setRole(r)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition border",
                  role === r
                    ? "bg-brand border-brand text-white"
                    : "border-slate-700 text-slate-400 bg-surface-elevated hover:border-slate-500"
                )}>
                {ROLE_LABELS[r]}
                {r !== "ALL" && count > 0 && (
                  <span className={cn("ml-0.5", role === r ? "text-white/70" : "text-brand")}>({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Team filter + sort */}
        <div className="flex gap-2">
          <div className="flex rounded-xl overflow-hidden border border-slate-700 shrink-0 text-xs">
            {(["both", "home", "away"] as const).map((t) => (
              <button key={t} onClick={() => setTeamFilter(t)}
                className={cn(
                  "px-2.5 py-1.5 font-semibold transition",
                  teamFilter === t ? "bg-brand text-white" : "bg-surface-elevated text-slate-400"
                )}>
                {t === "both" ? "All" : t === "home" ? homeShort : awayShort}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="flex-1 bg-surface-elevated border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand">
            <option value="credits_desc">Credits ↓</option>
            <option value="credits_asc">Credits ↑</option>
            <option value="points_desc">Points ↓</option>
            <option value="sel_desc">Selected ↓</option>
          </select>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_40px_40px_40px_36px] px-4 pt-2.5 pb-1 text-[9px] text-slate-600 font-bold uppercase tracking-wider border-b border-slate-800">
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Sel%</span>
        <span className="text-right">Cr</span>
        <span />
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-sm">No players found</div>
        )}
        {filtered.map((p) => {
          const isSelected = selectedIds.has(p.id);
          const { ok: addable } = canAdd(p);
          const selPct = p.selection_pct ?? null;
          const lastPts = p.last_points ?? null;
          const teamShort = shortTeamName(p.ipl_team);
          const xiStatus = p.is_playing_xi;

          return (
            <div key={p.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isSelected ? "bg-brand/5" : "hover:bg-slate-800/30"
              )}>
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center text-xs font-black border-2 overflow-hidden",
                  isSelected ? "border-brand" : "border-slate-700 bg-[#1a2235]"
                )}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                    : <span className={isSelected ? "text-brand" : "text-slate-400"}>{initials(p.name)}</span>
                  }
                </div>
                {isSelected && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand border border-[#0a0a0f] flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className={cn("text-sm font-bold truncate", isSelected ? "text-white" : "text-white")}>{p.name}</p>
                  <span className={cn("text-[8px] px-1 py-0 rounded font-black border shrink-0", ROLE_BG[p.role], ROLE_COLOR[p.role])}>
                    {p.role}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">{teamShort}</span>
                  {xiStatus === true && (
                    <span className="text-[9px] bg-green-500/20 border border-green-500/40 text-green-400 px-1.5 py-0 rounded font-bold">
                      PLAYING
                    </span>
                  )}
                  {xiStatus === false && (
                    <span className="text-[9px] bg-red-500/15 border border-red-500/30 text-red-400 px-1.5 py-0 rounded font-bold">
                      BENCH
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <span className="text-slate-300 text-xs font-medium w-10 text-right shrink-0 tabular-nums">
                {lastPts !== null ? lastPts : "—"}
              </span>
              <span className={cn(
                "text-xs font-medium w-10 text-right shrink-0 tabular-nums",
                selPct !== null && selPct >= 70 ? "text-red-400" :
                selPct !== null && selPct >= 40 ? "text-yellow-400" :
                "text-slate-400"
              )}>
                {selPct !== null ? `${selPct}%` : "—"}
              </span>
              <span className="text-white text-xs font-bold w-10 text-right shrink-0 tabular-nums">
                {p.credit_value}
              </span>

              {/* Add/Remove */}
              <button
                onClick={() => isSelected ? store.removePlayer(p.id) : store.addPlayer(p)}
                disabled={!isSelected && !addable}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-black text-lg transition shrink-0 border-2",
                  isSelected
                    ? "bg-red-500/10 border-red-500/60 text-red-400"
                    : addable
                    ? "bg-brand/10 border-brand/60 text-brand hover:bg-brand/20"
                    : "bg-transparent border-slate-700 text-slate-600 cursor-not-allowed"
                )}>
                {isSelected ? "−" : "+"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 bg-[#111117] border-t border-slate-800 flex items-center justify-between">
        <span className="text-slate-500 text-xs">{selectedPlayers.length}/11 selected</span>
        <span className="text-slate-500 text-xs">{filtered.length} players</span>
      </div>
    </div>
  );
}
