"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { formatDateTime, shortTeam } from "@/lib/utils/format";
import Link from "next/link";

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

export default function AdminDashboard({
  matches,
  recentPlayers,
  syncLog,
}: {
  matches: any[];
  recentPlayers: any[];
  syncLog: any[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  async function post(url: string, body?: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function action(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try {
      await fn();
      setRefresh((r) => r + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <Toaster />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-slate-400 text-sm">IPL Fantasy control panel</p>
        </div>
        <Link href="/admin/contests/create"
          className="bg-brand text-white text-sm font-bold px-4 py-2 rounded-xl hover:opacity-90 transition">
          + Create Contest
        </Link>
      </div>

      {/* Sync actions */}
      <div>
        <h2 className="text-white font-bold mb-3">Data Sync</h2>
        <div className="grid grid-cols-2 gap-3">
          <SyncCard
            label="Sync Schedule"
            sub="Fetch upcoming IPL matches"
            loading={loading === "sync-schedule"}
            onClick={() => action("sync-schedule", async () => {
              const d = await post("/api/admin/sync-schedule");
              if (d.ok) toast.success(`${d.matchesSynced ?? 0} matches synced`);
              else toast.error(d.error ?? "Sync failed");
            })}
          />
          <SyncCard
            label="Sync Squads"
            sub="Fetch all IPL players"
            loading={loading === "sync-squads"}
            onClick={() => action("sync-squads", async () => {
              const d = await post("/api/admin/sync-squads");
              if (d.ok) {
                const rc = d.roleCounts ?? {};
                const breakdown = Object.entries(rc).map(([r, n]) => `${n}${r}`).join(" · ");
                toast.success(`${d.playersUpserted ?? 0} players synced${breakdown ? ` (${breakdown})` : ""}`);
              } else toast.error(d.error ?? "Sync failed");
            })}
          />
          <SyncCard
            label="Sync Live Scores"
            sub="Update points for live matches"
            loading={loading === "sync-live"}
            onClick={() => action("sync-live", async () => {
              const d = await post("/api/cron/sync-live");
              if (d.ok) {
                const updated = (d.results ?? []).reduce((s: number, r: any) => s + (r.playersUpdated ?? 0), 0);
                toast.success(d.message ?? `${updated} player stats updated`);
              } else toast.error(d.error ?? "Sync failed");
            })}
          />
          <SyncCard
            label="Enforce Deadlines"
            sub="Lock/open matches by schedule"
            loading={loading === "enforce-deadlines"}
            onClick={() => action("enforce-deadlines", async () => {
              const d = await post("/api/cron/enforce-deadlines");
              if (d.ok) {
                const msg = [
                  d.opened?.length && `Opened: ${d.opened.join(", ")}`,
                  d.locked?.length && `Locked: ${d.locked.join(", ")}`,
                  !d.opened?.length && !d.locked?.length && "Nothing to update",
                ].filter(Boolean).join(" · ");
                toast.success(msg);
              } else toast.error(d.error ?? "Failed");
            })}
          />
        </div>
      </div>

      {/* Match management */}
      <div>
        <h2 className="text-white font-bold mb-3">Match Management</h2>
        <div className="space-y-3">
          {matches.length === 0 && (
            <p className="text-slate-500 text-sm">No matches. Sync schedule first.</p>
          )}
          {matches.map((m) => (
            <div key={`${m.id}-${refresh}`} className="bg-surface-card rounded-2xl border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-bold">
                    {shortTeam(m.team_home)} vs {shortTeam(m.team_away)}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">{formatDateTime(m.scheduled_at)}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[m.status] ?? "bg-slate-600 text-slate-300"}`}>
                  {m.status === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1 animate-pulse align-middle" />}
                  {m.status?.replace("_", " ").toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Forward actions by state */}
                {m.status === "scheduled" && (
                  <ActionBtn label="Open Lineups" color="brand" loading={loading === `lock-${m.id}`}
                    onClick={() => action(`lock-${m.id}`, async () => {
                      const d = await post(`/api/admin/matches/${m.id}/lock`);
                      if (d.ok) toast.success("Lineups open!"); else toast.error(d.error);
                    })} />
                )}
                {m.status === "open" && (
                  <ActionBtn label="Sync Playing XI" color="blue" loading={loading === `xi-${m.id}`}
                    onClick={() => action(`xi-${m.id}`, async () => {
                      const d = await post(`/api/admin/matches/${m.id}/sync-playing-xi`);
                      if (d.ok) toast.success(`Playing XI: ${d.playingCount} players`);
                      else toast.error(d.error ?? "Sync failed");
                    })} />
                )}
                {m.status === "locked" && (
                  <>
                    <ActionBtn label="Sync Playing XI" color="blue" loading={loading === `xi-${m.id}`}
                      onClick={() => action(`xi-${m.id}`, async () => {
                        const d = await post(`/api/admin/matches/${m.id}/sync-playing-xi`);
                        if (d.ok) toast.success(`Playing XI: ${d.playingCount} players`);
                        else toast.error(d.error ?? "Sync failed");
                      })} />
                    <ActionBtn label="Go Live 🔴" color="red" loading={loading === `live-${m.id}`}
                      onClick={() => {
                        if (!confirm("Start live scoring? This locks all teams.")) return;
                        action(`live-${m.id}`, async () => {
                          const d = await post(`/api/admin/matches/${m.id}/go-live`);
                          if (d.ok) toast.success("Match is live!"); else toast.error(d.error);
                        });
                      }} />
                  </>
                )}
                {m.status === "in_review" && (
                  <ActionBtn label="Finalize ✓" color="green" loading={loading === `complete-${m.id}`}
                    onClick={() => {
                      if (!confirm("Finalize match? This pays out all contest winners.")) return;
                      action(`complete-${m.id}`, async () => {
                        const d = await post(`/api/admin/matches/${m.id}/complete`);
                        if (d.ok) toast.success(`Match finalized! ${d.payouts?.length ?? 0} contests paid`);
                        else toast.error(d.error);
                      });
                    }} />
                )}

                {/* Abandon (available for any non-terminal state) */}
                {!["completed", "abandoned", "no_result"].includes(m.status) && (
                  <ActionBtn label="Abandon" color="slate" loading={loading === `abandon-${m.id}`}
                    onClick={() => {
                      if (!confirm("Abandon match? All entry fees will be refunded.")) return;
                      action(`abandon-${m.id}`, async () => {
                        const d = await post(`/api/admin/matches/${m.id}/abandon`);
                        if (d.ok) toast.success(`Abandoned. ₹${d.totalRefunded} refunded.`);
                        else toast.error(d.error ?? "Failed");
                      });
                    }} />
                )}

                {/* Revert (available for non-scheduled, non-terminal states) */}
                {!["scheduled", "completed", "abandoned", "no_result"].includes(m.status) && (
                  <ActionBtn
                    label="↩ Revert"
                    color="slate"
                    loading={loading === `revert-${m.id}`}
                    onClick={() => action(`revert-${m.id}`, async () => {
                      const d = await post(`/api/admin/matches/${m.id}/revert`);
                      if (d.ok) toast.success(`Reverted → ${d.newStatus}`);
                      else toast.error(d.error ?? "Revert failed");
                    })}
                  />
                )}

                {/* Force sync */}
                {m.cricapi_match_id && (
                  <ActionBtn label="Force Sync" color="slate" loading={loading === `sync-${m.id}`}
                    onClick={() => action(`sync-${m.id}`, async () => {
                      const d = await post(`/api/admin/matches/${m.id}/sync`);
                      if (d.ok) toast.success("Synced!"); else toast.error(d.error);
                    })} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent players */}
      {recentPlayers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold">Players</h2>
            <Link href="/admin/players" className="text-brand text-sm">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recentPlayers.slice(0, 6).map((p: any) => (
              <div key={p.id} className="bg-surface-card rounded-xl p-3 border border-slate-700">
                <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                <p className="text-slate-400 text-xs">{p.ipl_team} · {p.role} · {p.credit_value} cr</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div>
          <h2 className="text-white font-bold mb-3">Sync Log</h2>
          <div className="space-y-2">
            {syncLog.map((log) => (
              <div key={log.id} className="bg-surface-card rounded-xl p-3 border border-slate-700 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${log.status === "success" ? "bg-green-400" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{log.sync_type}</p>
                  {log.error_message && <p className="text-red-400 text-xs truncate">{log.error_message}</p>}
                </div>
                <div className="text-right text-xs text-slate-400 shrink-0">
                  <p>{log.records_upserted ?? 0} records</p>
                  {log.duration_ms && <p>{log.duration_ms}ms</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SyncCard({ label, sub, loading, onClick }: { label: string; sub: string; loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="bg-surface-card border border-slate-700 hover:border-brand rounded-2xl p-4 text-left transition disabled:opacity-50 w-full">
      <p className="text-white font-semibold text-sm">{loading ? "Syncing…" : label}</p>
      <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
    </button>
  );
}

type BtnColor = "brand" | "red" | "green" | "blue" | "slate";
const BTN_COLORS: Record<BtnColor, string> = {
  brand: "border-brand/50 text-brand hover:bg-brand/10",
  red:   "border-red-500/50 text-red-400 hover:bg-red-500/10",
  green: "border-green-500/50 text-green-400 hover:bg-green-500/10",
  blue:  "border-blue-500/50 text-blue-400 hover:bg-blue-500/10",
  slate: "border-slate-600 text-slate-400 hover:bg-slate-700/50",
};

function ActionBtn({ label, onClick, loading, color = "slate" }: {
  label: string; onClick: () => void; loading: boolean; color?: BtnColor;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`text-xs border px-3 py-1.5 rounded-lg transition disabled:opacity-40 ${BTN_COLORS[color]}`}>
      {loading ? "…" : label}
    </button>
  );
}
