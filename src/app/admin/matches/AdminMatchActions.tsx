"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function AdminMatchActions({ match }: { match: any }) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function act(key: string, url: string) {
    setLoading(key);
    try {
      const res = await fetch(url, { method: "POST" });
      const d = await res.json();
      if (d.ok) { toast.success("Done!"); router.refresh(); }
      else toast.error(d.error ?? "Error");
    } finally { setLoading(null); }
  }

  const id = match.id;
  return (
    <div className="flex gap-2 flex-wrap">
      {match.cricapi_match_id && (
        <Btn label="Force Sync" loading={loading === "sync"}
          onClick={() => act("sync", `/api/admin/matches/${id}/sync`)} />
      )}
      {match.status === "scheduled" && (
        <Btn label="Open Lineups" loading={loading === "lock"}
          onClick={() => act("lock", `/api/admin/matches/${id}/lock`)} />
      )}
      {(match.status === "open" || match.status === "locked") && (
        <Btn label="Sync Playing XI" loading={loading === "xi"}
          onClick={() => act("xi", `/api/admin/matches/${id}/sync-playing-xi`)} />
      )}
      {match.status === "locked" && (
        <Btn label="Go Live 🔴" loading={loading === "live"}
          onClick={() => {
            if (!confirm("Start live scoring? Teams will be locked.")) return;
            act("live", `/api/admin/matches/${id}/go-live`);
          }} />
      )}
      {match.status === "in_review" && (
        <Btn label="Finalize ✓" loading={loading === "complete"}
          onClick={() => {
            if (!confirm("Finalize? This pays out all winners.")) return;
            act("complete", `/api/admin/matches/${id}/complete`);
          }} />
      )}
      {!["completed", "abandoned", "no_result"].includes(match.status) && (
        <Btn label="Abandon" loading={loading === "abandon"}
          onClick={() => {
            if (!confirm("Abandon match and refund all entries?")) return;
            act("abandon", `/api/admin/matches/${id}/abandon`);
          }} />
      )}
    </div>
  );
}

function Btn({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick} disabled={loading}
      className="text-xs bg-surface-elevated border border-slate-600 text-white px-3 py-1.5 rounded-lg hover:border-brand transition disabled:opacity-50"
    >
      {loading ? "…" : label}
    </button>
  );
}
