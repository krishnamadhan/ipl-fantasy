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
  // Last name for display (shorter)
  const displayName = player.name.trim().split(" ").slice(-1)[0];

  return (
    <button
      onClick={() => onRemove(player.id)}
      className="flex flex-col items-center gap-0.5 group"
      title={`Remove ${player.name}`}
    >
      <div className="relative">
        {/* Outer glow ring for C/VC */}
        {isCap && (
          <div className="absolute inset-0 rounded-full animate-pulse"
            style={{ boxShadow: `0 0 0 3px #F5A623, 0 0 12px #F5A62380` }} />
        )}
        {isVC && !isCap && (
          <div className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 2px #94A3B8` }} />
        )}

        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-black border-2 transition-transform group-hover:scale-105 shadow-lg select-none"
          style={{
            borderColor: color,
            background: `linear-gradient(135deg, ${color}44 0%, ${color}22 100%)`,
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {initials(player.name)}
        </div>

        {/* C / VC badge */}
        {(isCap || isVC) && (
          <div
            className={cn(
              "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-md",
              isCap ? "bg-brand text-white" : "bg-slate-500 text-white"
            )}
          >
            {isCap ? "C" : "V"}
          </div>
        )}

        {/* Remove hint on hover */}
        <div className="absolute inset-0 rounded-full bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white font-black text-lg">×</span>
        </div>
      </div>

      <p
        className="text-white text-[9px] font-bold text-center leading-tight max-w-[52px] truncate"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {displayName}
      </p>
      <p
        className="text-[8px] font-bold text-center"
        style={{ color, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
      >
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
      {/* Cricket ground */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #071507 0%, #0e2610 40%, #0a1e0a 60%, #071507 100%)",
        }}
      >
        {/* Ground circle (outfield boundary) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 0 }}
        >
          <div
            className="rounded-full border opacity-10"
            style={{
              width: "85%",
              paddingBottom: "85%",
              borderColor: "rgba(255,255,255,0.5)",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <div
            className="rounded-full border opacity-[0.06]"
            style={{
              width: "60%",
              paddingBottom: "60%",
              borderColor: "rgba(255,255,255,0.5)",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        {/* Central pitch strip */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            top: "8%",
            bottom: "8%",
            width: "36px",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(180,140,80,0.15) 8%, rgba(196,162,85,0.35) 25%, rgba(210,175,100,0.45) 50%, rgba(196,162,85,0.35) 75%, rgba(180,140,80,0.15) 92%, transparent 100%)",
            borderRadius: "6px",
            zIndex: 1,
          }}
        />

        {/* Crease lines at pitch ends */}
        <div
          className="absolute left-1/2 -translate-x-1/2 h-px w-16 pointer-events-none"
          style={{ top: "20%", background: "rgba(255,255,255,0.15)", zIndex: 1 }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 h-px w-16 pointer-events-none"
          style={{ bottom: "20%", background: "rgba(255,255,255,0.15)", zIndex: 1 }}
        />

        {isEmpty ? (
          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8">
            <div
              className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-3"
            >
              <span className="text-3xl">🏏</span>
            </div>
            <p className="text-white/70 font-bold text-sm">No players yet</p>
            <p className="text-white/30 text-xs mt-1">Select players in the Players tab</p>
          </div>
        ) : (
          <div
            className="relative z-10 flex flex-col justify-around h-full py-4 gap-2"
            style={{ zIndex: 2 }}
          >
            {ROLE_ORDER.map((role) => {
              const players = byRole[role];
              if (players.length === 0) return null;
              return (
                <div key={role} className="flex flex-col items-center gap-1">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.5)" }}
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
          className="flex items-center justify-around px-4 py-2.5 border-t border-slate-800/60 flex-shrink-0"
          style={{ background: "#0a1015" }}
        >
          {[...ROLE_ORDER].reverse().map((role) => (
            <div key={role} className="flex flex-col items-center gap-0.5">
              <span className="text-white font-black text-sm leading-none">
                {byRole[role].length}
              </span>
              <span className="text-slate-600 text-[8px] font-bold uppercase">{role}</span>
            </div>
          ))}
          <div className="w-px h-6 bg-slate-800" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-brand font-black text-sm leading-none">
              {selectedPlayers.length}
            </span>
            <span className="text-slate-600 text-[8px] font-bold uppercase">Selected</span>
          </div>
        </div>
      )}
    </div>
  );
}
