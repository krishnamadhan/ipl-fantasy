"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { shortTeam } from "@/lib/utils/format";

export default function AdminPlayersClient({ players: initial }: { players: any[] }) {
  const [players, setPlayers] = useState(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editCredit, setEditCredit] = useState("");

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  async function saveCredit(playerId: string) {
    const credit = parseFloat(editCredit);
    if (isNaN(credit) || credit < 6 || credit > 12) {
      toast.error("Credit must be between 6.0 and 12.0");
      return;
    }

    const res = await fetch(`/api/admin/players/${playerId}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credit_value: credit, override: true }),
    });

    if (res.ok) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, credit_value: credit, credit_override: true } : p))
      );
      toast.success("Credit updated");
      setEditing(null);
    } else {
      toast.error("Failed to update");
    }
  }

  async function togglePlaying(playerId: string, current: boolean) {
    const res = await fetch(`/api/admin/players/${playerId}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_playing: !current }),
    });
    if (res.ok) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, is_playing: !current } : p))
      );
      toast.success("Updated");
    }
  }

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Players ({players.length})</h1>
        <button
          onClick={async () => {
            const d = await fetch("/api/admin/players/sync", { method: "POST" }).then((r) => r.json());
            toast.success(`Synced ${d.recordsUpserted ?? 0} players`);
          }}
          className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          Sync Squads
        </button>
      </div>

      <input
        type="search"
        placeholder="Search player..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="pb-2 pr-3">Player</th>
              <th className="pb-2 pr-3">Team</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 pr-3">Credit</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-700">
                <td className="py-2 pr-3">
                  <p className={`font-medium ${p.is_playing ? "text-white" : "text-slate-500 line-through"}`}>
                    {p.name}
                  </p>
                </td>
                <td className="py-2 pr-3 text-slate-400">{shortTeam(p.ipl_team)}</td>
                <td className="py-2 pr-3 text-slate-400">{p.role}</td>
                <td className="py-2 pr-3">
                  {editing === p.id ? (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="6"
                        max="12"
                        value={editCredit}
                        onChange={(e) => setEditCredit(e.target.value)}
                        className="w-16 bg-surface-elevated border border-brand rounded px-2 py-0.5 text-white text-sm"
                      />
                      <button onClick={() => saveCredit(p.id)} className="text-green-400 text-xs px-2">✓</button>
                      <button onClick={() => setEditing(null)} className="text-red-400 text-xs px-2">✗</button>
                    </div>
                  ) : (
                    <span className={`font-semibold ${p.credit_override ? "text-yellow-400" : "text-brand"}`}>
                      {p.credit_value}
                      {p.credit_override && " 🔒"}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditing(p.id); setEditCredit(String(p.credit_value)); }}
                      className="text-xs text-slate-400 hover:text-white border border-slate-600 px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePlaying(p.id, p.is_playing)}
                      className={`text-xs border px-2 py-1 rounded ${p.is_playing ? "text-red-400 border-red-500/30" : "text-green-400 border-green-500/30"}`}
                    >
                      {p.is_playing ? "Bench" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
