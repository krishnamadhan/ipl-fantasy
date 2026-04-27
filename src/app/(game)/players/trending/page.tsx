import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { shortTeam, TEAM_COLORS, cn } from "@/lib/utils/format";

export const revalidate = 120;

const ROLE_COLORS: Record<string, { text: string; bg: string }> = {
  WK:   { text: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  BAT:  { text: "#60A5FA", bg: "rgba(96,165,250,0.10)" },
  AR:   { text: "#34D399", bg: "rgba(52,211,153,0.10)" },
  BOWL: { text: "#FB923C", bg: "rgba(251,146,60,0.10)" },
};

export default async function TrendingPlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all active players
  const { data: allPlayers } = await supabase
    .from("f11_players")
    .select("id, name, ipl_team, role, credit_value, is_playing")
    .eq("is_playing", true);

  const playerMap: Record<string, any> = {};
  for (const p of allPlayers ?? []) {
    playerMap[p.id] = { ...p, selections: 0, captains: 0, vcs: 0 };
  }

  // Get entries for open/locked matches to compute selection %
  const { data: activeMatches } = await supabase
    .from("f11_matches")
    .select("id")
    .in("status", ["open", "locked"]);

  let totalEntries = 0;
  if (activeMatches && activeMatches.length > 0) {
    const matchIds = activeMatches.map((m: any) => m.id);
    const { data: activeContests } = await supabase
      .from("f11_contests")
      .select("id")
      .in("match_id", matchIds);

    if (activeContests && activeContests.length > 0) {
      const contestIds = activeContests.map((c: any) => c.id);
      const { data: entries } = await supabase
        .from("f11_entries")
        .select("player_ids, captain_id, vc_id")
        .in("contest_id", contestIds);

      totalEntries = entries?.length ?? 0;
      for (const entry of entries ?? []) {
        for (const pid of (entry.player_ids as string[]) ?? []) {
          if (playerMap[pid]) {
            playerMap[pid].selections++;
            if (pid === entry.captain_id) playerMap[pid].captains++;
            if (pid === entry.vc_id) playerMap[pid].vcs++;
          }
        }
      }
    }
  }

  // Selection %
  const mostSelected = Object.values(playerMap)
    .filter((p) => p.selections > 0)
    .sort((a, b) => b.selections - a.selections)
    .slice(0, 20)
    .map((p) => ({
      ...p,
      selPct: totalEntries > 0 ? Math.round((p.selections / totalEntries) * 100) : 0,
      capPct: totalEntries > 0 ? Math.round((p.captains / totalEntries) * 100) : 0,
      vcPct:  totalEntries > 0 ? Math.round((p.vcs  / totalEntries) * 100) : 0,
    }));

  // Credit history: gainers & losers
  const { data: history } = await supabase
    .from("f11_credit_history")
    .select("player_id, old_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const deltaMap: Record<string, number> = {};
  for (const h of history ?? []) {
    if (!h.player_id) continue;
    deltaMap[h.player_id] = (deltaMap[h.player_id] ?? 0) + (h.new_value - h.old_value);
  }

  const gainers = Object.entries(deltaMap)
    .filter(([id, delta]) => delta > 0 && playerMap[id])
    .map(([id, delta]) => ({ ...playerMap[id], delta }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8);

  const losers = Object.entries(deltaMap)
    .filter(([id, delta]) => delta < 0 && playerMap[id])
    .map(([id, delta]) => ({ ...playerMap[id], delta }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  const hasCreditData = gainers.length > 0 || losers.length > 0;

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <Link
          href="/players"
          className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">IPL Fantasy</p>
          <h1 className="text-white font-black text-xl leading-tight">Trending Players</h1>
        </div>
      </div>

      {/* ── Most Selected ── */}
      {mostSelected.length > 0 ? (
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔥</span>
            <div>
              <p className="text-white font-black text-sm">Most Selected</p>
              <p className="text-slate-500 text-xs">
                Based on {totalEntries} team{totalEntries !== 1 ? "s" : ""} in active contests
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {mostSelected.map((p, i) => {
              const tc = TEAM_COLORS[shortTeam(p.ipl_team)] ?? "#F5A623";
              const rc = ROLE_COLORS[p.role] ?? ROLE_COLORS.BAT;
              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-white/6 hover:border-white/12 transition"
                  style={{ background: "rgba(255,255,255,0.025)" }}
                >
                  {/* Rank */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={
                      i === 0
                        ? { background: "rgba(245,166,35,0.20)", color: "#F5A623" }
                        : i === 1
                        ? { background: "rgba(148,163,184,0.15)", color: "#94A3B8" }
                        : i === 2
                        ? { background: "rgba(205,127,50,0.15)", color: "#CD7F32" }
                        : { background: "rgba(255,255,255,0.05)", color: "#475569" }
                    }
                  >
                    {i + 1}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-sm truncate">{p.name}</p>
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: rc.text, background: rc.bg }}
                      >
                        {p.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold" style={{ color: tc }}>
                        {shortTeam(p.ipl_team)}
                      </span>
                      <span className="text-slate-700 text-[9px]">·</span>
                      <span className="text-slate-500 text-[10px]">₹{p.credit_value} Cr</span>
                      {p.capPct > 0 && (
                        <>
                          <span className="text-slate-700 text-[9px]">·</span>
                          <span className="text-brand text-[10px] font-bold">C {p.capPct}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Selection % */}
                  <div className="text-right shrink-0">
                    <p className="text-white font-black text-lg leading-none">{p.selPct}%</p>
                    <p className="text-slate-600 text-[9px] uppercase font-bold">selected</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="mx-4 mb-6 rounded-2xl border border-white/8 px-4 py-8 text-center"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <p className="text-3xl mb-2">📊</p>
          <p className="text-white font-bold text-sm">No selection data yet</p>
          <p className="text-slate-500 text-xs mt-1">
            Data appears once players join contests for upcoming matches
          </p>
        </div>
      )}

      {/* ── Credit Movers ── */}
      {hasCreditData ? (
        <div className="px-4 space-y-5">
          {/* Gainers */}
          {gainers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📈</span>
                <p className="text-white font-black text-sm">Rising Credits</p>
              </div>
              <div className="space-y-2">
                {gainers.map((p) => {
                  const tc = TEAM_COLORS[shortTeam(p.ipl_team)] ?? "#F5A623";
                  const rc = ROLE_COLORS[p.role] ?? ROLE_COLORS.BAT;
                  return (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="flex items-center justify-between rounded-2xl px-4 py-3 border hover:border-green-500/20 transition"
                      style={{ background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.12)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                          style={{ background: tc + "30", color: tc, border: `1px solid ${tc}50` }}
                        >
                          {shortTeam(p.ipl_team).slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[9px] font-black px-1 py-0.5 rounded"
                              style={{ color: rc.text, background: rc.bg }}
                            >
                              {p.role}
                            </span>
                            <span className="text-slate-500 text-[10px]">₹{p.credit_value} Cr</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-green-400 font-black text-base leading-none">
                          +{p.delta.toFixed(1)}
                        </p>
                        <p className="text-slate-600 text-[9px]">credits</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Losers */}
          {losers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📉</span>
                <p className="text-white font-black text-sm">Falling Credits</p>
              </div>
              <div className="space-y-2">
                {losers.map((p) => {
                  const tc = TEAM_COLORS[shortTeam(p.ipl_team)] ?? "#F5A623";
                  const rc = ROLE_COLORS[p.role] ?? ROLE_COLORS.BAT;
                  return (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="flex items-center justify-between rounded-2xl px-4 py-3 border hover:border-red-500/20 transition"
                      style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.12)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                          style={{ background: tc + "30", color: tc, border: `1px solid ${tc}50` }}
                        >
                          {shortTeam(p.ipl_team).slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[9px] font-black px-1 py-0.5 rounded"
                              style={{ color: rc.text, background: rc.bg }}
                            >
                              {p.role}
                            </span>
                            <span className="text-slate-500 text-[10px]">₹{p.credit_value} Cr</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-red-400 font-black text-base leading-none">
                          {p.delta.toFixed(1)}
                        </p>
                        <p className="text-slate-600 text-[9px]">credits</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4">
          <div
            className="rounded-2xl border border-white/8 px-4 py-8 text-center"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-3xl mb-2">💹</p>
            <p className="text-white font-bold text-sm">No credit changes yet</p>
            <p className="text-slate-500 text-xs mt-1">
              Credit changes appear after admin updates player values
            </p>
          </div>
        </div>
      )}

      {/* Browse all players CTA */}
      <div className="px-4 mt-6">
        <Link
          href="/players"
          className="flex items-center justify-between rounded-2xl px-4 py-3.5 border border-white/8 hover:border-white/15 transition"
          style={{ background: "rgba(255,255,255,0.025)" }}
        >
          <p className="text-slate-400 text-sm font-bold">Browse all players</p>
          <span className="text-brand text-sm">→</span>
        </Link>
      </div>
    </div>
  );
}
