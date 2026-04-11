"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { shortTeam, TEAM_COLORS, formatTimeIST } from "@/lib/utils/format";
import CountdownTimer from "@/components/ui/CountdownTimer";

type Tab   = "live" | "upcoming" | "results";
type Sport = "all"  | "cricket";

const DONE = ["completed", "abandoned", "no_result", "in_review"];

function isExpired(m: { status: string; scheduled_at: string }) {
  return m.status !== "live" && new Date(m.scheduled_at) <= new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function formatPrize(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M pts`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}K pts`;
  if (amount > 0)          return `${amount} pts`;
  return "pts contest";
}

export default function MatchesClient({
  matches,
  contestMap,
}: {
  matches: any[];
  contestMap: Record<string, { count: number; totalPrize: number }>;
}) {
  const liveCount = useMemo(() => matches.filter((m) => m.status === "live").length, [matches]);
  const [tab, setTab]     = useState<Tab>(liveCount > 0 ? "live" : "upcoming");
  const [sport, setSport] = useState<Sport>("all");

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (tab === "live")    return m.status === "live";
      if (tab === "results") return DONE.includes(m.status) || isExpired(m);
      return !DONE.includes(m.status) && !isExpired(m) && m.status !== "live";
    });
  }, [matches, tab]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "live",     label: "Live",     count: liveCount || undefined },
    { key: "upcoming", label: "Upcoming" },
    { key: "results",  label: "Results"  },
  ];

  const sports: { key: Sport; label: string }[] = [
    { key: "all",     label: "All" },
    { key: "cricket", label: "🏏 Cricket" },
  ];

  return (
    <>
      {/* ── Sticky filter bar (sits at top-14 = 56px, just below sticky header) ── */}
      <div
        className="sticky top-14 z-40"
        style={{ background: "#0B0E14", borderBottom: "1px solid #252D3D" }}
      >
        {/* Row 1 — Live / Upcoming / Results tabs */}
        <div className="flex" style={{ borderBottom: "1px solid #252D3D" }}>
          {tabs.map(({ key, label, count }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="relative flex-1 flex items-center justify-center gap-1.5 transition-colors duration-150"
                style={{ height: 40 }}
              >
                <span
                  className="font-rajdhani font-bold text-sm leading-none"
                  style={{ color: active ? "#3FEFB4" : "#8A95A8" }}
                >
                  {label}
                </span>
                {/* Live count badge */}
                {count ? (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                    style={{ background: "rgba(255,59,59,0.15)", color: "#FF3B3B" }}
                  >
                    {count}
                  </span>
                ) : null}
                {/* Active underline */}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: 2, background: "#3FEFB4", borderRadius: "2px 2px 0 0" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2 — Sport filter chips */}
        <div className="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar" style={{ height: 40 }}>
          {sports.map(({ key, label }) => {
            const active = sport === key;
            return (
              <button
                key={key}
                onClick={() => setSport(key)}
                className="shrink-0 px-4 py-1 rounded-full text-xs font-semibold transition-all duration-150"
                style={
                  active
                    ? { background: "#3FEFB4", color: "#0B0E14" }
                    : { border: "1px solid #252D3D", color: "#8A95A8", background: "transparent" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Match list ── */}
      <div className="px-4 pt-3 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl"
              style={{ background: "#141920", border: "1px solid #252D3D" }}
            >
              🏏
            </div>
            <p className="text-white font-rajdhani font-bold text-base">
              {tab === "live" ? "No live matches right now" : tab === "results" ? "No results yet" : "No upcoming matches"}
            </p>
            <p className="text-[#8A95A8] text-xs mt-1">Check back soon</p>
          </div>
        )}

        {filtered.map((m) => {
          const contests = contestMap[m.id];
          const isLive   = m.status === "live";
          const isOpen   = m.status === "open";
          const isLocked = m.status === "locked";
          const hc = TEAM_COLORS[shortTeam(m.team_home)] ?? "#475569";
          const ac = TEAM_COLORS[shortTeam(m.team_away)] ?? "#475569";

          if (tab === "results") {
            return (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <div
                  className="flex items-center justify-between rounded-2xl px-4 py-3 card-press"
                  style={{ background: "#141920", border: "1px solid #252D3D" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-rajdhani font-bold text-sm">{shortTeam(m.team_home)}</span>
                    <span className="text-[#4A5568] text-xs">vs</span>
                    <span className="text-white font-rajdhani font-bold text-sm">{shortTeam(m.team_away)}</span>
                  </div>
                  {m.result_summary && (
                    <p className="text-[#8A95A8] text-xs text-right max-w-[150px] truncate">{m.result_summary}</p>
                  )}
                </div>
              </Link>
            );
          }

          return (
            <Link key={m.id} href={`/matches/${m.id}`} className="block group">
              <div
                className="relative rounded-2xl overflow-hidden card-press"
                style={{
                  background: isLive
                    ? "linear-gradient(135deg, #1a0808 0%, #141920 100%)"
                    : isOpen
                    ? "linear-gradient(135deg, #151008 0%, #141920 100%)"
                    : "#141920",
                  border: `1px solid ${
                    isLive ? "rgba(255,59,59,0.30)" : isOpen ? "rgba(247,163,37,0.25)" : "#252D3D"
                  }`,
                }}
              >
                {/* Status accent bar */}
                <div
                  className="h-[2px] w-full"
                  style={{
                    background: isLive
                      ? "#FF3B3B"
                      : isOpen
                      ? "linear-gradient(90deg, #F7A325, #E8950F)"
                      : `linear-gradient(90deg, ${hc}60, ${ac}60)`,
                  }}
                />

                <div className="p-4">
                  {/* Status row */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        color:      isLive ? "#FF3B3B" : isOpen ? "#F7A325" : "#8A95A8",
                        background: isLive ? "rgba(255,59,59,0.12)" : isOpen ? "rgba(247,163,37,0.10)" : "rgba(255,255,255,0.05)",
                        border:     `1px solid ${isLive ? "rgba(255,59,59,0.25)" : isOpen ? "rgba(247,163,37,0.25)" : "#252D3D"}`,
                      }}
                    >
                      {isLive && <span className="live-dot" style={{ width: 5, height: 5 }} />}
                      {m.status?.replace("_", " ").toUpperCase()}
                    </span>
                    {m.city && <span className="text-[#4A5568] text-xs">{m.city}</span>}
                  </div>

                  {/* Teams row */}
                  <div className="flex items-center justify-between mb-3">
                    {/* Home */}
                    <div className="text-center flex-1">
                      <div
                        className="w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-1.5 font-rajdhani font-bold text-sm"
                        style={{
                          borderColor: hc,
                          background:  `linear-gradient(135deg, ${hc}30, ${hc}12)`,
                          color:        hc,
                          boxShadow:   `0 4px 12px ${hc}20`,
                        }}
                      >
                        {shortTeam(m.team_home)}
                      </div>
                      <p className="text-white text-xs font-semibold truncate max-w-[80px] mx-auto">
                        {m.team_home}
                      </p>
                    </div>

                    {/* Center */}
                    <div className="px-3 text-center shrink-0 min-w-[80px]">
                      {isLive ? (
                        (() => {
                          const ls = (m as any).live_score_summary as any;
                          return (
                            <div>
                              <p className="text-[#FF3B3B] font-bold text-[10px] mb-1 flex items-center justify-center gap-1">
                                <span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE
                              </p>
                              {ls ? (
                                <div className="text-[10px] space-y-0.5 text-center">
                                  <p className="text-white font-bold">{ls.team1_runs}/{ls.team1_wickets}</p>
                                  <p className="text-[#4A5568]">({ls.team1_overs} ov)</p>
                                  {ls.team2_runs > 0 && (
                                    <>
                                      <p className="text-[#8A95A8]">{ls.team2_runs}/{ls.team2_wickets}</p>
                                      <p className="text-[#4A5568]">({ls.team2_overs} ov)</p>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[#4A5568] text-[10px]">Syncing…</p>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          <p className="text-[#252D3D] text-[10px] font-bold mb-0.5">VS</p>
                          {m.status !== "completed" && (
                            <CountdownTimer targetDate={m.scheduled_at} compact />
                          )}
                          {m.scheduled_at && m.status !== "completed" && (
                            <p className="text-[#4A5568] text-[9px] mt-0.5">{formatTimeIST(m.scheduled_at)}</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Away */}
                    <div className="text-center flex-1">
                      <div
                        className="w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-1.5 font-rajdhani font-bold text-sm"
                        style={{
                          borderColor: ac,
                          background:  `linear-gradient(135deg, ${ac}30, ${ac}12)`,
                          color:        ac,
                          boxShadow:   `0 4px 12px ${ac}20`,
                        }}
                      >
                        {shortTeam(m.team_away)}
                      </div>
                      <p className="text-white text-xs font-semibold truncate max-w-[80px] mx-auto">
                        {m.team_away}
                      </p>
                    </div>
                  </div>

                  {/* Footer: contests + CTA */}
                  {contests && contests.count > 0 ? (
                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: "1px solid #252D3D" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#8A95A8] text-xs">
                          {contests.count} contest{contests.count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[#252D3D]">·</span>
                        <span className="text-xs font-bold" style={{ color: "#F7A325" }}>
                          {formatPrize(contests.totalPrize)} prize
                        </span>
                      </div>
                      <span
                        className="text-xs font-rajdhani font-bold px-3 py-1.5 rounded-full"
                        style={
                          isOpen || isLive
                            ? { background: "#3FEFB4", color: "#0B0E14" }
                            : isLocked
                            ? { background: "rgba(74,85,104,0.20)", color: "#4A5568", border: "1px solid #252D3D" }
                            : { background: "rgba(255,255,255,0.06)", color: "#8A95A8" }
                        }
                      >
                        {isOpen ? "Join →" : isLocked ? "Locked 🔒" : isLive ? "Live →" : "View →"}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="pt-3 text-center"
                      style={{ borderTop: "1px solid #252D3D" }}
                    >
                      <p className="text-[#4A5568] text-xs">No contests open</p>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
