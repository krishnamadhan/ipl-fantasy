"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #050a14 0%, #080d1a 50%, #0a0d1a 100%)" }}
    >
      <Toaster toastOptions={{ style: { background: "#1E293B", color: "white", border: "1px solid #334155" } }} />

      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
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
          <h1 className="text-white font-black text-2xl tracking-tight">IPL Fantasy 2026</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to play</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6 border shadow-2xl"
          style={{ background: "#111827", borderColor: "rgba(255,255,255,0.07)" }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
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
                className="w-full rounded-xl px-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(245,166,35,0.50)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-black py-4 rounded-2xl transition disabled:opacity-50 text-base shadow-lg"
              style={{
                background: loading ? "#6B7280" : "linear-gradient(135deg, #F5A623, #E8950F)",
                boxShadow: loading ? "none" : "0 4px 16px rgba(245,166,35,0.35)",
              }}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <div className="flex items-center my-5">
            <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
            <span className="px-3 text-slate-600 text-xs font-bold uppercase">or</span>
            <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-sm transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#E2E8F0",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-slate-500 text-sm mt-5">
            No account?{" "}
            <Link href="/register" className="text-brand font-bold hover:underline">
              Register free
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
