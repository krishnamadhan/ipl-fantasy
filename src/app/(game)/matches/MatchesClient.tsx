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
  if (amount >= 1_000_000) return `₹${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `₹${(amount / 1_000).toFixed(0)}K`;
  if (amount > 0)          return `₹${amount}`;
  return "—";
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
          const ls = (m as any).live_score_summary as any;

          // Results tab — compact row
          if (tab === "results") {
            return (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3 card-press"
                  style={{ background: "#141920", border: "1px solid #252D3D" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px]"
                      style={{ background: "#1C2333" }}>🏏</div>
                    <span className="text-white font-rajdhani font-bold text-sm">{shortTeam(m.team_home)}</span>
                    <span className="text-[#4A5568] text-[10px] font-bold">VS</span>
                    <span className="text-white font-rajdhani font-bold text-sm">{shortTeam(m.team_away)}</span>
                  </div>
                  <p className="text-[#8A95A8] text-xs text-right max-w-[140px] truncate">
                    {m.result_summary || "Completed"}
                  </p>
                </div>
              </Link>
            );
          }

          // Badge strip helpers
          const badges: { label: string; color: string; bg: string }[] = [];
          if (isLive)   badges.push({ label: "● LIVE",         color: "#FF3B3B", bg: "rgba(255,59,59,0.15)" });
          if (isOpen)   badges.push({ label: "⚡ Deadline",     color: "#F7A325", bg: "rgba(247,163,37,0.12)" });
          if (isLocked) badges.push({ label: "🔒 Locked",       color: "#4A5568", bg: "rgba(74,85,104,0.15)" });
          if (contests?.count) badges.push({ label: `${contests.count} Contests`, color: "#8A95A8", bg: "rgba(255,255,255,0.05)" });

          const ctaLabel = isOpen ? "Join →" : isLive ? "Live →" : isLocked ? "Locked" : "View →";
          const ctaStyle = (isOpen || isLive)
            ? { background: "#3FEFB4", color: "#0B0E14" }
            : isLocked
            ? { background: "transparent", color: "#4A5568", border: "1px solid #252D3D" }
            : { background: "transparent", color: "#8A95A8", border: "1px solid #252D3D" };

          return (
            <Link key={m.id} href={`/matches/${m.id}`} className="block">
              <div
                className="rounded-xl overflow-hidden card-press"
                style={{
                  background: isLive ? "linear-gradient(135deg, #160808 0%, #141920 100%)" : "#141920",
                  border: `1px solid ${isLive ? "rgba(255,59,59,0.25)" : isOpen ? "rgba(247,163,37,0.20)" : "#252D3D"}`,
                }}
              >
                {/* Thin accent top bar */}
                <div className="h-[2px]" style={{
                  background: isLive ? "#FF3B3B" : isOpen
                    ? "linear-gradient(90deg,#F7A325,#E8950F)"
                    : `linear-gradient(90deg,${hc}55,${ac}55)`,
                }} />

                <div className="flex items-center gap-3 px-3 py-3">
                  {/* LEFT — sport icon + series */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                      style={{ background: "#1C2333", border: "1px solid #252D3D" }}>
                      🏏
                    </div>
                    <span className="text-[9px] leading-tight text-center" style={{ color: "#4A5568", maxWidth: 28 }}>IPL</span>
                  </div>

                  {/* CENTER — teams + status + badges */}
                  <div className="flex-1 min-w-0">
                    {/* Teams line */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full border flex items-center justify-center font-rajdhani font-bold text-[8px] shrink-0"
                        style={{ borderColor: hc, background: hc + "20", color: hc }}>
                        {shortTeam(m.team_home).slice(0,3)}
                      </div>
                      <p className="font-rajdhani font-bold text-sm text-white leading-none">
                        {shortTeam(m.team_home)}
                        <span className="font-normal text-[10px] mx-1.5" style={{ color: "#4A5568" }}>vs</span>
                        {shortTeam(m.team_away)}
                      </p>
                      <div className="w-5 h-5 rounded-full border flex items-center justify-center font-rajdhani font-bold text-[8px] shrink-0"
                        style={{ borderColor: ac, background: ac + "20", color: ac }}>
                        {shortTeam(m.team_away).slice(0,3)}
                      </div>
                    </div>

                    {/* Countdown or live score */}
                    <div className="mb-2">
                      {isLive && ls ? (
                        <p className="text-[11px] font-semibold" style={{ color: "#3FEFB4" }}>
                          {ls.team1_overs} Ov · {ls.team1_runs}/{ls.team1_wickets}
                          {ls.team2_runs > 0 ? ` | ${ls.team2_runs}/${ls.team2_wickets}` : ""}
                        </p>
                      ) : isLive ? (
                        <p className="text-[11px]" style={{ color: "#FF3B3B" }}>In Progress…</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <CountdownTimer targetDate={m.scheduled_at} compact />
                          {m.city && <span className="text-[10px]" style={{ color: "#4A5568" }}>· {m.city}</span>}
                        </div>
                      )}
                    </div>

                    {/* Badge strip */}
                    <div className="flex flex-wrap gap-1">
                      {badges.map((b) => (
                        <span
                          key={b.label}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ color: b.color, background: b.bg }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT — CTA + contest count */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <button
                      className="font-rajdhani font-bold text-xs px-3 py-1.5 rounded-lg"
                      style={ctaStyle}
                    >
                      {ctaLabel}
                    </button>
                    {contests?.count > 0 && (
                      <p className="text-[9px]" style={{ color: "#8A95A8" }}>
                        {contests.count} contest{contests.count !== 1 ? "s" : ""}
                      </p>
                    )}
                    {contests?.totalPrize > 0 && (
                      <p className="text-[9px] font-bold" style={{ color: "#F7A325" }}>
                        {formatPrize(contests.totalPrize)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
