"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shortTeam, TEAM_COLORS, cn } from "@/lib/utils/format";
import toast, { Toaster } from "react-hot-toast";

const MAX_TEAMS_PER_CONTEST = 3;

const TYPE_TABS = [
  { id: "all",     label: "All" },
  { id: "mega",    label: "Mega" },
  { id: "small",   label: "Small" },
  { id: "h2h",     label: "H2H" },
  { id: "private", label: "Private" },
];

const TYPE_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  mega:    { color: "#C084FC", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.25)", label: "MEGA" },
  small:   { color: "#3FEFB4", bg: "rgba(63,239,180,0.08)", border: "rgba(63,239,180,0.20)", label: "SMALL" },
  h2h:     { color: "#F7A325", bg: "rgba(247,163,37,0.10)", border: "rgba(247,163,37,0.25)", label: "H2H" },
  private: { color: "#8A95A8", bg: "rgba(138,149,168,0.08)", border: "rgba(138,149,168,0.20)", label: "PRIVATE" },
};

function formatPrize(amount: number): string {
  if (amount >= 1_000_000) return `₹${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount}`;
}

type Entry = { id: string; contest_id: string; team_id: string | null; team_name: string | null };
type Team  = { id: string; team_name: string; captain: { name: string } | null; vc: { name: string } | null };

