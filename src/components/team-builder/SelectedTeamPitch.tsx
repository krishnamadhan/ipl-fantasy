"use client";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import { cn, shortTeam, TEAM_COLORS } from "@/lib/utils/format";
import type { PlayerRole } from "@/types/player";

const ROLE_ORDER: PlayerRole[] = ["BOWL", "AR", "BAT", "WK"];
const ROLE_LABEL: Record<PlayerRole, string> = {
  BOWL: "Bowlers", AR: "All-Rounders", BAT: "Batsmen", WK: "Wicket-Keepers",
};

function initials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PlayerDot({
  player, isCap, isVC, onRemove,
}: {
  player: { id: string; name: string; ipl_team: string; credit_value: number };
  isCap: boolean;
  isVC: boolean;
  onRemove: (id: string) => void;
}) {
  const teamShort = shortTeam(player.ipl_team);
  const color = TEAM_COLORS[teamShort] ?? "#475569";
  const displayName = player.name.trim().split(" ").slice(-1)[0];

  return (
    <button
      onClick={() => onRemove(player.id)}
      className="flex flex-col items-center gap-0.5 group"
      title={`Remove ${player.name}`}
    >
      <div className="relative">
        {/* C glow ring */}
        {isCap && (
          <div
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 0 2.5px #ffd900, 0 0 10px rgba(255,217,0,0.50)" }}
          />
        )}
        {isVC && !isCap && (
          <div
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 0 2px #888" }}
          />
        )}

        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-black border-2 transition-transform group-hover:scale-105 shadow-lg select-none"
          style={{
            borderColor: color,
            background: `${color}40`,
            color: "white",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          {initials(player.name)}
        </div>

        {/* C / VC badge */}
        {(isCap || isVC) && (
          <div
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-md"
            style={{
              background: isCap ? "#ffd900" : "#888",
              color: isCap ? "#000" : "white",
            }}
          >
            {isCap ? "C" : "V"}
          </div>
        )}

        {/* Remove overlay */}
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ background: "rgba(229,57,53,0.85)" }}>
          <span className="text-white font-black text-lg">×</span>
        </div>
      </div>

      <p className="text-white text-[9px] font-bold text-center leading-tight max-w-[52px] truncate"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
        {displayName}
      </p>
      <p className="text-[8px] font-bold text-center" style={{ color, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
        {player.credit_value}
      </p>
    </button>
  );
}

export default function SelectedTeamPitch() {
  const store = useTeamBuilderStore();
  const selectedPlayers = store.selectedPlayers();
  const captainId = store.captainId();
  const vcId = store.vcId();

  const byRole = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = selectedPlayers.filter((p) => p.role === role);
    return acc;
  }, {} as Record<PlayerRole, typeof selectedPlayers>);

  const isEmpty = selectedPlayers.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Cricket ground — Dream11 style bright green */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0f3320 0%, #1a4731 30%, #1d5237 50%, #1a4731 70%, #0f3320 100%)",
        }}
      >
        {/* Outfield boundary circle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="absolute rounded-full"
            style={{
              width: "88%",
              paddingBottom: "88%",
              border: "1px solid rgba(255,255,255,0.12)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: "55%",
              paddingBottom: "55%",
              border: "1px solid rgba(255,255,255,0.08)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        {/* Pitch strip */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            top: "10%",
            bottom: "10%",
            width: "32px",
            background: "linear-gradient(180deg, transparent, rgba(210,175,100,0.25) 15%, rgba(225,190,120,0.45) 50%, rgba(210,175,100,0.25) 85%, transparent)",
            borderRadius: "4px",
          }}
        />
        {/* Crease lines */}
        <div className="absolute left-1/2 -translate-x-1/2 h-px w-14 pointer-events-none"
          style={{ top: "22%", background: "rgba(255,255,255,0.18)" }} />
        <div className="absolute left-1/2 -translate-x-1/2 h-px w-14 pointer-events-none"
          style={{ bottom: "22%", background: "rgba(255,255,255,0.18)" }} />

        {isEmpty ? (
          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 text-3xl"
              style={{ border: "2px dashed rgba(255,255,255,0.20)", background: "rgba(0,0,0,0.20)" }}>
              🏏
            </div>
            <p className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.60)" }}>No players yet</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>Select players in the Players tab</p>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col justify-around h-full py-4 gap-2">
            {ROLE_ORDER.map((role) => {
              const players = byRole[role];
              if (players.length === 0) return null;
              return (
                <div key={role} className="flex flex-col items-center gap-1.5">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.50)", color: "rgba(255,255,255,0.50)" }}
                  >
                    {ROLE_LABEL[role]}
                  </span>
                  <div className="flex items-center justify-center gap-4 flex-wrap px-4">
                    {players.map((p) => (
                      <PlayerDot
                        key={p.id}
                        player={p as { id: string; name: string; ipl_team: string; credit_value: number }}
                        isCap={captainId === p.id}
                        isVC={vcId === p.id}
                        onRemove={(id) => store.removePlayer(id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role summary bar */}
      {!isEmpty && (
        <div
          className="flex items-center justify-around px-4 py-2.5 border-t flex-shrink-0"
          style={{ background: "#0a0a0a", borderColor: "#1a1a1a" }}
        >
          {[...ROLE_ORDER].reverse().map((role) => (
            <div key={role} className="flex flex-col items-center gap-0.5">
              <span className="text-white font-black text-sm leading-none">{byRole[role].length}</span>
              <span className="text-[8px] font-black uppercase" style={{ color: "rgba(255,255,255,0.30)" }}>{role}</span>
            </div>
          ))}
          <div className="w-px h-6" style={{ background: "#1a1a1a" }} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-black text-sm leading-none" style={{ color: "#e53935" }}>
              {selectedPlayers.length}
            </span>
            <span className="text-[8px] font-black uppercase" style={{ color: "rgba(255,255,255,0.30)" }}>
              Selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
