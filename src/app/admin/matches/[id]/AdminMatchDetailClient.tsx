"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateTime, shortTeam, formatCurrency, cn } from "@/lib/utils/format";

const STATUS_COLOR: Record<string, string> = {
  scheduled:  "bg-slate-600/60 text-slate-300",
  open:       "bg-amber-500/20 text-amber-400",
  locked:     "bg-orange-500/20 text-orange-400",
  live:       "bg-red-500/20 text-red-400",
  in_review:  "bg-purple-500/20 text-purple-400",
  completed:  "bg-green-500/20 text-green-400",
  abandoned:  "bg-slate-700/60 text-slate-500",
  no_result:  "bg-slate-700/60 text-slate-500",
};

export default function AdminMatchDetailClient({
  match,
  stats,
  contests,
  playingXi,
}: {
  match: any;
  stats: any[];
  contests: any[];
  playingXi: any[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "xi" | "contests">("stats");

  async function post(url: string, body?: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Error");
    return d;
  }

  async function action(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try {
      await fn();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setLoading(null);
    }
  }

  const id = match.id;
  const isPaused = match.is_scoring_paused;
  const homeShort = shortTeam(match.team_home);
  const awayShort = shortTeam(match.team_away);

  const xiPlaying = playingXi.filter((p) => p.is_playing_xi);
  const xibenched = playingXi.filter((p) => !p.is_playing_xi);

  return (
    <div className="space-y-6">
      <Toaster />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/matches" className="text-slate-400 hover:text-white text-sm">← Matches</Link>
        <span className="text-slate-700">/</span>
        <span className="text-white font-bold">{homeShort} vs {awayShort}</span>
      </div>

      {/* Match info card */}
      <div className="bg-surface-card rounded-2xl border border-slate-700 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-white font-black text-xl">
              {match.team_home} <span className="text-slate-600 font-normal text-base">vs</span> {match.team_away}
            </h1>
            <p className="text-slate-400 text-sm mt-1">{formatDateTime(match.scheduled_at)}</p>
            {match.venue && <p className="text-slate-500 text-xs mt-0.5">{match.venue}</p>}
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${STATUS_COLOR[match.status] ?? "bg-slate-600 text-slate-300"}`}>
            {match.status === "live" && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1 animate-pulse align-middle" />
            )}
            {match.status?.replace("_", " ").toUpperCase()}
          </span>
        </div>

        {match.result_summary && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-4 text-center">
            <p className="text-green-400 text-sm font-bold">{match.result_summary}</p>
          </div>
        )}

        {/* Primary actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {match.status === "scheduled" && (
            <ActionBtn label="Open Lineups" color="brand" loading={loading === "lock"}
              onClick={() => action("lock", async () => { await post(`/api/admin/matches/${id}/lock`); toast.success("Lineups open!"); })} />
          )}
          {(match.status === "open" || match.status === "locked") && (
            <ActionBtn label="Sync Playing XI" color="blue" loading={loading === "xi"}
              onClick={() => action("xi", async () => {
                const d = await post(`/api/admin/matches/${id}/sync-playing-xi`);
                toast.success(`${d.playingCount} players confirmed`);
              })} />
          )}
          {match.status === "locked" && (
            <ActionBtn label="Go Live 🔴" color="red" loading={loading === "live"}
              onClick={() => {
                if (!confirm("Start live scoring? Teams locked.")) return;
                action("live", async () => { await post(`/api/admin/matches/${id}/go-live`); toast.success("Match is live!"); });
              }} />
          )}
          {match.status === "in_review" && (
            <ActionBtn label="Finalize & Pay ✓" color="green" loading={loading === "complete"}
              onClick={() => {
                if (!confirm("Finalize match and pay all contest winners?")) return;
                action("complete", async () => {
                  const d = await post(`/api/admin/matches/${id}/complete`);
                  toast.success(`Done! ${d.payouts?.length ?? 0} contests paid`);
                });
              }} />
          )}
          {(match.status === "live" || match.status === "in_review") && (
            <ActionBtn label="Force Rescore" color="blue" loading={loading === "rescore"}
              onClick={() => action("rescore", async () => {
                const d = await post(`/api/admin/matches/${id}/rescore`);
                toast.success(`Rescored ${d.rescored} players`);
              })} />
          )}
          {match.status === "live" && (
            <ActionBtn
              label={isPaused ? "Resume Scoring ▶" : "Pause Scoring ⏸"}
              color={isPaused ? "green" : "slate"}
              loading={loading === "pause"}
              onClick={() => action("pause", async () => {
                await post(`/api/admin/matches/${id}/pause-scoring`, { paused: !isPaused });
                toast.success(isPaused ? "Scoring resumed" : "Scoring paused");
              })} />
          )}
          {!["scheduled", "completed", "abandoned", "no_result"].includes(match.status) && (
            <ActionBtn label="↩ Revert" color="slate" loading={loading === "revert"}
              onClick={() => action("revert", async () => {
                const d = await post(`/api/admin/matches/${id}/revert`);
                toast.success(`Reverted → ${d.newStatus}`);
              })} />
          )}
          {!["completed", "abandoned", "no_result"].includes(match.status) && (
            <ActionBtn label="Abandon" color="slate" loading={loading === "abandon"}
              onClick={() => {
                if (!confirm("Abandon match and refund all entries?")) return;
                action("abandon", async () => {
                  const d = await post(`/api/admin/matches/${id}/abandon`);
                  toast.success(`Abandoned. ₹${d.totalRefunded} refunded`);
                });
              }} />
          )}
          {match.cricapi_match_id && (
            <ActionBtn label="Force Sync" color="slate" loading={loading === "sync"}
              onClick={() => action("sync", async () => { await post(`/api/admin/matches/${id}/sync`); toast.success("Synced"); })} />
          )}
        </div>

        {/* Match meta */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Contests</p>
            <p className="text-white font-black text-lg">{contests.length}</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Entries</p>
            <p className="text-white font-black text-lg">
              {contests.reduce((s, c) => s + (c.entry_count ?? 0), 0)}
            </p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Players</p>
            <p className="text-white font-black text-lg">{stats.length}</p>
          </div>
        </div>

        {isPaused && (
          <div className="mt-4 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2 text-center">
            <p className="text-orange-400 text-sm font-bold">⏸ Scoring Paused</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["stats", "xi", "contests"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-bold border transition",
              activeTab === t
                ? "bg-brand border-brand text-white"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            )}>
            {t === "xi" ? "Playing XI" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {activeTab === "stats" && (
        <div className="bg-surface-card rounded-2xl border border-slate-700 overflow-hidden">
          {stats.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No stats yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Player", "R", "W", "Ct", "Pts"].map((h) => (
                    <th key={h} className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider font-black text-left last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s: any) => {
                  const player = Array.isArray(s.player) ? s.player[0] : s.player;
                  return (
                    <tr key={s.id} className="border-b border-slate-800/50 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <p className="text-white font-semibold truncate max-w-[140px]">{player?.name}</p>
                        <p className="text-slate-500 text-[10px]">
                          {shortTeam(player?.ipl_team ?? "")} · {player?.role}
                          {s.is_playing_xi && (
                            <span className="ml-1 text-green-400 font-black">✓XI</span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 tabular-nums">{s.runs}</td>
                      <td className="px-3 py-2.5 text-slate-300 tabular-nums">{s.wickets}</td>
                      <td className="px-3 py-2.5 text-slate-300 tabular-nums">{s.catches}</td>
                      <td className="px-3 py-2.5 text-brand font-black tabular-nums text-right">{s.fantasy_points ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Playing XI tab */}
      {activeTab === "xi" && (
        <div className="space-y-3">
          {playingXi.length === 0 ? (
            <div className="bg-surface-card rounded-2xl border border-slate-700 p-6 text-center">
              <p className="text-slate-500 text-sm">No playing XI synced yet</p>
              <button
                onClick={() => action("xi", async () => {
                  const d = await post(`/api/admin/matches/${id}/sync-playing-xi`);
                  toast.success(`${d.playingCount} players confirmed`);
                })}
                className="mt-3 text-brand text-sm font-bold hover:underline"
              >
                Sync from Cricbuzz →
              </button>
            </div>
          ) : (
            <>
              {xiPlaying.length > 0 && (
                <div className="bg-surface-card rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <p className="text-white text-xs font-black uppercase tracking-wider">Playing XI ({xiPlaying.length})</p>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {xiPlaying.map((p: any) => {
                      const player = Array.isArray(p.player) ? p.player[0] : p.player;
                      return (
                        <div key={p.player_id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1">
                            <p className="text-white text-sm font-semibold">{player?.name}</p>
                            <p className="text-slate-500 text-xs">{shortTeam(player?.ipl_team ?? "")} · {player?.role}</p>
                          </div>
                          <span className="text-green-400 text-xs font-bold">✓ Playing</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {xibenched.length > 0 && (
                <div className="bg-surface-card rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider">Benched ({xibenched.length})</p>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {xibenched.map((p: any) => {
                      const player = Array.isArray(p.player) ? p.player[0] : p.player;
                      return (
                        <div key={p.player_id} className="flex items-center gap-3 px-4 py-2.5 opacity-50">
                          <div className="flex-1">
                            <p className="text-white text-sm font-semibold">{player?.name}</p>
                            <p className="text-slate-500 text-xs">{shortTeam(player?.ipl_team ?? "")} · {player?.role}</p>
                          </div>
                          <span className="text-slate-600 text-xs">Benched</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contests tab */}
      {activeTab === "contests" && (
        <div className="space-y-2">
          {contests.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No contests for this match</p>
          ) : (
            contests.map((c) => (
              <div key={c.id} className="bg-surface-card rounded-2xl border border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{c.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {c.contest_type.toUpperCase()} · {c.entry_fee === 0 ? "FREE" : formatCurrency(c.entry_fee)} · {c.entry_count}/{c.max_teams} entries
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand font-black text-sm">{formatCurrency(c.prize_pool)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.status === "open" ? "bg-amber-500/20 text-amber-400" :
                      c.status === "locked" ? "bg-orange-500/20 text-orange-400" :
                      c.status === "completed" ? "bg-green-500/20 text-green-400" :
                      "bg-slate-600 text-slate-400"
                    }`}>
                      {c.status}{c.winner_paid_at ? " ✓ PAID" : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

type BtnColor = "brand" | "red" | "green" | "blue" | "slate";
const BTN_COLORS: Record<BtnColor, string> = {
  brand: "border-brand/50 text-brand hover:bg-brand/10",
  red:   "border-red-500/50 text-red-400 hover:bg-red-500/10",
  green: "border-green-500/50 text-green-400 hover:bg-green-500/10",
  blue:  "border-blue-500/50 text-blue-400 hover:bg-blue-500/10",
  slate: "border-slate-600 text-slate-400 hover:bg-white/5",
};

function ActionBtn({ label, color, onClick, loading }: {
  label: string; color: BtnColor; onClick: () => void; loading: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`text-xs border px-3 py-1.5 rounded-lg transition disabled:opacity-40 font-semibold ${BTN_COLORS[color]}`}>
      {loading ? "…" : label}
    </button>
  );
}
