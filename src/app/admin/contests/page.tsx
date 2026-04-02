import { createClient } from "@/lib/supabase/server";
import AdminContestActions from "./AdminContestActions";
import { formatCurrency, shortTeam, formatDateTime } from "@/lib/utils/format";

export const revalidate = 30;

export default async function AdminContestsPage() {
  const supabase = await createClient();
  const { data: f11_contests } = await supabase
    .from("f11_contests")
    .select("*, match:f11_matches(team_home, team_away, scheduled_at), entry_count:f11_entries(count)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Contests</h1>
      <div className="space-y-3">
        {(f11_contests ?? []).map((c: any) => (
          <div key={c.id} className="bg-surface-card rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-semibold">{c.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                c.status === "open" ? "bg-green-500/20 text-green-400" :
                c.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                "bg-slate-600 text-slate-300"
              }`}>{c.status}</span>
            </div>
            {c.match && (
              <p className="text-slate-400 text-xs">
                {shortTeam(c.match.team_home)} vs {shortTeam(c.match.team_away)} · {formatDateTime(c.match.scheduled_at)}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span>Entries: {c.entry_count?.[0]?.count ?? 0}/{c.max_teams}</span>
              <span>Entry: {formatCurrency(c.entry_fee)}</span>
              <span>Pool: {formatCurrency(c.prize_pool)}</span>
              {c.invite_code && <span className="font-mono text-brand">{c.invite_code}</span>}
            </div>
            <div className="mt-3">
              <AdminContestActions contest={c} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
