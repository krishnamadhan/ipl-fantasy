"use client";
import { useState, useMemo } from "react";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import { cn } from "@/lib/utils/format";
import type { IplPlayer, PlayerRole } from "@/types/player";

export interface PlayerWithMeta extends IplPlayer {
  selection_pct?: number;
  last_points?: number;
  is_playing_xi?: boolean;
  last_match_stats?: { runs: number; wickets: number; catches: number; fantasy_points: number; played: boolean } | null;
}

type SortKey = "credits_desc" | "credits_asc" | "points_desc" | "sel_desc";
type RoleFilter = PlayerRole | "ALL";

const ROLES: RoleFilter[] = ["ALL", "WK", "BAT", "AR", "BOWL"];

// Dream11 role badge colors
const ROLE_BADGE: Record<PlayerRole, { bg: string; color: string }> = {
  WK:   { bg: "#ffd900", color: "#000" },
  BAT:  { bg: "#4fc3f7", color: "#000" },
  AR:   { bg: "#66bb6a", color: "#000" },
  BOWL: { bg: "#ef5350", color: "#fff" },
};

const ROLE_ACTIVE: Record<RoleFilter, string> = {
  ALL:  "#e53935",
  WK:   "#ffd900",
  BAT:  "#4fc3f7",
  AR:   "#66bb6a",
  BOWL: "#ef5350",
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
  tossWinner = null,
}: {
  players: PlayerWithMeta[];
  teamHome: string;
  teamAway: string;
  tossWinner?: string | null;
}) {
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("credits_desc");
  const [teamFilter, setTeamFilter] = useState<"both" | "home" | "away">("both");
  const [search, setSearch] = useState("");

  const store = useTeamBuilderStore();
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

  // XI is "synced" only when at least one player is confirmed PLAYING (not just pre-populated as false)
  const xiSynced = players.some((p) => p.is_playing_xi === true);
  const playingCount = players.filter((p) => p.is_playing_xi === true).length;
  const activeColor = ROLE_ACTIVE[role];

  return (
    <div className="flex flex-col" style={{ background: "#000" }}>
      {/* XI confirmed bar */}
      {xiSynced && (
        <div className="flex items-center gap-2 px-4 py-2 border-b"
          style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.15)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <p className="text-green-400 text-xs font-bold">
            Playing XI confirmed · {playingCount} players announced
          </p>
        </div>
      )}
      {/* Toss done but XI not yet synced */}
      {!xiSynced && tossWinner && (
        <div className="flex items-center gap-2 px-4 py-2 border-b"
          style={{ background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.15)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
          <p className="text-yellow-400 text-xs font-bold">
            🪙 Toss done · {tossWinner} won — confirming Playing XI...
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 pt-3 space-y-2.5 pb-1">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search player…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-white text-sm rounded-xl focus:outline-none"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
          />
        </div>

        {/* Role tabs */}
        <div className="flex gap-1">
          {ROLES.map((r) => {
            const roleCount = r === "ALL"
              ? selectedPlayers.length
              : selectedPlayers.filter((p) => p.role === r).length;
            const isActive = role === r;
            const color = ROLE_ACTIVE[r];
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-black transition"
                style={{
                  background: isActive ? color : "rgba(255,255,255,0.05)",
                  color: isActive ? (r === "WK" || r === "BAT" || r === "AR" ? "#000" : "white") : "rgba(255,255,255,0.40)",
                  border: `1px solid ${isActive ? color : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {r}
                {r !== "ALL" && roleCount > 0 && (
                  <span className="ml-0.5 opacity-70">({roleCount})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Team filter + sort */}
        <div className="flex gap-2">
          <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid #2a2a2a" }}>
            {(["both", "home", "away"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTeamFilter(t)}
                className="px-2.5 py-1.5 text-xs font-bold transition"
                style={{
                  background: teamFilter === t ? "#e53935" : "#1a1a1a",
                  color: teamFilter === t ? "white" : "rgba(255,255,255,0.40)",
                }}
              >
                {t === "both" ? "All" : t === "home" ? homeShort : awayShort}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="flex-1 px-2.5 py-1.5 text-xs text-white/60 rounded-xl focus:outline-none"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
          >
            <option value="credits_desc">Credits ↓</option>
            <option value="credits_asc">Credits ↑</option>
            <option value="points_desc">Points ↓</option>
            <option value="sel_desc">Selected ↓</option>
          </select>
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid grid-cols-[1fr_36px_38px_36px_36px] px-4 pt-2 pb-1.5 text-[9px] font-black uppercase tracking-wider border-b border-t"
        style={{ minWidth:"280px", color: "rgba(255,255,255,0.30)", borderColor: "#1a1a1a" }}
      >
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Sel%</span>
        <span className="text-right">Cr</span>
        <span />
      </div>

      {/* Player list */}
      <div className="divide-y divide-[#111]">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-white/30 text-sm">No players found</div>
        )}
        {filtered.map((p) => {
          const isSelected = selectedIds.has(p.id);
          const { ok: addable } = canAdd(p);
          const selPct = p.selection_pct ?? null;
          const lastPts = p.last_points ?? null;
          const teamShort = shortTeamName(p.ipl_team);
          const xiStatus = p.is_playing_xi;
          const badge = ROLE_BADGE[p.role];
          const lms = p.last_match_stats;
          // Build last-match summary string (only when player actually played)
          const lastMatchLine = lms?.played
            ? [
                lms.runs > 0 ? `${lms.runs}R` : null,
                lms.wickets > 0 ? `${lms.wickets}W` : null,
                lms.catches > 0 ? `${lms.catches}C` : null,
              ].filter(Boolean).join(" · ") || `${lms.fantasy_points} pts`
            : null;

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: isSelected ? "rgba(229,57,53,0.06)" : "transparent",
                borderLeft: isSelected ? "3px solid #e53935" : "3px solid transparent",
              }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-black overflow-hidden"
                  style={{
                    border: `2px solid ${isSelected ? "#e53935" : "#2a2a2a"}`,
                    background: isSelected ? "rgba(229,57,53,0.15)" : "#1a1a1a",
                    color: isSelected ? "#e53935" : "rgba(255,255,255,0.60)",
                  }}
                >
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                    : initials(p.name)
                  }
                </div>
                {isSelected && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "#e53935", border: "1.5px solid #000" }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm font-bold text-white break-words leading-snug flex-1">{p.name}</p>
                  <span
                    className="text-[9px] px-1.5 py-0 rounded font-black shrink-0"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {p.role}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white/40 text-xs">{teamShort}</span>
                  {/* Post-toss: show PLAYING / BENCH */}
                  {xiSynced && xiStatus === true && (
                    <span
                      className="text-[9px] px-1.5 py-0 rounded font-bold"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}
                    >
                      PLAYING
                    </span>
                  )}
                  {xiSynced && xiStatus === false && (
                    <span
                      className="text-[9px] px-1.5 py-0 rounded font-bold"
                      style={{ background: "rgba(229,57,53,0.12)", color: "#f87171", border: "1px solid rgba(229,57,53,0.20)" }}
                    >
                      BENCH
                    </span>
                  )}
                  {/* Pre-toss: show last match stats or "Didn't play" */}
                  {!xiSynced && lms != null && (
                    lms.played === false ? (
                      <span className="text-[9px] font-medium" style={{ color: "#6b7280" }}>
                        Didn&apos;t play
                      </span>
                    ) : lastMatchLine ? (
                      <span className="text-[9px] font-medium" style={{ color: "#94a3b8" }}>
                        Last: {lastMatchLine}
                      </span>
                    ) : null
                  )}
                </div>
              </div>

              {/* Stats */}
              <span className="text-white/50 text-xs font-medium w-9 text-right shrink-0 tabular-nums">
                {lastPts !== null ? lastPts : "—"}
              </span>
              <span
                className="text-xs font-medium w-10 text-right shrink-0 tabular-nums"
                style={{
                  color: selPct !== null && selPct >= 70 ? "#f87171"
                    : selPct !== null && selPct >= 40 ? "#fbbf24"
                    : "rgba(255,255,255,0.40)",
                }}
              >
                {selPct !== null ? `${selPct}%` : "—"}
              </span>
              <span className="text-white text-xs font-bold w-9 text-right shrink-0 tabular-nums">
                {p.credit_value}
              </span>

              {/* Add/Remove button */}
              <button
                onClick={() => isSelected ? store.removePlayer(p.id) : store.addPlayer(p)}
                disabled={!isSelected && !addable}
                className="w-8 h-8 rounded-full flex items-center justify-center font-black text-lg transition shrink-0"
                style={{
                  border: isSelected
                    ? "2px solid rgba(229,57,53,0.60)"
                    : addable
                    ? "2px solid rgba(229,57,53,0.50)"
                    : "2px solid rgba(255,255,255,0.10)",
                  background: isSelected
                    ? "rgba(229,57,53,0.15)"
                    : addable
                    ? "rgba(229,57,53,0.08)"
                    : "transparent",
                  color: isSelected ? "#f87171" : addable ? "#e53935" : "rgba(255,255,255,0.20)",
                  cursor: !isSelected && !addable ? "not-allowed" : "pointer",
                }}
              >
                {isSelected ? "−" : "+"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      <div
        className="sticky bottom-0 px-4 py-2 flex items-center justify-between border-t"
        style={{ background: "#0d0d0d", borderColor: "#1a1a1a" }}
      >
        <span className="text-white/30 text-xs">
          <span className="text-white font-bold">{selectedPlayers.length}</span>/11 selected
        </span>
        <span className="text-white/30 text-xs">{filtered.length} players</span>
      </div>
    </div>
  );
}
