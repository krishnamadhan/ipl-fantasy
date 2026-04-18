import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import type { WalletTransaction } from "@/types/wallet";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, txRes] = await Promise.all([
    supabase.from("f11_profiles").select("wallet_balance, display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("f11_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const balance = profileRes.data?.wallet_balance ?? 0;
  const transactions = (txRes.data ?? []) as WalletTransaction[];

  const totalWon    = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalSpent  = transactions.filter((t) => t.type === "debit").reduce((s, t)  => s + t.amount, 0);

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#0B0E14", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">IPL Fantasy 2026</p>
        <h1 className="text-white font-black text-2xl mt-0.5">Wallet</h1>
      </div>

      {/* Balance hero */}
      <div className="px-4 pb-2">
        <div
          className="rounded-3xl overflow-hidden border"
          style={{
            background: "linear-gradient(145deg, #141005 0%, #0f0e05 40%, #080d1a 100%)",
            borderColor: "rgba(245,166,35,0.20)",
          }}
        >
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #F5A623, #F7C948, #F5A623)" }} />
          <div className="px-5 py-5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-white font-black text-5xl leading-none mb-1">{formatCurrency(balance)}</p>
            <p className="text-slate-600 text-xs">Virtual credits · IPL Fantasy 2026</p>

            <div className="flex gap-5 mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div>
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-wider">Won</p>
                <p className="text-green-400 font-black text-lg leading-tight">{formatCurrency(totalWon)}</p>
              </div>
              <div className="w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div>
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-wider">Spent</p>
                <p className="text-red-400 font-black text-lg leading-tight">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div>
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-wider">Txns</p>
                <p className="text-white font-black text-lg leading-tight">{transactions.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-4 mt-5">
        <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-3">History</p>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 border border-white/10"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              💰
            </div>
            <p className="text-white font-black">No transactions yet</p>
            <p className="text-slate-500 text-sm mt-1">Join a contest to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isCredit = tx.type === "credit";
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-2xl p-3.5 border"
                  style={{ background: "#111827", borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black shrink-0"
                    style={{
                      background: isCredit ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: isCredit ? "#4ADE80" : "#F87171",
                    }}
                  >
                    {isCredit ? "↑" : "↓"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{tx.reason}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{formatDateTime(tx.created_at)}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="font-black text-base"
                      style={{ color: isCredit ? "#4ADE80" : "#F87171" }}
                    >
                      {isCredit ? "+" : "−"}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-slate-600 text-[10px]">bal {formatCurrency(tx.balance_after)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
