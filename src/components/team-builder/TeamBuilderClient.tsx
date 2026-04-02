"use client";
import { useState, useEffect } from "react";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import PlayerSelector, { type PlayerWithMeta } from "./PlayerSelector";
import SelectedTeamPitch from "./SelectedTeamPitch";
import CaptainPicker from "./CaptainPicker";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import type { IplMatch } from "@/types/match";
import { shortTeam, cn } from "@/lib/utils/format";

type Tab = "players" | "team" | "captain";

export default function TeamBuilderClient({
  match,
  players,
  userId,
  existingTeamCount = 0,
}: {
  match: IplMatch;
  players: PlayerWithMeta[];
  userId: string;
  existingTeamCount?: number;
}) {
  const [tab, setTab] = useState<Tab>("players");
  const [saving, setSaving] = useState(false);
  const store = useTeamBuilderStore();
  const router = useRouter();

  useEffect(() => {
    store.setMatchId(match.id);
    store.setMatchTeams({ home: match.team_home, away: match.team_away });
  }, [match.id]);

  const activeIndex = store.activeIndex;
  const drafts = store.drafts;
  const selected = store.selectedPlayers();
  const count = selected.length;
  const credits = store.totalCredits();
  const creditsLeft = 100 - credits;
  const errors = store.getErrors();
  const captainId = store.captainId();
  const vcId = store.vcId();

  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
  selected.forEach((p) => { roleCounts[p.role as keyof typeof roleCounts]++; });

  const CONSTRAINTS = [
    { role: "WK",   min: 1, max: 8, count: roleCounts.WK,   color: "text-purple-400", active: "bg-purple-500" },
    { role: "BAT",  min: 1, max: 8, count: roleCounts.BAT,  color: "text-blue-400",   active: "bg-blue-500" },
    { role: "AR",   min: 1, max: 8, count: roleCounts.AR,   color: "text-green-400",  active: "bg-green-500" },
    { role: "BOWL", min: 1, max: 8, count: roleCounts.BOWL, color: "text-orange-400", active: "bg-orange-500" },
  ];

  async function handleSave() {
    if (errors.length > 0) { toast.error(errors[0]); return; }
    setSaving(true);
    try {
      const draft = store.active();
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: match.id,
          player_ids: draft.selectedPlayers.map((p) => p.id),
          captain_id: draft.captainId,
          vc_id: draft.vcId,
          team_name: draft.teamName,
          team_id: draft.savedTeamId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      store.loadDraft(activeIndex, { savedTeamId: data.team.id });
      toast.success("Team saved!");
      setTimeout(() => router.push(`/contests/browse/${match.id}`), 800);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Determine footer state
  const footerState: "select" | "captain" | "save" =
    count < 11 ? "select" : !captainId || !vcId ? "captain" : "save";

  return (
    <div className="max-w-lg mx-auto h-[100dvh] flex flex-col" style={{ background: "#080d1a" }}>
      <Toaster position="top-center" toastOptions={{ style: { background: "#1E293B", color: "white", border: "1px solid #334155" } }} />

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #0d1b2a 0%, #080d1a 100%)", borderColor: "rgba(255,255,255,0.06)" }}
        className="border-b px-4 pt-3 pb-0 flex-shrink-0">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>

          <div className="text-center">
            <p className="text-white font-black text-sm tracking-wide">
              {shortTeam(match.team_home)} <span className="text-slate-500">vs</span> {shortTeam(match.team_away)}
            </p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">Create Team</p>
          </div>

          {/* Credits */}
          <div className={cn(
            "text-right px-3 py-1 rounded-xl border",
            creditsLeft < 0 ? "border-red-500/40 bg-red-500/10" : "border-brand/30 bg-brand/5"
          )}>
            <p className={cn("font-black text-base leading-none", creditsLeft < 0 ? "text-red-400" : "text-brand")}>
              {creditsLeft.toFixed(1)}
            </p>
            <p className="text-slate-500 text-[9px] uppercase">Credits</p>
          </div>
        </div>

        {/* Multi-team tabs + credit bar */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex gap-1.5 flex-1">
            {drafts.map((_, i) => (
              <button key={i} onClick={() => store.setActiveIndex(i)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-black border transition",
                  activeIndex === i
                    ? "bg-brand border-brand text-white shadow-lg shadow-brand/20"
                    : "border-slate-700 text-slate-500 bg-transparent hover:border-slate-500"
                )}>
                T{i + 1}
              </button>
            ))}
            {drafts.length < 6 && (existingTeamCount + drafts.length) < 6 && (
              <button onClick={() => store.addNewDraft()}
                className="w-7 h-7 rounded-full border-2 border-dashed border-slate-600 text-slate-500 text-sm flex items-center justify-center hover:border-brand hover:text-brand transition">
                +
              </button>
            )}
          </div>
          <div className="text-right">
            <span className="text-white text-xs font-bold">{count}</span>
            <span className="text-slate-600 text-xs">/11</span>
          </div>
        </div>

        {/* Credit bar */}
        <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className={cn("h-full rounded-full transition-all duration-300", credits > 100 ? "bg-red-500" : "bg-brand")}
            style={{ width: `${Math.min(100, (credits / 100) * 100)}%` }}
          />
        </div>

        {/* Role constraints */}
        <div className="flex gap-2 pb-1">
          {CONSTRAINTS.map(({ role, min, count: c, color, active }) => {
            const met = c >= min;
            const over = c > min;
            return (
              <div key={role} className={cn(
                "flex-1 rounded-xl p-2 text-center border transition",
                met ? "bg-slate-800/60 border-slate-700" : "bg-slate-900 border-slate-800"
              )}>
                <p className={cn("text-[10px] font-black", met ? color : "text-slate-600")}>{role}</p>
                <p className="text-[11px] font-bold mt-0.5">
                  <span className={met ? "text-white" : "text-slate-600"}>{c}</span>
                  <span className="text-slate-600 text-[9px]">/{min}+</span>
                </p>
                <div className="mt-1 flex gap-0.5 justify-center">
                  {Array.from({ length: Math.max(min, c) }).map((_, i) => (
                    <div key={i} className={cn(
                      "h-0.5 flex-1 rounded-full max-w-[8px]",
                      i < c ? active : "bg-slate-700"
                    )} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab bar */}
        <div className="flex -mx-4 border-t border-slate-800 mt-1">
          {(["players", "team", "captain"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2",
                tab === t ? "text-brand border-brand" : "text-slate-600 border-transparent hover:text-slate-400"
              )}>
              {t === "players" ? "Players" : t === "team" ? "My Team" : "C / VC"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "players" && (
          <PlayerSelector players={players} teamHome={match.team_home} teamAway={match.team_away} />
        )}
        {tab === "team" && <SelectedTeamPitch />}
        {tab === "captain" && (
          <div className="flex flex-col h-full">
            <CaptainPicker />
            <div className="px-4 pt-2 pb-3">
              <input
                type="text"
                value={store.teamName()}
                onChange={(e) => store.setTeamName(e.target.value)}
                placeholder="Team name (e.g. My Dream Team)"
                className="w-full bg-[#111827] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selected player mini-strip */}
      {count > 0 && tab === "players" && (
        <div
          className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0 border-t"
          style={{ background: "#060b14", borderColor: "rgba(255,255,255,0.06)" }}
        >
          {selected.slice(0, 9).map((p) => {
            const isCap = captainId === p.id;
            const isVC  = vcId === p.id;
            return (
              <div key={p.id} className="flex flex-col items-center gap-0.5 shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black border"
                  style={
                    isCap
                      ? { borderColor: "#F5A623", background: "rgba(245,166,35,0.20)", color: "#F5A623" }
                      : isVC
                      ? { borderColor: "#94A3B8", background: "rgba(148,163,184,0.15)", color: "#CBD5E1" }
                      : { borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "white" }
                  }
                >
                  {p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                </div>
                {(isCap || isVC) && (
                  <span className="text-[7px] font-black" style={{ color: isCap ? "#F5A623" : "#94A3B8" }}>
                    {isCap ? "C" : "VC"}
                  </span>
                )}
              </div>
            );
          })}
          {count > 9 && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 border"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", color: "#64748B" }}
            >
              +{count - 9}
            </div>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div
        className="border-t p-4 space-y-2 flex-shrink-0"
        style={{ background: "#060b14", borderColor: "rgba(255,255,255,0.06)" }}
      >
        {errors.length > 0 && footerState === "save" && (
          <p className="text-red-400 text-xs text-center font-semibold">{errors[0]}</p>
        )}

        {footerState === "select" && (
          <button
            onClick={() => setTab("team")}
            className="w-full text-white font-bold py-4 rounded-2xl text-sm transition"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            Select <span className="text-brand font-black">{11 - count}</span> more player{11 - count !== 1 ? "s" : ""}
          </button>
        )}

        {footerState === "captain" && (
          <button
            onClick={() => setTab("captain")}
            className="w-full py-4 rounded-2xl font-black text-sm text-white transition shadow-lg"
            style={{
              background: "linear-gradient(135deg, rgba(245,166,35,0.15) 0%, rgba(245,166,35,0.05) 100%)",
              border: "2px solid rgba(245,166,35,0.50)",
              color: "#F5A623",
            }}
          >
            Pick Captain &amp; Vice-Captain →
          </button>
        )}

        {footerState === "save" && (
          <button
            onClick={handleSave}
            disabled={saving || errors.length > 0}
            className="w-full text-white font-black py-4 rounded-2xl disabled:opacity-40 transition text-base shadow-xl"
            style={{
              background: saving ? "#6B7280" : "linear-gradient(135deg, #F5A623, #E8950F)",
              boxShadow: saving ? "none" : "0 4px 20px rgba(245,166,35,0.40)",
            }}
          >
            {saving ? "Saving…" : store.active().savedTeamId ? "Update Team →" : "Save Team →"}
          </button>
        )}
      </div>
    </div>
  );
}
