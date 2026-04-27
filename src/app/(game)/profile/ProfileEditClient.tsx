"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function ProfileEditClient({ currentName }: { currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(currentName);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!name.trim() || name.trim() === currentName) {
      setEditing(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Name updated!");
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: "#1E293B", color: "white", border: "1px solid #334155" } }} />

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="Display name"
            className="flex-1 bg-surface-card border border-brand/40 rounded-xl px-3 py-2.5 text-white text-sm font-bold outline-none focus:border-brand transition"
          />
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40 transition"
            style={{ background: "linear-gradient(135deg, #F5A623, #E8950F)" }}
          >
            {loading ? "…" : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); setName(currentName); }}
            className="px-3 py-2.5 rounded-xl text-sm font-bold text-slate-400 border border-white/10 hover:border-white/20 transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-brand text-xs font-bold border border-brand/30 px-3 py-1.5 rounded-xl hover:bg-brand/5 transition"
        >
          Edit name
        </button>
      )}
    </>
  );
}
