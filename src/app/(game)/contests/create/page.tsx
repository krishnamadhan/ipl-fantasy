"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { formatCurrency } from "@/lib/utils/format";

export default function CreateContestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [form, setForm] = useState({
    match_id: "",
    name: "",
    contest_type: "private" as const,
    entry_fee: 0,
    max_teams: 10,
    prize_pool_type: "winner_takes_all",
  });

  useEffect(() => {
    fetch("/api/matches?status=open,scheduled")
      .then((r) => r.json())
      .then(setMatches)
      .catch(() => {});
  }, []);

  const estimatedPrize = form.entry_fee * form.max_teams * 0.9;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Contest created!");
      if (data.contest?.invite_code) {
        toast.success(`Invite code: ${data.contest.invite_code}`, { duration: 8000 });
      }
      router.push(`/contests/${data.contest.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <Toaster />
      <h1 className="text-xl font-bold text-white mb-6">Create Contest</h1>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-slate-300 text-sm mb-1">Match</label>
          <select
            value={form.match_id}
            onChange={(e) => setForm({ ...form, match_id: e.target.value })}
            className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
            required
          >
            <option value="">Select match…</option>
            {matches.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.team_home} vs {m.team_away}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-300 text-sm mb-1">Contest Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
            placeholder="e.g., Friends League"
            required
          />
        </div>

        <div>
          <label className="block text-slate-300 text-sm mb-1">Type</label>
          <div className="grid grid-cols-4 gap-2">
            {["private", "h2h", "small", "mega"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, contest_type: t as any })}
                className={`py-2 rounded-xl text-xs font-semibold transition ${
                  form.contest_type === t ? "bg-brand text-white" : "bg-surface-elevated text-slate-400"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1">Entry Fee (₹)</label>
            <input
              type="number"
              min={0}
              value={form.entry_fee}
              onChange={(e) => setForm({ ...form, entry_fee: Number(e.target.value) })}
              className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1">Max Teams</label>
            <input
              type="number"
              min={2}
              max={1000}
              value={form.max_teams}
              onChange={(e) => setForm({ ...form, max_teams: Number(e.target.value) })}
              className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {estimatedPrize > 0 && (
          <div className="bg-brand/10 border border-brand/30 rounded-xl p-3">
            <p className="text-brand font-semibold text-sm">
              Estimated Prize Pool: {formatCurrency(estimatedPrize)}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">10% platform fee deducted</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-brand-dark transition"
        >
          {loading ? "Creating…" : "Create Contest"}
        </button>
      </form>
    </div>
  );
}
