"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function AdminContestActions({ contest }: { contest: any }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function cancel() {
    if (!confirm(`Cancel "${contest.name}" and refund all entries?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contests/${contest.id}/cancel`, { method: "POST" });
      const d = await res.json();
      if (d.ok) { toast.success(`Cancelled. ${d.refunded} refunds.`); router.refresh(); }
      else toast.error(d.error);
    } finally { setLoading(false); }
  }

  async function deleteContest() {
    if (!confirm(`Permanently delete "${contest.name}" and all its entries? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contests/${contest.id}/delete`, { method: "DELETE" });
      const d = await res.json();
      if (d.ok) { toast.success(`Deleted "${d.deleted}"`); router.refresh(); }
      else toast.error(d.error);
    } finally { setLoading(false); }
  }

  async function payout() {
    if (!confirm(`Distribute prizes for "${contest.name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contests/${contest.id}/payout`, { method: "POST" });
      const d = await res.json();
      if (d.ok) { toast.success("Prizes distributed!"); router.refresh(); }
      else toast.error(d.error);
    } finally { setLoading(false); }
  }

  return (
    <div className="flex gap-2">
      {contest.status === "completed" && !contest.winner_paid_at && (
        <button onClick={payout} disabled={loading}
          className="text-xs bg-brand/20 border border-brand/40 text-brand px-3 py-1.5 rounded-lg disabled:opacity-50">
          {loading ? "…" : "Distribute Prizes"}
        </button>
      )}
      {["open", "locked"].includes(contest.status) && (
        <button onClick={cancel} disabled={loading}
          className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50">
          {loading ? "…" : "Cancel & Refund"}
        </button>
      )}
      {["completed", "cancelled"].includes(contest.status) && (
        <button onClick={deleteContest} disabled={loading}
          className="text-xs bg-red-900/30 border border-red-800/50 text-red-500 px-3 py-1.5 rounded-lg disabled:opacity-50">
          {loading ? "…" : "🗑 Delete"}
        </button>
      )}
    </div>
  );
}
