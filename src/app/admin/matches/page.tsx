import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDateTime, shortTeam } from "@/lib/utils/format";
import AdminMatchActions from "./AdminMatchActions";
import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 30;

export default async function AdminMatchesPage() {
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("f11_matches")
    .select("*")
    .order("scheduled_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Matches</h1>
      <div className="space-y-3">
        {(matches ?? []).map((m: any) => (
          <div key={m.id} className="bg-surface-card rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <Link href={`/admin/matches/${m.id}`} className="hover:underline">
                <h3 className="text-white font-semibold">
                  {shortTeam(m.team_home)} vs {shortTeam(m.team_away)}
                </h3>
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                m.status === "live" ? "bg-red-500/20 text-red-400" :
                m.status === "open" ? "bg-brand/20 text-brand" :
                m.status === "locked" ? "bg-orange-500/20 text-orange-400" :
                m.status === "in_review" ? "bg-purple-500/20 text-purple-400" :
                m.status === "completed" ? "bg-green-500/20 text-green-400" :
                "bg-slate-600 text-slate-300"
              }`}>
                {m.status}
              </span>
            </div>
            <p className="text-slate-400 text-xs mb-3">{formatDateTime(m.scheduled_at)}</p>
            {m.venue && <p className="text-slate-500 text-xs mb-3">{m.venue}</p>}
            <AdminMatchActions match={m} />
          </div>
        ))}
      </div>
    </div>
  );
}
