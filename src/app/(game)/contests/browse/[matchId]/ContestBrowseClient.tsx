"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, shortTeam, TEAM_COLORS, cn } from "@/lib/utils/format";
import toast, { Toaster } from "react-hot-toast";

const TYPE_TABS = [
  { id: "all",     label: "All" },
  { id: "mega",    label: "Mega" },
  { id: "small",   label: "Small" },
  { id: "h2h",     label: "H2H" },
  { id: "private", label: "Private" },
];

const TYPE_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  mega:    { color: "#C084FC", bg: "rgba(192,132,252,0.12)", border: "rgba(192,132,252,0.25)", label: "MEGA" },
  small:   { color: "#60A5FA", bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.20)", label: "SMALL" },
  h2h:     { color: "#34D399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.20)", label: "H2H" },
  private: { color: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.15)", label: "PRIVATE" },
};

function formatPrize(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)} Cr`;
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(1)} L`;
  if (amount >= 1_000)      return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount}`;
}

export default function ContestBrowseClient({
  match,
  contests,
  myTeams,
  userId,
}: {
  match: any;
  contests: any[];
  myTeams: any[];
  userId: string;
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState("all");
  const [joiningContestId, setJoiningContestId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(myTeams[0]?.id ?? null);
  const [joinLoading, setJoinLoading] = useState(false);

  const filtered =
    typeFilter === "all" ? contests : contests.filter((c) => c.contest_type === typeFilter);

  const matchIsOpen = match.status === "open";

  async function handleJoin(contestId: string, teamId: string) {
    setJoinLoading(true);
    try {
      const res = await fetch("/api/contests/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contest_id: contestId, team_id: teamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Joined! Good luck 🏏");
      setJoiningContestId(null);
      setTimeout(() => router.push(`/contests/${contestId}`), 900);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to join");
    } finally {
      setJoinLoading(false);
    }
  }

  const homeShort = shortTeam(match.team_home);
  const awayShort = shortTeam(match.team_away);
  const homeColor = TEAM_COLORS[homeShort] ?? "#F5A623";
  const awayColor = TEAM_COLORS[awayShort] ?? "#3B82F6";

  return (
    <div className="max-w-lg mx-auto pb-32" style={{ background: "#080d1a", minHeight: "100vh" }}>
      <Toaster position="top-center" toastOptions={{ style: { background: "#1E293B", color: "white", border: "1px solid #334155" } }} />

      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 border-b border-white/5"
        style={{ background: "rgba(8, 13, 26, 0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* Match banner */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${homeColor}, ${awayColor})` }} />

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-white/10"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border"
                  style={{ borderColor: homeColor, background: homeColor + "33", color: homeColor }}
                >
                  {homeShort.slice(0, 2)}
                </div>
                <span className="text-white font-black text-sm">{homeShort}</span>
              </div>
              <span className="text-slate-600 text-xs font-bold">vs</span>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-black text-sm">{awayShort}</span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border"
                  style={{ borderColor: awayColor, background: awayColor + "33", color: awayColor }}
                >
                  {awayShort.slice(0, 2)}
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-[10px] mt-0.5">
              {filtered.length} contest{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {matchIsOpen && (
            <Link
              href={`/team-builder/${match.id}`}
              className="text-brand text-sm font-black border border-brand/40 px-3 py-1.5 rounded-xl shrink-0 hover:bg-brand/10 transition"
            >
              + Team
            </Link>
          )}
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
          {TYPE_TABS.map((t) => {
            const count =
              t.id === "all"
                ? contests.length
                : contests.filter((c) => c.contest_type === t.id).length;
            if (count === 0 && t.id !== "all") return null;
            return (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={cn(
                  "flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition",
                  typeFilter === t.id
                    ? "bg-brand border-brand text-white shadow-md shadow-brand/20"
                    : "border-white/10 text-slate-400 hover:border-white/20"
                )}
                style={{ background: typeFilter === t.id ? undefined : "rgba(255,255,255,0.03)" }}
              >
                {t.label}
                {count > 0 && (
                  <span className={cn("ml-1", typeFilter === t.id ? "text-white/70" : "text-slate-600")}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* No team warning */}
      {myTeams.length === 0 && (
        <div className="mx-4 mt-4 p-4 rounded-2xl border border-brand/30"
          style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.10) 0%, rgba(245,166,35,0.04) 100%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">No team yet</p>
              <p className="text-slate-400 text-xs mt-0.5">Build a team to join any contest</p>
            </div>
            <Link
              href={`/team-builder/${match.id}`}
              className="bg-brand text-white text-sm font-black px-4 py-2 rounded-xl shadow-lg shadow-brand/20 hover:bg-amber-500 transition"
            >
              Build →
            </Link>
          </div>
        </div>
      )}

      {/* Contest list */}
      <div className="px-4 pt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              🏆
            </div>
            <p className="text-white font-bold">No contests yet</p>
            <p className="text-slate-500 text-sm mt-1">Admin needs to create contests for this match</p>
          </div>
        )}

        {filtered.map((c) => {
          const spotsLeft = (c.max_teams ?? 0) - (c.entry_count ?? 0);
          const fillPct = c.max_teams > 0
            ? Math.min(100, ((c.entry_count ?? 0) / c.max_teams) * 100)
            : 0;
          const tiers: any[] = c.prize_tiers ?? [];
          const firstPrize = tiers[0]?.prizeAmount ?? null;
          const winnersCount = c.winners_count ?? 1;
          const winPct = c.max_teams > 0 ? Math.round((winnersCount / c.max_teams) * 100) : null;
          const isFull = spotsLeft <= 0;
          const isAlmostFull = spotsLeft > 0 && spotsLeft <= Math.ceil((c.max_teams ?? 10) * 0.1);
          const isMega = c.contest_type === "mega";
          const meta = TYPE_META[c.contest_type] ?? TYPE_META.small;

          return (
            <div
              key={c.id}
              className="rounded-2xl overflow-hidden border"
              style={{
                background: isMega
                  ? "linear-gradient(160deg, #1a1040 0%, #111827 60%)"
                  : "#111827",
                borderColor: isMega ? "rgba(192,132,252,0.25)" : "rgba(255,255,255,0.06)",
              }}
            >
              {/* Guaranteed badge strip */}
              {c.guaranteed_pool && (
                <div className="flex items-center gap-1.5 px-4 py-1.5 border-b"
                  style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.15)" }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="#22C55E" strokeWidth="1.5" />
                    <path d="M3.5 6l2 2 3-3" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-green-400 text-[10px] font-black uppercase tracking-wider">
                    Guaranteed Prize Pool
                  </span>
                </div>
              )}

              {/* Top accent line for mega */}
              {isMega && (
                <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #C084FC, #818CF8)" }} />
              )}

              <div className="p-4">
                {/* Prize + type row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    {/* Type badge */}
                    <span
                      className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border inline-block mb-2"
                      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
                    >
                      {meta.label}
                    </span>
                    <p className="text-white font-black text-base leading-tight truncate">{c.name}</p>
                    {winPct !== null && winPct > 0 && (
                      <p className="text-slate-500 text-xs mt-0.5">
                        Top <span className="text-white font-bold">{winPct}%</span> win
                      </p>
                    )}
                  </div>

                  {/* Prize pool — BIG number */}
                  <div className="text-right shrink-0 ml-3">
                    <p
                      className="font-black text-2xl leading-none"
                      style={{ color: isMega ? "#C084FC" : "#F5A623" }}
                    >
                      {formatPrize(c.prize_pool)}
                    </p>
                    <p className="text-slate-600 text-[9px] uppercase tracking-wide mt-0.5">Prize Pool</p>
                  </div>
                </div>

                {/* Top 3 prize tiers */}
                {tiers.length > 0 && (
                  <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none">
                    {tiers.slice(0, 3).map((t: any, i: number) => (
                      <div
                        key={i}
                        className="flex-shrink-0 rounded-xl px-3 py-1.5 border"
                        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                      >
                        <p className="text-[9px] text-slate-500 uppercase font-black">{t.label ?? `#${t.minRank}`}</p>
                        <p
                          className="text-sm font-black"
                          style={{ color: i === 0 ? "#22C55E" : "#94A3B8" }}
                        >
                          {formatPrize(t.prizeAmount)}
                        </p>
                      </div>
                    ))}
                    {tiers.length > 3 && (
                      <div className="flex-shrink-0 rounded-xl px-3 py-1.5 border flex items-center"
                        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                        <p className="text-slate-500 text-xs font-bold">+{tiers.length - 3}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Spots fill bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-slate-500">
                      <span className="text-white font-semibold">{c.entry_count ?? 0}</span> joined
                    </span>
                    <span
                      className={cn("font-semibold",
                        isFull ? "text-red-400" : isAlmostFull ? "text-orange-400" : "text-slate-500"
                      )}
                    >
                      {isFull ? "FULL" : `${spotsLeft} left`}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fillPct}%`,
                        background: isFull || isAlmostFull
                          ? "#EF4444"
                          : fillPct > 60
                          ? "#F97316"
                          : isMega
                          ? "#C084FC"
                          : "#F5A623",
                      }}
                    />
                  </div>
                </div>

                {/* Entry fee + Join CTA */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-[9px] uppercase tracking-wide font-bold">Entry</p>
                    <p className="text-white font-black text-lg leading-none">
                      {c.entry_fee === 0 ? (
                        <span className="text-green-400">FREE</span>
                      ) : (
                        formatCurrency(c.entry_fee)
                      )}
                    </p>
                  </div>

                  {!matchIsOpen ? (
                    <span className="text-orange-400 text-sm font-bold px-5 py-2.5 rounded-xl border border-orange-500/30"
                      style={{ background: "rgba(249,115,22,0.08)" }}>
                      {match.status === "locked" ? "Locked 🔒" : match.status === "live" ? "Live 🔴" : "Closed"}
                    </span>
                  ) : isFull ? (
                    <span className="text-slate-600 text-sm font-bold px-5 py-2.5 rounded-xl border border-white/10">
                      Full
                    </span>
                  ) : myTeams.length === 0 ? (
                    <Link
                      href={`/team-builder/${match.id}`}
                      className="bg-brand text-white text-sm font-black px-5 py-2.5 rounded-xl shadow-lg shadow-brand/25 hover:bg-amber-500 transition"
                    >
                      Build Team
                    </Link>
                  ) : (
                    <button
                      onClick={() => { setJoiningContestId(c.id); setSelectedTeamId(myTeams[0]?.id ?? null); }}
                      className="text-white text-sm font-black px-6 py-2.5 rounded-xl shadow-lg transition hover:opacity-90"
                      style={{
                        background: isMega
                          ? "linear-gradient(135deg, #A855F7, #6366F1)"
                          : "linear-gradient(135deg, #F5A623, #E8950F)",
                        boxShadow: isMega
                          ? "0 4px 12px rgba(168,85,247,0.30)"
                          : "0 4px 12px rgba(245,166,35,0.30)",
                      }}
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
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setJoiningContestId(null)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-auto rounded-t-3xl border-t border-white/10 p-5 space-y-4"
            style={{ background: "#0f172a" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />

            <div className="text-center">
              <h3 className="text-white font-black text-lg">Select Team</h3>
              <p className="text-slate-500 text-xs mt-0.5">Choose which team to enter with</p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {myTeams.map((t: any) => {
                const isSelected = selectedTeamId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition",
                      isSelected ? "border-brand" : "border-white/10"
                    )}
                    style={{
                      background: isSelected
                        ? "rgba(245,166,35,0.08)"
                        : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="text-left">
                      <p className="text-white font-bold text-sm">{t.team_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        C: {t.captain?.name ?? "—"} · VC: {t.vc?.name ?? "—"}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition",
                        isSelected ? "bg-brand border-brand" : "border-slate-600"
                      )}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <Link
              href={`/team-builder/${match.id}`}
              className="block text-center text-brand text-sm font-bold py-1 hover:underline"
            >
              + Create Another Team
            </Link>

            <button
              onClick={() => selectedTeamId && handleJoin(joiningContestId, selectedTeamId)}
              disabled={!selectedTeamId || joinLoading}
              className="w-full text-white font-black py-4 rounded-2xl disabled:opacity-40 transition text-base shadow-xl"
              style={{
                background: "linear-gradient(135deg, #F5A623, #E8950F)",
                boxShadow: "0 6px 20px rgba(245,166,35,0.35)",
              }}
            >
              {joinLoading ? "Joining…" : `Confirm & Join${!selectedTeamId ? " (select team)" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
