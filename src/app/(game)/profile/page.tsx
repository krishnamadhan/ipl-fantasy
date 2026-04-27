import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import Link from "next/link";
import ProfileEditClient from "./ProfileEditClient";

export const revalidate = 30;

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, statsRes, recentRes] = await Promise.all([
    supabase.from("f11_profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("f11_entries")
      .select("id, total_points, rank, prize_won")
      .eq("user_id", user.id),
    supabase
      .from("f11_transactions")
      .select("type, amount, reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const profile = profileRes.data;
  const entries = statsRes.data ?? [];
  const recentTxns = recentRes.data ?? [];

  const totalContests = entries.length;
  const totalPoints   = entries.reduce((s: number, e: any) => s + (e.total_points ?? 0), 0);
  const totalWon      = entries.reduce((s: number, e: any) => s + (e.prize_won ?? 0), 0);
  const wins          = entries.filter((e: any) => (e.prize_won ?? 0) > 0).length;
  const bestRank      = entries.reduce((best: number | null, e: any) => {
    if (!e.rank) return best;
    return best === null || e.rank < best ? e.rank : best;
  }, null);

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#080d1a", minHeight: "100vh" }}>
      {/* Header gradient strip */}
      <div
        className="h-36 relative"
        style={{ background: "linear-gradient(160deg, #1a1005 0%, #0f1320 60%, #080d1a 100%)" }}
      >
        <div className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: "linear-gradient(to bottom, transparent, #080d1a)" }} />
      </div>

      {/* Avatar + name (overlapping gradient) */}
      <div className="px-4 -mt-20 relative z-10">
        <div className="flex items-end gap-4 mb-4">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black border-2 shrink-0 shadow-xl"
            style={{
              background: "linear-gradient(135deg, rgba(245,166,35,0.25) 0%, rgba(245,166,35,0.10) 100%)",
              borderColor: "rgba(245,166,35,0.40)",
              color: "#F5A623",
              boxShadow: "0 8px 24px rgba(245,166,35,0.20)",
            }}
          >
            {initial}
          </div>
          <div className="pb-1 min-w-0">
            <h1 className="text-white font-black text-xl leading-tight truncate">
              {profile?.display_name ?? profile?.username ?? "Player"}
            </h1>
            <p className="text-slate-500 text-sm">@{profile?.username ?? "—"}</p>
            {profile?.is_admin && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-brand/20 text-brand border border-brand/30">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Edit display name */}
        <ProfileEditClient
          currentName={profile?.display_name ?? profile?.username ?? ""}
        />
      </div>

      {/* Stats grid */}
      <div className="px-4 mt-5">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Season Stats</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Contests", value: totalContests, accent: false },
            { label: "Total Points", value: totalPoints > 0 ? totalPoints.toFixed(0) : "—", accent: false },
            { label: "Best Rank", value: bestRank ? `#${bestRank}` : "—", accent: false },
            { label: "Total Won", value: formatCurrency(totalWon), accent: totalWon > 0 },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="rounded-2xl p-4 text-center border"
              style={{ background: "#111827", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <p className={`font-black text-2xl leading-tight ${accent ? "text-green-400" : "text-white"}`}>
                {value}
              </p>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Wins bar */}
        {totalContests > 0 && (
          <div
            className="mt-2.5 rounded-2xl p-4 border flex items-center justify-between"
            style={{ background: "#111827", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="text-slate-500 text-xs font-bold">Win Rate</p>
              <p className="text-white font-black text-lg leading-tight">
                {Math.round((wins / totalContests) * 100)}%
              </p>
            </div>
            <div className="flex-1 mx-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((wins / totalContests) * 100)}%`,
                    background: "linear-gradient(90deg, #22C55E, #4ADE80)",
                  }}
                />
              </div>
            </div>
            <p className="text-green-400 font-black text-sm">{wins} wins</p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="px-4 mt-5">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Quick Links</p>
        <div className="space-y-2">
          {[
            { href: "/wallet",          label: "Wallet",             sub: formatCurrency(profile?.wallet_balance ?? 0), icon: "💰" },
            { href: "/my-teams",        label: "My Teams",           sub: "View all teams", icon: "🏏" },
            { href: "/contests",        label: "My Contests",        sub: "Active & completed", icon: "🏆" },
            { href: "/leaderboard",     label: "Season Leaderboard", sub: "IPL 2026 standings", icon: "📊" },
            { href: "/players/trending", label: "Trending Players",  sub: "Hot & rising credits", icon: "🔥" },
          ].map(({ href, label, sub, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-white/6 hover:border-white/12 transition"
              style={{ background: "rgba(255,255,255,0.025)" }}
            >
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-base shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{label}</p>
                <p className="text-slate-500 text-xs truncate">{sub}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      {recentTxns.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Recent Activity</p>
            <Link href="/wallet" className="text-brand text-xs font-bold">View all →</Link>
          </div>
          <div className="space-y-1.5">
            {recentTxns.map((tx: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border"
                style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{
                    background: tx.type === "credit" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: tx.type === "credit" ? "#4ADE80" : "#F87171",
                  }}
                >
                  {tx.type === "credit" ? "↑" : "↓"}
                </div>
                <p className="text-slate-300 text-xs truncate flex-1">{tx.reason}</p>
                <p
                  className="text-xs font-black shrink-0"
                  style={{ color: tx.type === "credit" ? "#4ADE80" : "#F87171" }}
                >
                  {tx.type === "credit" ? "+" : "−"}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="px-4 mt-5">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="w-full border border-red-500/25 text-red-400 rounded-2xl py-3.5 font-bold hover:bg-red-500/8 transition text-sm"
            style={{ background: "rgba(239,68,68,0.04)" }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
