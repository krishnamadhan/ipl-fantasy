"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shortTeam, TEAM_COLORS, formatCurrency } from "@/lib/utils/format";
import CountdownTimer from "@/components/ui/CountdownTimer";

interface Props {
  match: {
    id: string;
    team_home: string;
    team_away: string;
    scheduled_at: string;
    status: string;
    live_score_summary?: any;
    city?: string | null;
    venue?: string | null;
  };
  contestCount: number;
  totalPrize: number;
  hasTeam: boolean;
}

export default function HeroMatchCard({ match, contestCount, totalPrize, hasTeam }: Props) {
  const router   = useRouter();
  const isLive   = match.status === "live";
  const isOpen   = match.status === "open";
  const isLocked = match.status === "locked";

  const hc = TEAM_COLORS[shortTeam(match.team_home)] ?? "#3FEFB4";
  const ac = TEAM_COLORS[shortTeam(match.team_away)] ?? "#F7A325";
  const ls = match.live_score_summary as any;

  // Determine status badge
  let badge: { label: string; color: string; bg: string; border: string; dot?: boolean } | null = null;
  if (isLive) {
    badge = { label: "LIVE", color: "#FF3B3B", bg: "rgba(255,59,59,0.12)", border: "rgba(255,59,59,0.30)", dot: true };
  } else if (isOpen) {
    badge = { label: "⚡ Deadline Active", color: "#F7A325", bg: "rgba(247,163,37,0.12)", border: "rgba(247,163,37,0.30)" };
  } else if (isLocked) {
    badge = { label: "🔒 Locked", color: "#8A95A8", bg: "rgba(74,85,104,0.15)", border: "#252D3D" };
  } else {
    badge = { label: "Upcoming", color: "#3FEFB4", bg: "rgba(63,239,180,0.10)", border: "rgba(63,239,180,0.25)" };
  }

  return (
    <div className="block mx-4 mb-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/matches/${match.id}`)}
        onKeyDown={(e) => e.key === "Enter" && router.push(`/matches/${match.id}`)}
        className="relative overflow-hidden rounded-2xl p-4 card-press cursor-pointer"
        style={{
          background:  "linear-gradient(135deg, #141920 0%, #1C2333 100%)",
          border:       "1px solid #252D3D",
          boxShadow:    "0 4px 24px rgba(63,239,180,0.06)",
        }}
      >
        {/* Team color top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${hc}, ${ac})` }}
        />

        {/* TOP STRIP — series label + status badge */}
        <div className="flex items-center justify-between mb-4 pt-1">
          <span className="text-[11px]" style={{ color: "#8A95A8" }}>
            IPL 2026{match.city ? ` • ${match.city}` : ""}
          </span>
          {badge && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}
            >
              {badge.dot && <span className="live-dot" style={{ width: 5, height: 5 }} />}
              {badge.label}
            </span>
          )}
        </div>

        {/* TEAMS ROW */}
        <div className="flex items-center justify-between mb-4">
          {/* Home */}
          <div className="text-center flex-1">
            <div
              className="w-[68px] h-[68px] rounded-full mx-auto mb-2 flex items-center justify-center font-rajdhani font-bold text-lg border-2"
              style={{
                borderColor: hc,
                background:  `linear-gradient(135deg, ${hc}30 0%, ${hc}10 100%)`,
                color:        hc,
                boxShadow:   `0 0 20px ${hc}25`,
              }}
            >
              {shortTeam(match.team_home)}
            </div>
            <p className="text-white font-semibold text-[11px] leading-tight max-w-[80px] mx-auto">
              {match.team_home}
            </p>
          </div>

          {/* VS / Live score center */}
          <div className="text-center px-3 shrink-0 min-w-[90px]">
            {isLive && ls ? (
              <div className="space-y-1">
                <p className="font-rajdhani font-bold text-base text-white">
                  {ls.team1_runs}/{ls.team1_wickets}
                  <span className="text-[#8A95A8] text-xs font-normal ml-1">({ls.team1_overs} ov)</span>
                </p>
                {ls.team2_runs > 0 && (
                  <p className="font-rajdhani text-sm" style={{ color: "#8A95A8" }}>
                    {ls.team2_runs}/{ls.team2_wickets}
                    <span className="text-xs ml-1">({ls.team2_overs} ov)</span>
                  </p>
                )}
                {ls.situation && (
                  <p className="text-[10px] font-semibold" style={{ color: "#3FEFB4" }}>
                    {ls.situation}
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="font-rajdhani font-bold text-2xl leading-none mb-1" style={{ color: "#252D3D" }}>
                  VS
                </p>
                <p className="text-[10px]" style={{ color: "#4A5568" }}>
                  {match.scheduled_at
                    ? new Date(match.scheduled_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
                      })
                    : ""}
                </p>
              </>
            )}
          </div>

          {/* Away */}
          <div className="text-center flex-1">
            <div
              className="w-[68px] h-[68px] rounded-full mx-auto mb-2 flex items-center justify-center font-rajdhani font-bold text-lg border-2"
              style={{
                borderColor: ac,
                background:  `linear-gradient(135deg, ${ac}30 0%, ${ac}10 100%)`,
                color:        ac,
                boxShadow:   `0 0 20px ${ac}25`,
              }}
            >
              {shortTeam(match.team_away)}
            </div>
            <p className="text-white font-semibold text-[11px] leading-tight max-w-[80px] mx-auto">
              {match.team_away}
            </p>
          </div>
        </div>

        {/* COUNTDOWN ROW (only for non-live matches) */}
        {!isLive && !isLocked && match.scheduled_at && (
          <div className="flex justify-center mb-4">
            <CountdownTimer targetDate={match.scheduled_at} hero />
          </div>
        )}

        {/* STATS ROW */}
        <div
          className="flex items-center justify-between mb-4 py-3 px-1"
          style={{ borderTop: "1px solid #252D3D", borderBottom: "1px solid #252D3D" }}
        >
          <div className="text-center flex-1">
            <p className="text-[10px]" style={{ color: "#8A95A8" }}>Prize Pool</p>
            <p className="font-rajdhani font-bold text-sm mt-0.5" style={{ color: "#F7A325" }}>
              {totalPrize > 0 ? `₹${totalPrize.toLocaleString("en-IN")}` : "—"}
            </p>
          </div>
          <div className="w-px h-8" style={{ background: "#252D3D" }} />
          <div className="text-center flex-1">
            <p className="text-[10px]" style={{ color: "#8A95A8" }}>Contests</p>
            <p className="font-rajdhani font-bold text-sm mt-0.5 text-white">
              {contestCount > 0 ? contestCount : "—"}
            </p>
          </div>
          <div className="w-px h-8" style={{ background: "#252D3D" }} />
          <div className="text-center flex-1">
            <p className="text-[10px]" style={{ color: "#8A95A8" }}>My Team</p>
            <p className="font-rajdhani font-bold text-sm mt-0.5" style={{ color: hasTeam ? "#3FEFB4" : "#4A5568" }}>
              {hasTeam ? "✓ Ready" : "Not set"}
            </p>
          </div>
        </div>

        {/* CTA ROW — stopPropagation prevents card click from firing */}
        <div className="flex gap-2.5" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/contests/browse/${match.id}`}
            className="flex-1 text-center font-rajdhani font-bold text-sm py-3 rounded-xl transition-transform active:scale-[0.97] duration-100"
            style={{ background: "#3FEFB4", color: "#0B0E14" }}
          >
            Join Contest
          </Link>
          <Link
            href={isLive ? `/matches/${match.id}/live` : `/team-builder/${match.id}`}
            className="flex-1 text-center font-rajdhani font-bold text-sm py-3 rounded-xl transition-transform active:scale-[0.97] duration-100"
            style={{ border: "1px solid #3FEFB4", color: "#3FEFB4", background: "rgba(63,239,180,0.06)" }}
          >
            {isLive ? "View Live" : hasTeam ? "Edit Team" : "Create Team"}
          </Link>
        </div>
      </div>
    </div>
  );
}
