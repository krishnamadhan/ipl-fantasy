import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { shortTeam, TEAM_COLORS } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function MyTeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teams } = await supabase
    .from("f11_teams")
    .select(`
      id, team_name, player_ids, captain_id, vc_id, created_at,
      match:f11_matches(id, team_home, team_away, scheduled_at, status)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const allCapVcIds = [...new Set(
    (teams ?? []).flatMap((t: any) => [t.captain_id, t.vc_id]).filter(Boolean)
  )];
  const { data: capVcPlayers } = allCapVcIds.length > 0
    ? await supabase.from("f11_players").select("id, name, role, ipl_team").in("id", allCapVcIds)
    : { data: [] };
  const playerMap = Object.fromEntries((capVcPlayers ?? []).map((p: any) => [p.id, p]));

  const teamsWithPlayers = (teams ?? []).map((t: any) => ({
    ...t,
    captain: playerMap[t.captain_id] ?? null,
    vc: playerMap[t.vc_id] ?? null,
  }));

  const matchMap = new Map<string, { match: any; teams: any[] }>();
  for (const t of teamsWithPlayers) {
    const m = Array.isArray(t.match) ? (t.match as any[])[0] : t.match;
    if (!m) continue;
    if (!matchMap.has(m.id)) matchMap.set(m.id, { match: m, teams: [] });
    matchMap.get(m.id)!.teams.push(t);
  }

  const grouped = Array.from(matchMap.values());

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#0B0E14", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-white/30 text-xs font-black uppercase tracking-widest">IPL Fantasy 2026</p>
        <h1 className="text-white font-black text-2xl mt-0.5">My Teams</h1>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            🏏
          </div>
          <p className="text-white font-black text-lg mb-1">No teams yet</p>
          <p className="text-white/40 text-sm mb-6 text-center leading-relaxed">
            Build a team for an upcoming match<br />to compete in contests
          </p>
          <Link
            href="/matches"
            className="text-white font-black px-8 py-3.5 rounded-2xl shadow-lg"
            style={{ background: "#e53935", boxShadow: "0 4px 16px rgba(229,57,53,0.35)" }}
          >
            Browse Matches →
          </Link>
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {grouped.map(({ match: m, teams: mTeams }) => {
            const isOpen = m.status === "open";
            const isLive = m.status === "live";
            const isDone = m.status === "completed" || m.status === "in_review";
            const hc = TEAM_COLORS[shortTeam(m.team_home)] ?? "#475569";
            const ac = TEAM_COLORS[shortTeam(m.team_away)] ?? "#475569";

            return (
              <div key={m.id}>
                {/* Match header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex -space-x-1">
                      <div className="w-7 h-7 rounded-full border flex items-center justify-center text-[8px] font-black"
                        style={{ borderColor: hc, background: hc + "25", color: hc }}>
                        {shortTeam(m.team_home).slice(0, 2)}
                      </div>
                      <div className="w-7 h-7 rounded-full border flex items-center justify-center text-[8px] font-black"
                        style={{ borderColor: ac, background: ac + "25", color: ac }}>
                        {shortTeam(m.team_away).slice(0, 2)}
                      </div>
                    </div>
                    <span className="text-white font-black text-sm">
                      {shortTeam(m.team_home)}{" "}
                      <span className="text-white/30 font-normal text-xs">vs</span>{" "}
                      {shortTeam(m.team_away)}
                    </span>
                    <span
                      className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border"
                      style={{
                        color: isLive ? "#f87171" : isDone ? "#4ade80" : "#fbbf24",
                        background: isLive ? "rgba(239,68,68,0.10)" : isDone ? "rgba(74,222,128,0.10)" : "rgba(251,191,36,0.10)",
                        borderColor: isLive ? "rgba(239,68,68,0.20)" : isDone ? "rgba(74,222,128,0.20)" : "rgba(251,191,36,0.20)",
                      }}
                    >
                      {isLive && <span className="inline-block w-1 h-1 rounded-full bg-red-400 mr-0.5 animate-pulse align-middle" />}
                      {m.status?.replace("_", " ")}
                    </span>
                  </div>
                  {isOpen && (
                    <Link href={`/team-builder/${m.id}`}
                      className="text-xs font-black px-3 py-1.5 rounded-xl border transition"
                      style={{ color: "#e53935", borderColor: "rgba(229,57,53,0.30)", background: "rgba(229,57,53,0.06)" }}>
                      + Team
                    </Link>
                  )}
                </div>

                {/* Team cards */}
                <div className="space-y-2.5">
                  {mTeams.map((t: any) => {
                    const cap = Array.isArray(t.captain) ? t.captain[0] : t.captain;
                    const vc  = Array.isArray(t.vc)      ? t.vc[0]      : t.vc;

                    return (
                      <div key={t.id} className="rounded-2xl overflow-hidden"
                        style={{ background: "#111", border: "1px solid #222" }}>
                        <div className="px-4 py-3.5 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-base truncate">{t.team_name}</p>

                            {/* C / VC row */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {cap && (
                                <div className="flex items-center gap-1">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
                                    style={{ background: "#ffd900", color: "#000" }}>
                                    C
                                  </div>
                                  <span className="text-white text-xs font-semibold">{cap.name}</span>
                                </div>
                              )}
                              {vc && (
                                <>
                                  <span className="text-white/20">·</span>
                                  <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black"
                                      style={{ background: "#555", color: "white" }}>
                                      VC
                                    </div>
                                    <span className="text-white/50 text-xs">{vc.name}</span>
                                  </div>
                                </>
                              )}
                            </div>

                            <p className="text-white/25 text-xs mt-1">
                              {(t.player_ids ?? []).length} players
                            </p>
                          </div>

                          <div className="flex gap-2 ml-3 shrink-0">
                            {isOpen && (
                              <Link
                                href={`/team-builder/${m.id}?teamId=${t.id}`}
                                className="text-xs border px-3 py-2 rounded-xl font-bold transition"
                                style={{ borderColor: "#2a2a2a", color: "rgba(255,255,255,0.50)", background: "#1a1a1a" }}
                              >
                                Edit
                              </Link>
                            )}
                            <Link
                              href={`/contests/browse/${m.id}`}
                              className="text-xs font-bold px-3 py-2 rounded-xl transition"
                              style={{ background: "#e53935", color: "white", boxShadow: "0 2px 8px rgba(229,57,53,0.30)" }}
                            >
                              Join →
                            </Link>
                          </div>
                        </div>

                        {/* Player dot strip */}
                        {(t.player_ids ?? []).length > 0 && (
                          <div className="px-4 py-2.5 border-t flex items-center gap-1.5 overflow-x-auto scrollbar-none"
                            style={{ borderColor: "#1a1a1a" }}>
                            {(t.player_ids ?? []).slice(0, 11).map((pid: string, idx: number) => {
                              const isC  = pid === t.captain_id;
                              const isVC = pid === t.vc_id;
                              return (
                                <div key={pid}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                                  style={
                                    isC
                                      ? { background: "#ffd900", color: "#000" }
                                      : isVC
                                      ? { background: "#444", color: "white" }
                                      : { background: "#1a1a1a", color: "rgba(255,255,255,0.25)", border: "1px solid #2a2a2a" }
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
