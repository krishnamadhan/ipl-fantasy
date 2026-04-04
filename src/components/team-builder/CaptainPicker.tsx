"use client";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import { shortTeam, TEAM_COLORS } from "@/lib/utils/format";

function initials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  WK:   { bg: "#ffd900", color: "#000" },
  BAT:  { bg: "#4fc3f7", color: "#000" },
  AR:   { bg: "#66bb6a", color: "#000" },
  BOWL: { bg: "#ef5350", color: "#fff" },
};

export default function CaptainPicker() {
  const store = useTeamBuilderStore();
  const selectedPlayers = store.selectedPlayers();
  const captainId = store.captainId();
  const vcId = store.vcId();

  if (selectedPlayers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3 text-3xl"
          style={{ background: "rgba(255,217,0,0.10)", border: "2px dashed rgba(255,217,0,0.30)" }}
        >
          👑
        </div>
        <p className="text-white font-bold text-base">Select 11 players first</p>
        <p className="text-white/30 text-sm mt-1">Then come back to pick your C &amp; VC</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#000" }}>
      {/* Info banner */}
      <div
        className="mx-4 mt-4 mb-3 rounded-2xl p-4"
        style={{ background: "rgba(255,217,0,0.08)", border: "1px solid rgba(255,217,0,0.20)" }}
      >
        <div className="flex items-center justify-around">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base"
              style={{ background: "#ffd900", color: "#000" }}
            >
              C
            </div>
            <div>
              <p className="text-white font-black text-sm">Captain</p>
              <p className="font-black text-xs" style={{ color: "#ffd900" }}>2× Points</p>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.10)" }} />
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs"
              style={{ background: "#888", color: "white" }}
            >
              VC
            </div>
            <div>
              <p className="text-white font-black text-sm">Vice Captain</p>
              <p className="text-white/40 font-black text-xs">1.5× Points</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-2 pb-4">
        {selectedPlayers.map((p) => {
          const isCap = captainId === p.id;
          const isVC = vcId === p.id;
          const teamShort = shortTeam(p.ipl_team);
          const teamColor = TEAM_COLORS[teamShort] ?? "#475569";
          const badge = ROLE_BADGE[p.role] ?? { bg: "#555", color: "#fff" };

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all"
              style={{
                background: isCap
                  ? "rgba(255,217,0,0.10)"
                  : isVC
                  ? "rgba(255,255,255,0.05)"
                  : "#111",
                border: isCap
                  ? "1px solid rgba(255,217,0,0.35)"
                  : isVC
                  ? "1px solid rgba(255,255,255,0.15)"
                  : "1px solid #1a1a1a",
              }}
            >
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                style={{
                  border: `2px solid ${teamColor}`,
                  background: `${teamColor}30`,
                  color: "white",
                }}
              >
                {initials(p.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-bold text-sm text-white truncate">{p.name}</p>
                  <span
                    className="text-[9px] px-1.5 py-0 rounded font-black shrink-0"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {p.role}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {teamShort} · {p.credit_value}cr
                </p>
              </div>

              {/* C / VC buttons */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => store.setCaptain(p.id)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all"
                  style={{
                    background: isCap ? "#ffd900" : "transparent",
                    border: isCap ? "2px solid #ffd900" : "2px solid rgba(255,255,255,0.20)",
                    color: isCap ? "#000" : "rgba(255,255,255,0.40)",
                    boxShadow: isCap ? "0 0 12px rgba(255,217,0,0.40)" : "none",
                  }}
                >
                  C
                </button>
                <button
                  onClick={() => store.setVC(p.id)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black transition-all"
                  style={{
                    background: isVC ? "#888" : "transparent",
                    border: isVC ? "2px solid #888" : "2px solid rgba(255,255,255,0.20)",
                    color: isVC ? "white" : "rgba(255,255,255,0.40)",
                  }}
                >
                  VC
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
