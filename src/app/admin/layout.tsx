import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("f11_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-surface-card border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4 overflow-x-auto">
          <Link href="/admin" className="text-brand font-bold whitespace-nowrap">Admin</Link>
          <Link href="/admin/players" className="text-slate-400 hover:text-white text-sm whitespace-nowrap">Players</Link>
          <Link href="/admin/matches" className="text-slate-400 hover:text-white text-sm whitespace-nowrap">Matches</Link>
          <Link href="/admin/contests" className="text-slate-400 hover:text-white text-sm whitespace-nowrap">Contests</Link>
          <Link href="/admin/wallets" className="text-slate-400 hover:text-white text-sm whitespace-nowrap">Wallets</Link>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
