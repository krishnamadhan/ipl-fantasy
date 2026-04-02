"use client";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import { cn, shortTeam, TEAM_COLORS } from "@/lib/utils/format";

function initials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_COLOR: Record<string, string> = {
  WK: "text-purple-400",
  BAT: "text-blue-400",
  AR: "text-green-400",
  BOWL: "text-orange-400",
};

export default function CaptainPicker() {
  const store = useTeamBuilderStore();
  const selectedPlayers = store.selectedPlayers();
  const captainId = store.captainId();
  const vcId = store.vcId();

  if (selectedPlayers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-8">
        <div className="w-16 h-16 rounded-full border-2 border-brand/30 flex items-center justify-center mb-3">
          <span className="text-3xl">👑</span>
        </div>
        <p className="text-white font-bold text-base">Select 11 players first</p>
        <p className="text-slate-500 text-sm mt-1">Then come here to pick your C & VC</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Info banner */}
      <div
        className="mx-4 mt-4 mb-3 rounded-2xl p-4 border border-brand/20"
        style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.10) 0%, rgba(245,166,35,0.04) 100%)" }}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
              <span className="text-white text-sm font-black">C</span>
            </div>
            <div>
              <p className="text-white font-black text-sm">Captain</p>
              <p className="text-brand font-black text-xs">2× Points</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center shadow-md">
              <span className="text-white text-xs font-black">VC</span>
            </div>
            <div>
              <p className="text-white font-black text-sm">Vice Captain</p>
              <p className="text-slate-400 font-black text-xs">1.5× Points</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-2 pb-4">
        {selectedPlayers.map((p) => {
          const isCap = captainId === p.id;
          const isVC = vcId === p.id;
          const teamShort = shortTeam(p.ipl_team);
          const color = TEAM_COLORS[teamShort] ?? "#475569";

          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-3 border transition-all",
                isCap
                  ? "border-brand/60 shadow-lg shadow-brand/10"
                  : isVC
                  ? "border-slate-500/50"
                  : "border-slate-700/60"
              )}
              style={{
                background: isCap
                  ? "linear-gradient(135deg, rgba(245,166,35,0.12) 0%, #111827 100%)"
                  : isVC
                  ? "rgba(100,116,139,0.12)"
                  : "#111827",
              }}
            >
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black border-2 shrink-0 shadow-md"
                style={{
                  borderColor: color,
                  background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
                  color: "white",
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                }}
              >
                {initials(p.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={cn("font-bold text-sm truncate", isCap ? "text-brand" : "text-white")}>
                  {p.name}
                </p>
                <p className={cn("text-xs mt-0.5", ROLE_COLOR[p.role] ?? "text-slate-400")}>
                  {p.role} · {teamShort} · {p.credit_value}cr
                </p>
              </div>

              {/* C / VC buttons */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => store.setCaptain(p.id)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all border-2",
                    isCap
                      ? "bg-brand border-brand text-white shadow-md shadow-brand/40"
                      : "border-slate-600 text-slate-400 hover:border-brand/60 hover:text-brand"
                  )}
                >
                  C
                </button>
                <button
                  onClick={() => store.setVC(p.id)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black transition-all border-2",
                    isVC
                      ? "bg-slate-500 border-slate-400 text-white shadow-md"
                      : "border-slate-600 text-slate-400 hover:border-slate-400"
                  )}
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
