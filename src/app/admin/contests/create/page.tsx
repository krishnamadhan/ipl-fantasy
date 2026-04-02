"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/format";
import toast, { Toaster } from "react-hot-toast";

const CONTEST_TYPES = [
  { id: "mega",  label: "Mega",    desc: "Large pool, top 50% win",   color: "border-yellow-500/40 bg-yellow-500/10" },
  { id: "small", label: "Small",   desc: "Limited spots, top 3 win",  color: "border-blue-500/40 bg-blue-500/10" },
  { id: "h2h",   label: "H2H",     desc: "2 teams, winner takes all", color: "border-green-500/40 bg-green-500/10" },
  { id: "private", label: "Private", desc: "Invite-only contest",     color: "border-purple-500/40 bg-purple-500/10" },
];

function computePrizeTiers(contestType: string, entryFee: number, maxTeams: number) {
  const net = entryFee * maxTeams * 0.9;
  if (contestType === "h2h") {
    return [{ minRank: 1, maxRank: 1, prizeAmount: Math.floor(net), label: "Winner" }];
  }
  type Spec = { share: number; fromPct: number; toPct: number; label: string };
  let specs: Spec[];
  if (maxTeams <= 10) {
    specs = [
      { share: 0.60, fromPct: 0, toPct: 10, label: "1st" },
      { share: 0.25, fromPct: 10, toPct: 20, label: "2nd" },
      { share: 0.15, fromPct: 20, toPct: 50, label: "3rd–5th" },
    ];
  } else if (maxTeams <= 100) {
    specs = [
      { share: 0.40, fromPct: 0, toPct: 1, label: "1st" },
      { share: 0.20, fromPct: 1, toPct: 5, label: "2nd–5th" },
      { share: 0.20, fromPct: 5, toPct: 15, label: "Top 15%" },
      { share: 0.20, fromPct: 15, toPct: 40, label: "Top 40%" },
    ];
  } else {
    specs = [
      { share: 0.20, fromPct: 0, toPct: 1, label: "Top 1%" },
      { share: 0.20, fromPct: 1, toPct: 5, label: "Top 5%" },
      { share: 0.25, fromPct: 5, toPct: 15, label: "Top 15%" },
      { share: 0.35, fromPct: 15, toPct: 50, label: "Top 50%" },
    ];
  }
  return specs.map((s) => {
    const minRank = Math.max(1, Math.ceil(maxTeams * s.fromPct / 100));
    const maxRank = Math.max(minRank, Math.floor(maxTeams * s.toPct / 100));
    const count = maxRank - minRank + 1;
    return { minRank, maxRank, prizeAmount: Math.floor(net * s.share / count), label: s.label };
  }).filter((t) => t.prizeAmount > 0);
}

export default function AdminCreateContestPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [matchId, setMatchId] = useState("");
  const [contestType, setContestType] = useState("small");
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState(50);
  const [maxTeams, setMaxTeams] = useState(20);
  const [guaranteed, setGuaranteed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const prizePool = entryFee * maxTeams * 0.9;
  const tiers = computePrizeTiers(contestType, entryFee, maxTeams);
  const winnersCount = tiers.reduce((s, t) => s + (t.maxRank - t.minRank + 1), 0);

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => { setMatches(d.matches ?? d ?? []); setMatchId(d.matches?.[0]?.id ?? d?.[0]?.id ?? ""); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId) { toast.error("Select a match"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/contests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, name, contest_type: contestType, entry_fee: entryFee, max_teams: maxTeams, guaranteed_pool: guaranteed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Contest created!");
      setTimeout(() => router.push("/admin/contests"), 1000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Toaster />
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white">←</button>
        <h1 className="text-xl font-bold text-white">Create Contest</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Match */}
        <div className="bg-surface-card rounded-2xl p-5 border border-slate-700 space-y-3">
          <h2 className="text-white font-semibold">Match</h2>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
          >
            {matches.length === 0 && <option value="">No upcoming matches — sync schedule first</option>}
            {matches.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.team_home} vs {m.team_away} — {new Date(m.scheduled_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {/* Contest type */}
        <div className="bg-surface-card rounded-2xl p-5 border border-slate-700 space-y-3">
          <h2 className="text-white font-semibold">Contest Type</h2>
          <div className="grid grid-cols-2 gap-3">
            {CONTEST_TYPES.map((t) => (
              <button
                key={t.id} type="button"
                onClick={() => { setContestType(t.id); if (t.id === "h2h") setMaxTeams(2); }}
                className={`p-3 rounded-xl border text-left transition ${contestType === t.id ? t.color : "border-slate-700 bg-surface-elevated"}`}
              >
                <p className="text-white font-semibold text-sm">{t.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div className="bg-surface-card rounded-2xl p-5 border border-slate-700 space-y-4">
          <h2 className="text-white font-semibold">Parameters</h2>

          <div>
            <label className="text-slate-400 text-xs mb-1 block">Contest Name (optional)</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mega Contest · ₹5K"
              className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Entry Fee (₹)</label>
              <input
                type="number" min={0} value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
                className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Max Teams</label>
              <input
                type="number" min={2} max={100000} value={maxTeams}
                onChange={(e) => setMaxTeams(Number(e.target.value))}
                disabled={contestType === "h2h"}
                className="w-full bg-surface-elevated border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand disabled:opacity-50"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setGuaranteed(!guaranteed)}
              className={`w-10 h-6 rounded-full transition-colors ${guaranteed ? "bg-brand" : "bg-slate-600"} relative`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${guaranteed ? "left-5" : "left-1"}`} />
            </div>
            <span className="text-white text-sm">Guaranteed Prize Pool</span>
            <span className="text-slate-400 text-xs">(runs even if not full)</span>
          </label>
        </div>

        {/* Prize Preview */}
        <div className="bg-surface-card rounded-2xl p-5 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Prize Breakdown</h2>
            <div className="text-right">
              <p className="text-brand font-bold text-lg">{formatCurrency(prizePool)}</p>
              <p className="text-slate-400 text-xs">Total Pool · {winnersCount} winners</p>
            </div>
          </div>

          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <span className="text-white text-sm font-medium">{t.label}</span>
                  {t.maxRank > t.minRank && (
                    <span className="text-slate-400 text-xs ml-2">
                      (Rank {t.minRank}–{t.maxRank}, {t.maxRank - t.minRank + 1} winners)
                    </span>
                  )}
                </div>
                <span className="text-green-400 font-bold">{formatCurrency(t.prizeAmount)}</span>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-xs">10% platform fee applied. {guaranteed ? "Guaranteed pool." : "Dynamic — scales with entries."}</p>
        </div>

        <button
          type="submit" disabled={submitting}
          className="w-full bg-brand text-white font-bold py-4 rounded-2xl hover:bg-brand-dark transition disabled:opacity-40 text-lg"
        >
          {submitting ? "Creating…" : "Create Contest"}
        </button>
      </form>
    </div>
  );
}