export default function ContestBrowseClient({
  match,
  contests,
  myTeams,
  myEntries,
  userId,
}: {
  match: any;
  contests: any[];
  myTeams: Team[];
  myEntries: Entry[];
  userId: string;
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState("all");

  const [joiningContestId, setJoiningContestId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId]     = useState<string | null>(null);
  const [joinLoading, setJoinLoading]           = useState(false);
  const [switchingEntry, setSwitchingEntry]     = useState<Entry | null>(null);
  const [switchTeamId, setSwitchTeamId]         = useState<string | null>(null);
  const [switchLoading, setSwitchLoading]       = useState(false);

  const filtered = typeFilter === "all" ? contests : contests.filter((c) => c.contest_type === typeFilter);
  const matchIsOpen = match.status === "open";

  const entriesByContest = myEntries.reduce<Record<string, Entry[]>>((acc, e) => {
    if (!acc[e.contest_id]) acc[e.contest_id] = [];
    acc[e.contest_id].push(e);
    return acc;
  }, {});

  const joinedTeamIds = new Set(
    joiningContestId ? (entriesByContest[joiningContestId] ?? []).map((e) => e.team_id) : []
  );
  const availableTeams = myTeams.filter((t) => !joinedTeamIds.has(t.id));

  async function handleJoin() {
    if (!joiningContestId || !selectedTeamId) return;
    setJoinLoading(true);
    try {
      const res = await fetch("/api/contests/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contest_id: joiningContestId, team_id: selectedTeamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Joined! Good luck 🏏");
      setJoiningContestId(null);
      setSelectedTeamId(null);
      setTimeout(() => { window.location.reload(); }, 700);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to join");
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleSwitch() {
    if (!switchingEntry || !switchTeamId) return;
    setSwitchLoading(true);
    try {
      const res = await fetch("/api/contests/switch-team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: switchingEntry.id, new_team_id: switchTeamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Team switched!");
      setSwitchingEntry(null);
      setSwitchTeamId(null);
      setTimeout(() => { window.location.reload(); }, 700);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to switch team");
    } finally {
      setSwitchLoading(false);
    }
  }

  function openJoinSheet(contestId: string) {
    const alreadyJoined = new Set((entriesByContest[contestId] ?? []).map((e) => e.team_id));
    const first = myTeams.find((t) => !alreadyJoined.has(t.id));
    setSelectedTeamId(first?.id ?? null);
    setJoiningContestId(contestId);
  }

  function openSwitchSheet(entry: Entry) {
    const otherTeam = myTeams.find((t) => t.id !== entry.team_id);
    setSwitchTeamId(otherTeam?.id ?? null);
    setSwitchingEntry(entry);
  }

  const homeShort  = shortTeam(match.team_home);
  const awayShort  = shortTeam(match.team_away);
  const homeColor  = TEAM_COLORS[homeShort] ?? "#3FEFB4";
  const awayColor  = TEAM_COLORS[awayShort] ?? "#F7A325";

  return (
    <div className="max-w-lg mx-auto pb-32" style={{ background: "#0B0E14", minHeight: "100vh" }}>
      <Toaster
        position="top-center"
        toastOptions={{ style: { background: "#1C2333", color: "#F0F4FF", border: "1px solid #252D3D" } }}
      />

      {/* ── Sticky sub-header ── */}
      <div
        className="sticky top-14 z-30"
        style={{ background: "#0B0E14", borderBottom: "1px solid #252D3D" }}
      >
        {/* Team color accent bar */}
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${homeColor}, ${awayColor})` }} />

        {/* Match label + team builder CTA */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border"
                style={{ borderColor: homeColor, background: homeColor + "22", color: homeColor }}
              >
                {homeShort.slice(0, 2)}
              </div>
              <span className="text-white font-rajdhani font-bold text-sm">{homeShort}</span>
            </div>
            <span className="text-[#4A5568] text-[10px] font-bold">vs</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-rajdhani font-bold text-sm">{awayShort}</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border"
                style={{ borderColor: awayColor, background: awayColor + "22", color: awayColor }}
              >
                {awayShort.slice(0, 2)}
              </div>
            </div>
            <span className="text-[10px] ml-1" style={{ color: "#4A5568" }}>
              · {filtered.length} contest{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {matchIsOpen && (
            <Link
              href={`/team-builder/${match.id}`}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "rgba(63,239,180,0.10)", color: "#3FEFB4", border: "1px solid rgba(63,239,180,0.25)" }}
            >
              + Team
            </Link>
          )}
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
          {TYPE_TABS.map((t) => {
            const count = t.id === "all" ? contests.length : contests.filter((c) => c.contest_type === t.id).length;
            if (count === 0 && t.id !== "all") return null;
            const active = typeFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                style={
                  active
                    ? { background: "#3FEFB4", color: "#0B0E14" }
                    : { border: "1px solid #252D3D", color: "#8A95A8", background: "transparent" }
                }
              >
                {t.label}
                {count > 0 && (
                  <span className="ml-1 opacity-60">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── No team warning ── */}
      {myTeams.length === 0 && (
        <div
          className="mx-4 mt-4 flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: "rgba(63,239,180,0.06)", border: "1px solid rgba(63,239,180,0.20)" }}
        >
          <div>
            <p className="text-white font-bold text-sm">No team yet</p>
            <p className="text-xs mt-0.5" style={{ color: "#8A95A8" }}>Build a team to join any contest</p>
          </div>
          <Link
            href={`/team-builder/${match.id}`}
            className="font-rajdhani font-bold text-sm px-4 py-2 rounded-xl"
            style={{ background: "#3FEFB4", color: "#0B0E14" }}
          >
            Build →
          </Link>
        </div>
      )}

      {/* ── Contest list ── */}
      <div className="px-4 pt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{ background: "#141920", border: "1px solid #252D3D" }}
            >
              🏆
            </div>
            <p className="text-white font-rajdhani font-bold text-base">No contests yet</p>
            <p className="text-xs mt-1" style={{ color: "#8A95A8" }}>Admin needs to create contests for this match</p>
          </div>
        )}

        {filtered.map((c) => {
          const spotsLeft       = (c.max_teams ?? 0) - (c.entry_count ?? 0);
          const fillPct         = c.max_teams > 0 ? Math.min(100, ((c.entry_count ?? 0) / c.max_teams) * 100) : 0;
          const winnersCount    = c.winners_count ?? 1;
          const winPct          = c.max_teams > 0 ? Math.round((winnersCount / c.max_teams) * 100) : null;
          const isFull          = spotsLeft <= 0;
          const isAlmostFull    = spotsLeft > 0 && spotsLeft <= Math.ceil((c.max_teams ?? 10) * 0.1);
          const isMega          = c.contest_type === "mega";
          const meta            = TYPE_META[c.contest_type] ?? TYPE_META.small;
          const myContestEntries = entriesByContest[c.id] ?? [];
          const entryCount      = myContestEntries.length;
          const atLimit         = entryCount >= MAX_TEAMS_PER_CONTEST;
          const canJoinMore     = matchIsOpen && !isFull && myTeams.length > entryCount && !atLimit;
          const hasUnjoinedTeams = myTeams.some((t) => !myContestEntries.find((e) => e.team_id === t.id));

          // Fill bar color
          const barColor = isFull || isAlmostFull ? "#FF3B3B"
            : fillPct > 70 ? "#F7A325"
            : isMega ? "#C084FC"
            : "#3FEFB4";

          return (
            <div
              key={c.id}
              className="rounded-2xl overflow-hidden card-press cursor-pointer"
              style={{
                background:  isMega ? "linear-gradient(160deg, #160D2B 0%, #141920 100%)" : "#141920",
                border:      `1px solid ${entryCount > 0 ? "rgba(63,239,180,0.30)" : isMega ? "rgba(192,132,252,0.20)" : "#252D3D"}`,
              }}
              onClick={() => router.push(`/contests/${c.id}`)}
            >
              {/* Guaranteed prize banner */}
              {c.guaranteed_pool && (
                <div
                  className="flex items-center gap-1.5 px-4 py-1.5"
                  style={{ background: "rgba(33,197,93,0.08)", borderBottom: "1px solid rgba(33,197,93,0.15)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="#21C55D" strokeWidth="1.5" />
                    <path d="M3.5 6l2 2 3-3" stroke="#21C55D" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#21C55D" }}>
                    Guaranteed Prize Pool
                  </span>
                </div>
              )}

              {/* Mega accent bar */}
              {isMega && (
                <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #C084FC, #818CF8)" }} />
              )}

              <div className="p-4">
                {/* Row 1: type badge + name + joined badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    {meta.label}
                  </span>
                  <p className="text-white font-rajdhani font-bold text-sm leading-tight truncate flex-1">{c.name}</p>
                  {entryCount > 0 && (
                    <span
                      className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: "#3FEFB4", background: "rgba(63,239,180,0.10)", border: "1px solid rgba(63,239,180,0.25)" }}
                    >
                      ✓ {entryCount}
                    </span>
                  )}
                </div>

                {/* Row 2: Prize + Entry Fee */}
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p
                      className="font-rajdhani font-black leading-none"
                      style={{ fontSize: 26, color: isMega ? "#C084FC" : "#F7A325", letterSpacing: "-0.02em" }}
                    >
                      {formatPrize(
                        c.prize_pool > 0
                          ? c.prize_pool
                          : Math.floor((c.entry_count ?? 0) * c.entry_fee * 0.9)
                      )}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "#4A5568" }}>Prize Pool</p>
                  </div>
                  <div className="text-right">
                    <p className="font-rajdhani font-bold text-base leading-none" style={{ color: c.entry_fee === 0 ? "#3FEFB4" : "#F0F4FF" }}>
                      {c.entry_fee === 0 ? "FREE" : `₹${c.entry_fee.toLocaleString("en-IN")}`}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "#4A5568" }}>Entry</p>
                  </div>
                </div>

                {/* Win% meta */}
                {winPct !== null && winPct > 0 && (
                  <p className="text-xs mb-3" style={{ color: "#4A5568" }}>
                    Top <span style={{ color: "#8A95A8", fontWeight: 600 }}>{winPct}%</span> win ·{" "}
                    <span style={{ color: "#8A95A8", fontWeight: 600 }}>{winnersCount}</span> winner{winnersCount !== 1 ? "s" : ""}
                  </p>
                )}

                {/* Entered teams */}
                {entryCount > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {myContestEntries.map((entry) => {
                      const team = myTeams.find((t) => t.id === entry.team_id);
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl"
                          style={{ background: "rgba(63,239,180,0.06)", border: "1px solid rgba(63,239,180,0.15)" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span style={{ color: "#3FEFB4", fontSize: 10 }}>✓</span>
                            <span className="text-xs font-semibold truncate" style={{ color: "#3FEFB4" }}>
                              {team?.team_name ?? entry.team_name ?? "My Team"}
                            </span>
                            {team?.captain && (
                              <span className="text-[10px] shrink-0" style={{ color: "#4A5568" }}>
                                C: {team.captain.name.split(" ").pop()}
                              </span>
                            )}
                          </div>
                          {matchIsOpen && myTeams.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openSwitchSheet(entry); }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ml-2 transition-opacity hover:opacity-80"
                              style={{ color: "#8A95A8", border: "1px solid #252D3D", background: "transparent" }}
                            >
                              Switch
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fill bar */}
                <div className="mb-3">
                  <div className="h-1 rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${fillPct}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px]" style={{ color: "#4A5568" }}>
                      <span style={{ color: "#8A95A8", fontWeight: 600 }}>{c.entry_count ?? 0}</span> joined
                    </span>
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: isFull ? "#FF3B3B" : isAlmostFull ? "#F7A325" : "#4A5568" }}
                    >
                      {isFull ? "FULL" : `${spotsLeft} spots left`}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {!matchIsOpen ? (
                    <span
                      className="text-xs font-bold px-4 py-2 rounded-xl"
                      style={{ color: "#4A5568", border: "1px solid #252D3D", background: "transparent" }}
                    >
                      {match.status === "locked" ? "🔒 Locked" : match.status === "live" ? "View Live →" : "Closed"}
                    </span>
                  ) : isFull ? (
                    <span className="text-xs font-bold px-4 py-2 rounded-xl" style={{ color: "#4A5568", border: "1px solid #252D3D" }}>
                      Full
                    </span>
                  ) : myTeams.length === 0 ? (
                    <Link
                      href={`/team-builder/${match.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-rajdhani font-bold text-sm px-5 py-2 rounded-xl"
                      style={{ background: "#3FEFB4", color: "#0B0E14" }}
                    >
                      Build Team
                    </Link>
                  ) : canJoinMore && hasUnjoinedTeams ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); openJoinSheet(c.id); }}
                      className="font-rajdhani font-bold text-sm px-5 py-2 rounded-xl transition-opacity hover:opacity-90"
                      style={{
                        background: entryCount > 0 ? "#21C55D" : isMega ? "#A855F7" : "#3FEFB4",
                        color: "#0B0E14",
                      }}
                    >
                      {entryCount > 0 ? "+ Add Team" : "Join →"}
                    </button>
                  ) : atLimit ? (
                    <span className="text-xs font-bold px-4 py-2 rounded-xl" style={{ color: "#4A5568", border: "1px solid #252D3D" }}>
                      Max {MAX_TEAMS_PER_CONTEST} teams
                    </span>
                  ) : entryCount > 0 ? null : (
                    <button
                      onClick={(e) => { e.stopPropagation(); openJoinSheet(c.id); }}
                      className="font-rajdhani font-bold text-sm px-5 py-2 rounded-xl transition-opacity hover:opacity-90"
                      style={{ background: isMega ? "#A855F7" : "#3FEFB4", color: "#0B0E14" }}
                    >
                      Join →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Join bottom sheet ── */}
      {joiningContestId && (
        <div className="fixed inset-0 z-[60] flex items-end" onClick={() => setJoiningContestId(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4"
            style={{ background: "#141920", border: "1px solid #252D3D", borderBottom: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "#252D3D" }} />

            <div className="text-center">
              <h3 className="text-white font-rajdhani font-bold text-lg">Select Team</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "#8A95A8" }}>
                Choose a team · max {MAX_TEAMS_PER_CONTEST} per contest
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableTeams.length === 0 && (
                <p className="text-center text-sm py-4" style={{ color: "#4A5568" }}>
                  All your teams have already joined this contest
                </p>
              )}
              {availableTeams.map((t) => {
                const isSelected = selectedTeamId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl transition-all"
                    style={{
                      background:  isSelected ? "rgba(63,239,180,0.08)" : "#1C2333",
                      border:      `1px solid ${isSelected ? "rgba(63,239,180,0.40)" : "#252D3D"}`,
                    }}
                  >
                    <div className="text-left">
                      <p className="text-white font-bold text-sm">{t.team_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
                        C: {t.captain?.name ?? "—"} · VC: {t.vc?.name ?? "—"}
                      </p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background:   isSelected ? "#3FEFB4" : "transparent",
                        borderColor:  isSelected ? "#3FEFB4" : "#252D3D",
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="#0B0E14" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {matchIsOpen && (
              <Link
                href={`/team-builder/${match.id}`}
                className="block text-center text-sm font-bold py-1"
                style={{ color: "#3FEFB4" }}
              >
                + Create Another Team
              </Link>
            )}

            <button
              onClick={handleJoin}
              disabled={!selectedTeamId || joinLoading || availableTeams.length === 0}
              className="w-full font-rajdhani font-bold py-4 rounded-2xl text-base transition-opacity disabled:opacity-40"
              style={{ background: "#3FEFB4", color: "#0B0E14" }}
            >
              {joinLoading ? "Joining…" : "Confirm & Join"}
            </button>
          </div>
        </div>
      )}

      {/* ── Switch team bottom sheet ── */}
      {switchingEntry && (
        <div className="fixed inset-0 z-[60] flex items-end" onClick={() => setSwitchingEntry(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4"
            style={{ background: "#141920", border: "1px solid #252D3D", borderBottom: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "#252D3D" }} />

            <div className="text-center">
              <h3 className="text-white font-rajdhani font-bold text-lg">Switch Team</h3>
              <p className="text-xs mt-0.5" style={{ color: "#8A95A8" }}>Replace your current entry with a different team</p>
            </div>

            {/* Current team */}
            {(() => {
              const current = myTeams.find((t) => t.id === switchingEntry.team_id);
              return current ? (
                <div
                  className="px-3 py-2.5 rounded-xl text-center"
                  style={{ background: "#1C2333", border: "1px solid #252D3D" }}
                >
                  <p className="text-[10px] uppercase font-bold mb-0.5" style={{ color: "#4A5568" }}>Current</p>
                  <p className="text-white font-bold text-sm">{current.team_name}</p>
                  <p className="text-xs" style={{ color: "#4A5568" }}>C: {current.captain?.name ?? "—"}</p>
                </div>
              ) : null;
            })()}

            <div className="text-center text-xs" style={{ color: "#4A5568" }}>↓ Switch to</div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {myTeams.filter((t) => t.id !== switchingEntry.team_id).map((t) => {
                const isSelected = switchTeamId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSwitchTeamId(t.id)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl transition-all"
                    style={{
                      background: isSelected ? "rgba(63,239,180,0.08)" : "#1C2333",
                      border:     `1px solid ${isSelected ? "rgba(63,239,180,0.40)" : "#252D3D"}`,
                    }}
                  >
                    <div className="text-left">
                      <p className="text-white font-bold text-sm">{t.team_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#4A5568" }}>
                        C: {t.captain?.name ?? "—"} · VC: {t.vc?.name ?? "—"}
                      </p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background:  isSelected ? "#3FEFB4" : "transparent",
                        borderColor: isSelected ? "#3FEFB4" : "#252D3D",
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="#0B0E14" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSwitch}
              disabled={!switchTeamId || switchLoading}
              className="w-full font-rajdhani font-bold py-4 rounded-2xl text-base transition-opacity disabled:opacity-40"
              style={{ background: "#3FEFB4", color: "#0B0E14" }}
            >
              {switchLoading ? "Switching…" : "Confirm Switch"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
