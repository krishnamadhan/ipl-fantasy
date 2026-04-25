"use client";
import { useState, useEffect } from "react";
import { useTeamBuilderStore } from "@/store/useTeamBuilderStore";
import PlayerSelector, { type PlayerWithMeta } from "./PlayerSelector";
import SelectedTeamPitch from "./SelectedTeamPitch";
import CaptainPicker from "./CaptainPicker";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import type { IplMatch } from "@/types/match";
import type { IplPlayer } from "@/types/player";
import { shortTeam, cn } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";

type Tab = "players" | "team" | "captain";

export default function TeamBuilderClient({
  match,
  players,
  userId,
  existingTeamCount = 0,
  editTeam = null,
}: {
  match: IplMatch;
  players: PlayerWithMeta[];
  userId: string;
  existingTeamCount?: number;
  editTeam?: {
    id: string;
    teamName: string;
    selectedPlayers: IplPlayer[];
    captainId: string;
    vcId: string;
  } | null;
}) {
  const [tab, setTab] = useState<Tab>("players");
  const [saving, setSaving] = useState(false);
  const store = useTeamBuilderStore();
  const router = useRouter();

  useEffect(() => {
    store.setMatchId(match.id);
    store.setMatchTeams({ home: match.team_home, away: match.team_away });

    if (editTeam) {
      // Pre-populate store with existing team data
      store.loadDraft(0, {
        selectedPlayers: editTeam.selectedPlayers,
        captainId: editTeam.captainId,
        vcId: editTeam.vcId,
        teamName: editTeam.teamName,
        savedTeamId: editTeam.id,
      });
    }
  }, [match.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh when playing XI is synced after toss
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match-xi-${match.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "f11_match_players", filter: `match_id=eq.${match.id}` },
        () => { router.refresh(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [match.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeIndex = store.activeIndex;
  const drafts = store.drafts;
  const selected = store.selectedPlayers();
  const count = selected.length;
  const credits = store.totalCredits();
  const creditsLeft = 100 - credits;
  const errors = store.getErrors();
  const captainId = store.captainId();
  const vcId = store.vcId();

  const isEditing = !!(editTeam || store.active().savedTeamId);

  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
  selected.forEach((p) => { roleCounts[p.role as keyof typeof roleCounts]++; });

  const ROLE_SLOTS = [
    { role: "WK",   min: 1, max: 8, count: roleCounts.WK   },
    { role: "BAT",  min: 1, max: 8, count: roleCounts.BAT  },
    { role: "AR",   min: 1, max: 8, count: roleCounts.AR   },
    { role: "BOWL", min: 1, max: 8, count: roleCounts.BOWL },
  ];

  const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
    WK:   { bg: "#ffd900", text: "#000" },
    BAT:  { bg: "#4fc3f7", text: "#000" },
    AR:   { bg: "#66bb6a", text: "#000" },
    BOWL: { bg: "#ef5350", text: "#fff" },
  };

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
      toast.success(isEditing ? "Team updated!" : "Team saved!");
      setTimeout(() => { window.location.href = `/contests/browse/${match.id}`; }, 800);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const footerState: "select" | "captain" | "save" =
    count < 11 ? "select" : !captainId || !vcId ? "captain" : "save";

  const homeShort = shortTeam(match.team_home);
  const awayShort = shortTeam(match.team_away);

  return (
    <div className="max-w-lg mx-auto h-[100dvh] flex flex-col" style={{ background: "#000" }}>
      <Toaster
        position="top-center"
        toastOptions={{ style: { background: "#1a1a1a", color: "white", border: "1px solid #333" } }}
      />

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 border-b"
        style={{ background: "linear-gradient(180deg, #1a0000 0%, #0d0d0d 100%)", borderColor: "#222" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-white font-black text-sm tracking-wide uppercase">
              {homeShort} <span className="text-white/30 font-light">vs</span> {awayShort}
            </p>
            <p className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">
              {isEditing ? "Edit Team" : "Create Team"}
            </p>
          </div>

          {/* Credits left */}
          <div
            className="text-right min-w-[56px] px-2.5 py-1.5 rounded-xl"
            style={{
              background: creditsLeft < 5 ? "rgba(229,57,53,0.15)" : "rgba(255,217,0,0.10)",
              border: `1px solid ${creditsLeft < 5 ? "rgba(229,57,53,0.30)" : "rgba(255,217,0,0.25)"}`,
            }}
          >
            <p
              className="font-black text-lg leading-none tabular-nums"
              style={{ color: creditsLeft < 5 ? "#e53935" : "#ffd900" }}
            >
              {creditsLeft.toFixed(1)}
            </p>
            <p className="text-white/40 text-[9px] uppercase tracking-wide">Credits</p>
          </div>
        </div>

        {/* Player count + team tabs */}
        <div className="flex items-center px-4 pb-2 gap-3">
          <div className="flex gap-1.5 flex-1 overflow-x-auto scrollbar-none">
            {!editTeam && drafts.map((_, i) => (
              <button
                key={i}
                onClick={() => store.setActiveIndex(i)}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-black border transition"
                style={{
                  background: activeIndex === i ? "#e53935" : "rgba(255,255,255,0.05)",
                  borderColor: activeIndex === i ? "#e53935" : "rgba(255,255,255,0.10)",
                  color: activeIndex === i ? "white" : "rgba(255,255,255,0.40)",
                }}
              >
                T{i + 1}
              </button>
            ))}
            {!editTeam && drafts.length < 6 && (existingTeamCount + drafts.length) < 6 && (
              <button
                onClick={() => store.addNewDraft()}
                className="w-7 h-7 rounded-full border-2 border-dashed text-white/30 text-sm flex items-center justify-center hover:border-brand hover:text-brand transition shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.20)" }}
              >
                +
              </button>
            )}
          </div>

          {/* Players count badge */}
          <div className="shrink-0 text-right">
            <span
              className="font-black text-sm tabular-nums"
              style={{ color: count === 11 ? "#ffd900" : "white" }}
            >
              {count}
            </span>
            <span className="text-white/30 text-sm">/11</span>
          </div>
        </div>

        {/* Credit progress bar */}
        <div className="mx-4 h-1 rounded-full overflow-hidden mb-2.5" style={{ background: "#2a2a2a" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (credits / 100) * 100)}%`,
              background: credits > 100 ? "#e53935" : credits > 85 ? "#f7b606" : "#22c55e",
            }}
          />
        </div>

        {/* Role slot indicators */}
        <div className="flex px-4 gap-2 pb-2.5">
          {ROLE_SLOTS.map(({ role, min, count: c }) => {
            const badge = ROLE_BADGE[role];
            const met = c >= min;
            return (
              <div
                key={role}
                className="flex-1 flex items-center justify-between rounded-lg px-2.5 py-1.5"
                style={{
                  background: met ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${met ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <span
                  className="text-[9px] font-black px-1 rounded"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {role}
                </span>
                <span className="font-black text-xs" style={{ color: met ? "white" : "rgba(255,255,255,0.25)" }}>
                  {c}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tab bar */}
        <div className="flex border-t" style={{ borderColor: "#1a1a1a" }}>
          {(["players", "team", "captain"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3 text-xs font-black uppercase tracking-wider transition border-b-2"
              style={{
                color: tab === t ? "#e53935" : "rgba(255,255,255,0.35)",
                borderBottomColor: tab === t ? "#e53935" : "transparent",
              }}
            >
              {t === "players" ? "Players" : t === "team" ? "My Team" : "C/VC"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#000" }}>
        {tab === "players" && (
          <PlayerSelector players={players} teamHome={match.team_home} teamAway={match.team_away} tossWinner={match.toss_winner ?? null} />
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
                className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#e53935")}
                onBlur={(e) => (e.target.style.borderColor = "#333")}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Selected player strip (players tab only) ── */}
      {count > 0 && tab === "players" && (
        <div
          className="px-3 py-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0 border-t"
          style={{ background: "#0a0a0a", borderColor: "#1a1a1a" }}
        >
          {selected.slice(0, 9).map((p) => {
            const isCap = captainId === p.id;
            const isVC  = vcId === p.id;
            return (
              <div key={p.id} className="flex flex-col items-center gap-0.5 shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={
                    isCap
                      ? { background: "#ffd900", color: "#000", boxShadow: "0 0 0 2px #ffd900" }
                      : isVC
                      ? { background: "rgba(255,255,255,0.15)", color: "white", boxShadow: "0 0 0 2px #888" }
                      : { background: "rgba(255,255,255,0.10)", color: "white" }
                  }
                >
                  {p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                </div>
                {(isCap || isVC) && (
                  <span className="text-[7px] font-black" style={{ color: isCap ? "#ffd900" : "#888" }}>
                    {isCap ? "C" : "VC"}
                  </span>
                )}
              </div>
            );
          })}
          {count > 9 && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
            >
              +{count - 9}
            </div>
          )}
        </div>
      )}

      {/* ── Footer CTA ── */}
      <div
        className="border-t p-4 flex-shrink-0"
        style={{ background: "#0a0a0a", borderColor: "#1a1a1a" }}
      >
        {errors.length > 0 && footerState === "save" && (
          <p className="text-red-400 text-xs text-center font-semibold mb-2">{errors[0]}</p>
        )}

        {footerState === "select" && (
          <button
            onClick={() => setTab("team")}
            className="w-full py-4 rounded-xl text-sm font-bold transition"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.60)",
            }}
          >
            Select{" "}
            <span className="font-black" style={{ color: "#e53935" }}>
              {11 - count}
            </span>{" "}
            more player{11 - count !== 1 ? "s" : ""}
          </button>
        )}

        {footerState === "captain" && (
          <button
            onClick={() => setTab("captain")}
            className="w-full py-4 rounded-xl font-black text-sm transition"
            style={{
              background: "rgba(255,217,0,0.10)",
              border: "2px solid rgba(255,217,0,0.40)",
              color: "#ffd900",
            }}
          >
            Choose Captain &amp; Vice-Captain →
          </button>
        )}

        {footerState === "save" && (
          <button
            onClick={handleSave}
            disabled={saving || errors.length > 0}
            className="w-full py-4 rounded-xl font-black text-base text-white disabled:opacity-40 transition"
            style={{
              background: saving ? "#555" : "#e53935",
              boxShadow: saving ? "none" : "0 4px 20px rgba(229,57,53,0.40)",
            }}
          >
            {saving ? "Saving…" : isEditing ? "Update Team" : "Save Team →"}
          </button>
        )}
      </div>
    </div>
  );
}
