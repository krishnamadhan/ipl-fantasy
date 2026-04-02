"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { formatCurrency } from "@/lib/utils/format";

export default function AdminWalletsPage() {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<any>(null);

  async function lookupUser() {
    const res = await fetch(`/api/admin/users/lookup?username=${username}`);
    if (!res.ok) { toast.error("User not found"); return; }
    const d = await res.json();
    setFound(d);
    setUserId(d.id);
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) { toast.error("Look up user first"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/wallet/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, type, amount: Number(amount), reason }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Wallet adjusted!");
        setAmount(""); setReason(""); setFound(null); setUserId(""); setUsername("");
      } else toast.error(d.error);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-lg space-y-6">
      <Toaster />
      <h1 className="text-xl font-bold text-white">Wallet Adjustment</h1>

      <div className="bg-surface-card rounded-2xl p-5 border border-slate-700 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1 bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
          />
          <button onClick={lookupUser} className="bg-brand text-white px-4 rounded-xl font-semibold">
            Find
          </button>
        </div>

        {found && (
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-white font-semibold">{found.display_name ?? found.username}</p>
            <p className="text-brand">{formatCurrency(found.wallet_balance)}</p>
          </div>
        )}

        <form onSubmit={handleAdjust} className="space-y-3">
          <div className="flex gap-2">
            {(["credit", "debit"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                  type === t ? (t === "credit" ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40") : "bg-surface-elevated text-slate-400"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <input
            type="number"
            min={1}
            placeholder="Amount (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
            required
          />

          <input
            type="text"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
            required
          />

          <button
            type="submit"
            disabled={loading || !userId}
            className="w-full bg-brand text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {loading ? "Processing…" : "Apply Adjustment"}
          </button>
        </form>
      </div>
    </div>
  );
}
