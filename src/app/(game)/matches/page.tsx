import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { shortTeam, TEAM_COLORS, formatTimeIST } from "@/lib/utils/format";
import CountdownTimer from "@/components/ui/CountdownTimer";

export const dynamic = "force-dynamic";

function formatPrize(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M pts`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}K pts`;
  if (amount > 0)          return `${amount} pts`;
  return "pts contest";
}

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matches } = await supabase
    .from("f11_matches")
    .select("id, team_home, team_away, venue, city, scheduled_at, status, result_summary")
    .order("scheduled_at", { ascending: true })
    .limit(30);

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: contestData } = await supabase
    .from("f11_contests")
    .select("match_id, prize_pool, status")
    .in("status", ["open", "locked"])
    .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"]);

  const contestMap = new Map<string, { count: number; totalPrize: number }>();
  for (const c of contestData ?? []) {
    const prev = contestMap.get(c.match_id) ?? { count: 0, totalPrize: 0 };
    contestMap.set(c.match_id, { count: prev.count + 1, totalPrize: prev.totalPrize + (c.prize_pool ?? 0) });
  }

  const upcoming = (matches ?? []).filter((m) => m.status !== "completed");
  const completed = (matches ?? []).filter((m) => m.status === "completed");

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">IPL Fantasy 2026</p>
        <h1 className="text-white font-black text-2xl mt-0.5">Matches</h1>
      </div>

      {upcoming.length > 0 && (
        <div className="px-4 space-y-3">
          {upcoming.map((m) => {
            const contests = contestMap.get(m.id);
            const isLive = m.status === "live";
            const isOpen = m.status === "open";
            const isLocked = m.status === "locked";
            const hc = TEAM_COLORS[shortTeam(m.team_home)] ?? "#475569";
            const ac = TEAM_COLORS[shortTeam(m.team_away)] ?? "#475569";

            return (
              <Link key={m.id} href={`/matches/${m.id}`} className="block group">
                <div
                  className="relative rounded-2xl overflow-hidden border transition"
                  style={{
                    background: isLive
                      ? "linear-gradient(135deg, #1a0808 0%, #111827 100%)"
                      : isOpen
                      ? "linear-gradient(135deg, #12100a 0%, #111827 100%)"
                      : "#111827",
                    borderColor: isLive
                      ? "rgba(239,68,68,0.30)"
                      : isOpen
                      ? "rgba(245,166,35,0.25)"
                      : "rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Top color bar */}
                  <div
                    className="h-0.5 w-full"
                    style={{
                      background: isLive
                        ? "#EF4444"
                        : isOpen
                        ? "linear-gradient(90deg, #F5A623, #E8950F)"
                        : `linear-gradient(90deg, ${hc}80, ${ac}80)`,
                    }}
                  />

                  <div className="p-4">
                    {/* Status row */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-[10px] font-black px-2.5 py-0.5 rounded-full border"
                        style={{
                          color: isLive ? "#F87171" : isOpen ? "#F5A623" : "#94A3B8",
                          background: isLive ? "rgba(239,68,68,0.12)" : isOpen ? "rgba(245,166,35,0.10)" : "rgba(255,255,255,0.05)",
                          borderColor: isLive ? "rgba(239,68,68,0.25)" : isOpen ? "rgba(245,166,35,0.25)" : "rgba(255,255,255,0.08)",
                        }}
                      >
                        {isLive && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1 animate-pulse align-middle" />
                        )}
                        {m.status?.replace("_", " ").toUpperCase()}
                      </span>
                      {m.city && <span className="text-slate-600 text-xs">{m.city}</span>}
                    </div>

                    {/* Teams row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-center flex-1">
                        <div
                          className="w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-1.5 font-black text-sm shadow-lg"
                          style={{
                            borderColor: hc,
                            background: `linear-gradient(135deg, ${hc}35 0%, ${hc}18 100%)`,
                            color: hc,
                            boxShadow: `0 4px 12px ${hc}25`,
                          }}
                        >
                          {shortTeam(m.team_home)}
                        </div>
                        <p className="text-white text-xs font-semibold truncate max-w-[80px] mx-auto">
                          {m.team_home}
                        </p>
                      </div>

                      <div className="px-3 text-center shrink-0">
                        {isLive ? (
                          <p className="text-red-400 font-black text-sm animate-pulse">LIVE</p>
                        ) : (
                          <>
                            <p className="text-slate-600 text-[10px] font-bold mb-0.5">VS</p>
                            {m.status !== "completed" && (
                              <CountdownTimer targetDate={m.scheduled_at} compact />
                            )}
                            {m.scheduled_at && m.status !== "completed" && (
                              <p className="text-slate-600 text-[9px] mt-0.5">
                                {formatTimeIST(m.scheduled_at)}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="text-center flex-1">
                        <div
                          className="w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-1.5 font-black text-sm shadow-lg"
                          style={{
                            borderColor: ac,
                            background: `linear-gradient(135deg, ${ac}35 0%, ${ac}18 100%)`,
                            color: ac,
                            boxShadow: `0 4px 12px ${ac}25`,
                          }}
                        >
                          {shortTeam(m.team_away)}
                        </div>
                        <p className="text-white text-xs font-semibold truncate max-w-[80px] mx-auto">
                          {m.team_away}
                        </p>
                      </div>
                    </div>

                    {/* Footer: contest info + CTA */}
                    {contests && contests.count > 0 ? (
                      <div
                        className="flex items-center justify-between pt-3 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <div>
                          <span className="text-slate-500 text-xs">
                            {contests.count} contest{contests.count !== 1 ? "s" : ""}
                          </span>
                          <span className="text-slate-700 mx-1.5">·</span>
                          <span className="text-brand text-xs font-bold">
                            {formatPrize(contests.totalPrize)} prize
                          </span>
                        </div>
                        <span
                          className="text-xs font-black px-3 py-1.5 rounded-full text-white"
                          style={{
                            background: isOpen || isLive
                              ? "linear-gradient(135deg, #F5A623, #E8950F)"
                              : isLocked ? "rgba(251,146,60,0.15)"
                              : "rgba(255,255,255,0.08)",
                            color: isOpen || isLive ? "white" : isLocked ? "#FB923C" : "#94A3B8",
                          }}
                        >
                          {isOpen ? "Join Now →" : isLocked ? "Locked 🔒" : isLive ? "Live →" : "View →"}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="pt-3 border-t text-center"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <p className="text-slate-700 text-xs">No contests open</p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-slate-500 text-xs font-black uppercase tracking-wider mb-3">Completed</h2>
          <div className="space-y-2">
            {completed.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between rounded-2xl px-4 py-3.5 border border-white/5 hover:border-white/10 transition"
                style={{ background: "rgba(255,255,255,0.025)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm font-black">{shortTeam(m.team_home)}</span>
                  <span className="text-slate-700 text-xs">vs</span>
                  <span className="text-slate-400 text-sm font-black">{shortTeam(m.team_away)}</span>
                </div>
                {m.result_summary && (
                  <p className="text-slate-600 text-xs text-right max-w-[160px] truncate">{m.result_summary}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {(matches ?? []).length === 0 && (
        <div className="text-center py-20 px-4">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl border border-white/10"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            🏏
          </div>
          <p className="text-white font-black text-lg">No matches yet</p>
          <p className="text-slate-500 text-sm mt-1">Admin needs to sync the schedule</p>
        </div>
      )}
    </div>
  );
}
