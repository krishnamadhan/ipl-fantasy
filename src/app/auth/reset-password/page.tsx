"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated!");
      setTimeout(() => router.push("/dashboard"), 1200);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #050a14 0%, #080d1a 50%, #0a0d1a 100%)" }}>
      <Toaster toastOptions={{ style: { background: "#1E293B", color: "white", border: "1px solid #334155" } }} />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-2xl"
            style={{ background: "linear-gradient(135deg, #F5A623, #E8950F)", boxShadow: "0 8px 32px rgba(245,166,35,0.40)" }}>
            🔑
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">Set New Password</h1>
          <p className="text-slate-500 text-sm mt-1">Choose a new password for your account</p>
        </div>

        <div className="rounded-3xl p-6 border shadow-2xl"
          style={{ background: "#111827", borderColor: "rgba(255,255,255,0.07)" }}>
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none transition"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(245,166,35,0.50)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full text-white font-black py-4 rounded-2xl transition disabled:opacity-50 text-base shadow-lg"
              style={{
                background: loading ? "#6B7280" : "linear-gradient(135deg, #F5A623, #E8950F)",
                boxShadow: loading ? "none" : "0 4px 16px rgba(245,166,35,0.35)",
              }}>
              {loading ? "Updating…" : "Update Password →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
