"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { formatCurrency, shortTeam } from "@/lib/utils/format";

export default function JoinByCodePage() {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  async function handlePreview() {
    if (code.trim().length < 4) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contests/join/${code.trim().toUpperCase()}`);
      if (!res.ok) { toast.error("Invalid invite code"); setPreview(null); return; }
      setPreview(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!preview) return;
    const saved = sessionStorage.getItem(`team_${preview.match_id}`);
    if (!saved) {
      toast.error("Build your team first!");
      router.push(`/team-builder/${preview.match_id}`);
      return;
    }

    setJoining(true);
    try {
      const team = JSON.parse(saved);
      const res = await fetch("/api/contests/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contest_id: preview.id, ...team }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Joined!");
      router.push(`/contests/${preview.id}`);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <Toaster />
      <h1 className="text-xl font-bold text-white mb-6">Join Private Contest</h1>

      <div className="bg-surface-card rounded-2xl p-5 border border-slate-700 space-y-4">
        <div>
          <label className="block text-slate-300 text-sm mb-1">6-Character Invite Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="e.g. AB3X7Y"
            className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-3 text-white font-mono text-xl tracking-widest text-center uppercase focus:outline-none focus:border-brand"
          />
        </div>

        <button
          onClick={handlePreview}
          disabled={loading || code.length < 4}
          className="w-full bg-surface-elevated border border-slate-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Find Contest"}
        </button>

        {preview && (
          <div className="bg-brand/10 border border-brand/30 rounded-xl p-4 space-y-2">
            <p className="text-white font-bold">{preview.name}</p>
            {preview.match && (
              <p className="text-slate-400 text-sm">
                {shortTeam(preview.match.team_home)} vs {shortTeam(preview.match.team_away)}
              </p>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entry Fee</span>
              <span className="text-white font-semibold">{formatCurrency(preview.entry_fee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Prize Pool</span>
              <span className="text-brand font-bold">{formatCurrency(preview.prize_pool)}</span>
            </div>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-brand text-white py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {joining ? "Joining…" : `Join · ${formatCurrency(preview.entry_fee)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
