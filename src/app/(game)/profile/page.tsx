import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, statsRes] = await Promise.all([
    supabase.from("f11_profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("f11_entries")
      .select("id, total_points, rank, prize_won")
      .eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const entries = statsRes.data ?? [];
  const totalContests = entries.length;
  const totalPoints = entries.reduce((s: number, e: any) => s + (e.total_points ?? 0), 0);
  const totalWon = entries.reduce((s: number, e: any) => s + (e.prize_won ?? 0), 0);
  const bestRank = entries.reduce((best: number | null, e: any) => {
    if (!e.rank) return best;
    return best === null || e.rank < best ? e.rank : best;
  }, null);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand/20 border-2 border-brand/40 flex items-center justify-center text-2xl font-bold text-brand">
          {profile?.display_name?.[0]?.toUpperCase() ?? profile?.username?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="text-white text-xl font-bold">{profile?.display_name ?? profile?.username ?? "Player"}</h1>
          <p className="text-slate-400 text-sm">@{profile?.username ?? "—"}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Contests", value: totalContests },
          { label: "Total Points", value: totalPoints.toFixed(0) },
          { label: "Best Rank", value: bestRank ? `#${bestRank}` : "—" },
          { label: "Total Won", value: formatCurrency(totalWon) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-card rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-white font-bold text-xl">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Wallet */}
      <Link href="/wallet" className="flex items-center justify-between bg-surface-card rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <path d="M1 10h22"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold">Wallet</p>
            <p className="text-slate-400 text-xs">Balance & transactions</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-brand font-bold">{formatCurrency(profile?.wallet_balance ?? 0)}</p>
          <p className="text-slate-400 text-xs">Available</p>
        </div>
      </Link>

      {/* Actions */}
      <div className="space-y-2">
        <Link href="/my-teams" className="flex items-center justify-between bg-surface-card rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition">
          <p className="text-white font-semibold">My Teams</p>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>
        <Link href="/contests" className="flex items-center justify-between bg-surface-card rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition">
          <p className="text-white font-semibold">My Contests</p>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>
      </div>

      {/* Sign out */}
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          className="w-full border border-red-500/30 text-red-400 rounded-xl py-3 font-semibold hover:bg-red-500/10 transition"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
