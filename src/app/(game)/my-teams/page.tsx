import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { shortTeam, TEAM_COLORS, cn } from "@/lib/utils/format";

export const revalidate = 20;

export default async function MyTeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teams } = await supabase
    .from("f11_teams")
    .select(`
      id, team_name, player_ids, captain_id, vc_id, created_at,
      captain:f11_players!captain_id(name, role, ipl_team),
      vc:f11_players!vc_id(name, role, ipl_team),
      match:f11_matches(id, team_home, team_away, scheduled_at, status)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Group by match
  const matchMap = new Map<string, { match: any; teams: any[] }>();
  for (const t of teams ?? []) {
    const m = Array.isArray(t.match) ? (t.match as any[])[0] : t.match;
    if (!m) continue;
    if (!matchMap.has(m.id)) matchMap.set(m.id, { match: m, teams: [] });
    matchMap.get(m.id)!.teams.push(t);
  }

  const grouped = Array.from(matchMap.values());

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">IPL Fantasy 2026</p>
        <h1 className="text-white font-black text-2xl mt-0.5">My Teams</h1>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4 border border-white/10"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            🏏
          </div>
          <p className="text-white font-black text-lg mb-1">No teams yet</p>
          <p className="text-slate-500 text-sm mb-6 text-center leading-relaxed">
            Build a team for an upcoming match<br />to compete in contests
          </p>
          <Link
            href="/matches"
            className="text-white font-black px-8 py-3.5 rounded-2xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, #F5A623, #E8950F)",
              boxShadow: "0 4px 16px rgba(245,166,35,0.35)",
            }}
          >
            Browse Matches →
          </Link>
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {grouped.map(({ match: m, teams: mTeams }) => {
            const isOpen = m.status === "open" || m.status === "scheduled";
            const isLive = m.status === "live";
            const isDone = m.status === "completed" || m.status === "in_review";
            const hc = TEAM_COLORS[shortTeam(m.team_home)] ?? "#475569";
            const ac = TEAM_COLORS[shortTeam(m.team_away)] ?? "#475569";

            return (
              <div key={m.id}>
                {/* Match header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {/* Team badges */}
                    <div className="flex -space-x-1">
                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[8px] font-black"
                        style={{ borderColor: hc, background: hc + "33", color: hc, borderWidth: "1.5px" }}>
                        {shortTeam(m.team_home).slice(0, 2)}
                      </div>
                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[8px] font-black"
                        style={{ borderColor: ac, background: ac + "33", color: ac, borderWidth: "1.5px" }}>
                        {shortTeam(m.team_away).slice(0, 2)}
                      </div>
                    </div>
                    <span className="text-white font-black text-sm">
                      {shortTeam(m.team_home)}{" "}
                      <span className="text-slate-600 font-normal text-xs">vs</span>{" "}
                      {shortTeam(m.team_away)}
                    </span>
                    <span
                      className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border"
                      style={{
                        color: isLive ? "#F87171" : isDone ? "#4ADE80" : "#FCD34D",
                        background: isLive ? "rgba(239,68,68,0.10)" : isDone ? "rgba(74,222,128,0.10)" : "rgba(252,211,77,0.10)",
                        borderColor: isLive ? "rgba(239,68,68,0.20)" : isDone ? "rgba(74,222,128,0.20)" : "rgba(252,211,77,0.20)",
                      }}
                    >
                      {isLive && <span className="inline-block w-1 h-1 rounded-full bg-red-400 mr-0.5 animate-pulse align-middle" />}
                      {m.status?.replace("_", " ")}
                    </span>
                  </div>

                  {isOpen && (
                    <Link
                      href={`/team-builder/${m.id}`}
                      className="text-brand text-xs font-black border border-brand/30 px-3 py-1.5 rounded-xl hover:bg-brand/5 transition"
                    >
                      + Team
                    </Link>
                  )}
                </div>

                {/* Team cards */}
                <div className="space-y-2">
                  {mTeams.map((t: any) => {
                    const cap = Array.isArray(t.captain) ? t.captain[0] : t.captain;
                    const vc  = Array.isArray(t.vc)      ? t.vc[0]      : t.vc;
                    const capColor = cap ? (TEAM_COLORS[shortTeam(cap.ipl_team)] ?? "#F5A623") : "#F5A623";
                    const vcColor  = vc  ? (TEAM_COLORS[shortTeam(vc.ipl_team)]  ?? "#64748B") : "#64748B";

                    return (
                      <div
                        key={t.id}
                        className="rounded-2xl border overflow-hidden"
                        style={{ background: "#111827", borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <div className="px-4 py-3.5 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-base truncate">{t.team_name}</p>

                            {/* Captain & VC preview */}
                            <div className="flex items-center gap-2 mt-1.5">
                              {cap && (
                                <div className="flex items-center gap-1">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
                                    style={{ background: capColor + "30", color: capColor }}
                                  >
                                    C
                                  </div>
                                  <span className="text-white text-xs font-semibold">{cap.name}</span>
                                </div>
                              )}
                              {vc && (
                                <>
                                  <span className="text-slate-700">·</span>
                                  <div className="flex items-center gap-1">
                                    <div
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black"
                                      style={{ background: vcColor + "25", color: vcColor }}
                                    >
                                      VC
                                    </div>
                                    <span className="text-slate-400 text-xs">{vc.name}</span>
                                  </div>
                                </>
                              )}
                            </div>

                            <p className="text-slate-600 text-xs mt-1">
                              {(t.player_ids ?? []).length} players selected
                            </p>
                          </div>

                          <div className="flex gap-2 ml-3 shrink-0">
                            {isOpen && (
                              <Link
                                href={`/team-builder/${m.id}`}
                                className="text-xs border px-3 py-2 rounded-xl font-bold transition"
                                style={{
                                  borderColor: "rgba(255,255,255,0.10)",
                                  color: "#94A3B8",
                                  background: "rgba(255,255,255,0.04)",
                                }}
                              >
                                Edit
                              </Link>
                            )}
                            <Link
                              href={`/contests/browse/${m.id}`}
                              className="text-brand text-xs border border-brand/30 px-3 py-2 rounded-xl font-bold hover:bg-brand/5 transition"
                            >
                              Join →
                            </Link>
                          </div>
                        </div>

                        {/* Player count dots strip */}
                        {(t.player_ids ?? []).length > 0 && (
                          <div
                            className="px-4 py-2.5 border-t flex items-center gap-1.5 overflow-x-auto scrollbar-none"
                            style={{ borderColor: "rgba(255,255,255,0.05)" }}
                          >
                            {(t.player_ids ?? []).slice(0, 11).map((pid: string, idx: number) => {
                              const isC  = pid === t.captain_id;
                              const isVC = pid === t.vc_id;
                              return (
                                <div
                                  key={pid}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border"
                                  style={
                                    isC
                                      ? { borderColor: "#F5A623", background: "rgba(245,166,35,0.20)", color: "#F5A623" }
                                      : isVC
                                      ? { borderColor: "#94A3B8", background: "rgba(148,163,184,0.15)", color: "#CBD5E1" }
                                      : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#475569" }
                                  }
                                >
                                  {isC ? "C" : isVC ? "V" : (idx + 1)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
