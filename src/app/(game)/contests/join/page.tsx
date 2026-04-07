"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { shortTeam } from "@/lib/utils/format";

function JoinByCodeContent() {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-populate code from URL and trigger preview
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      const upper = codeParam.toUpperCase();
      setCode(upper);
      fetchPreview(upper);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPreview(c: string) {
    if (c.trim().length < 4) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contests/join/${c.trim().toUpperCase()}`);
      if (!res.ok) { toast.error("Invalid invite code"); setPreview(null); return; }
      setPreview(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    fetchPreview(code);
  }

  function handleJoin() {
    if (!preview) return;
    // Redirect to browse page — user selects their team and joins there
    router.push(`/contests/browse/${preview.match_id}`);
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <Toaster />
      <h1 className="text-xl font-bold text-white mb-6">Join Private Contest</h1>

      <div
        className="rounded-2xl p-5 border space-y-4"
        style={{ background: "#111827", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div>
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            Invite Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="e.g. AB3X7Y"
            className="w-full rounded-xl px-4 py-3 text-white font-mono text-xl tracking-widest text-center uppercase focus:outline-none transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(245,166,35,0.50)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
          />
        </div>

        <button
          onClick={handlePreview}
          disabled={loading || code.length < 4}
          className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40 transition"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {loading ? "Looking up…" : "Find Contest"}
        </button>

        {preview && (
          <div
            className="rounded-xl p-4 space-y-3 border"
            style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.30)" }}
          >
            <p className="text-white font-bold">{preview.name}</p>
            {preview.match && (
              <p className="text-slate-400 text-sm">
                {shortTeam(preview.match.team_home)} vs {shortTeam(preview.match.team_away)}
              </p>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entry</span>
              <span className="text-white font-semibold">
                {preview.entry_fee === 0 ? (
                  <span className="text-green-400">FREE</span>
                ) : (
                  `${preview.entry_fee.toLocaleString("en-IN")} pts`
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Prize Pool</span>
              <span className="font-bold" style={{ color: "#F5A623" }}>
                {preview.prize_pool === 0
                  ? `${(preview.entry_fee * (preview.entry_count ?? 0) * 0.9).toLocaleString("en-IN")} pts`
                  : `${preview.prize_pool.toLocaleString("en-IN")} pts`}
              </span>
            </div>
            <button
              onClick={handleJoin}
              className="w-full py-3 rounded-xl font-black text-white text-base shadow-lg transition"
              style={{
                background: "linear-gradient(135deg, #F5A623, #E8950F)",
                boxShadow: "0 4px 16px rgba(245,166,35,0.35)",
              }}
            >
              Select Team &amp; Join →
            </button>
            <p className="text-slate-500 text-xs text-center">
              You&apos;ll pick your team on the next screen
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinByCodePage() {
  return (
    <Suspense>
      <JoinByCodeContent />
    </Suspense>
  );
}
