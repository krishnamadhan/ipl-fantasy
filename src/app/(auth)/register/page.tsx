"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: username } },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Account created! ₹10,000 bonus added 🎉");
      router.push("/dashboard");
      router.refresh();
    }
  }

  const fieldClass = "w-full rounded-xl px-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none transition";
  const fieldStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #050a14 0%, #080d1a 50%, #0a0d1a 100%)" }}
    >
      <Toaster toastOptions={{ style: { background: "#1E293B", color: "white", border: "1px solid #334155" } }} />

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #F5A623, #E8950F)",
              boxShadow: "0 8px 32px rgba(245,166,35,0.40)",
            }}
          >
            🏏
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">Join IPL Fantasy</h1>
          {/* Bonus banner */}
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.20)" }}>
            <span className="text-green-400 text-xs font-black">🎁 ₹10,000 signup bonus</span>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6 border shadow-2xl"
          style={{ background: "#111827", borderColor: "rgba(255,255,255,0.07)" }}
        >
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className={fieldClass}
                style={fieldStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(245,166,35,0.50)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
                placeholder="coolcricketer"
                minLength={3}
                maxLength={20}
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(245,166,35,0.50)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(245,166,35,0.50)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-black py-4 rounded-2xl transition disabled:opacity-50 text-base shadow-lg mt-2"
              style={{
                background: loading ? "#6B7280" : "linear-gradient(135deg, #F5A623, #E8950F)",
                boxShadow: loading ? "none" : "0 4px 16px rgba(245,166,35,0.35)",
              }}
            >
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-5">
            Have an account?{" "}
            <Link href="/login" className="text-brand font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          IPL Fantasy 2026 · Private friend group app
        </p>
      </div>
    </div>
  );
}
