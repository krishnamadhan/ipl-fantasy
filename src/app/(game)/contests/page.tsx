import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, shortTeam } from "@/lib/utils/format";

export const revalidate = 30;

export default async function ContestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entries } = await supabase
    .from("f11_entries")
    .select(`
      id, total_points, rank, prize_won, created_at,
      contest:f11_contests(
        id, name, contest_type, entry_fee, prize_pool, status, max_teams, winners_count,
        match:f11_matches(id, team_home, team_away, scheduled_at, status)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const valid = (entries ?? [] as any[]).filter((e: any) => e.contest);

  // Group by match
  const byMatch = new Map<string, { match: any; entries: any[] }>();
  for (const e of valid as any[]) {
    // Supabase types FK joins as arrays; normalise both levels
    const contest = Array.isArray(e.contest) ? e.contest[0] : e.contest;
    const rawMatch = contest?.match;
    // Supabase returns FK joins as arrays; normalise
    const m = Array.isArray(rawMatch) ? (rawMatch as any[])[0] : rawMatch;
    if (!m) continue;
    if (!byMatch.has(m.id)) byMatch.set(m.id, { match: m, entries: [] });
    byMatch.get(m.id)!.entries.push(e);
  }

  const live    = [...byMatch.values()].filter((g) => g.match.status === "live");
  const active  = [...byMatch.values()].filter((g) => ["scheduled", "open", "locked"].includes(g.match.status));
  const review  = [...byMatch.values()].filter((g) => g.match.status === "in_review");
  const done    = [...byMatch.values()].filter((g) => g.match.status === "completed");

  return (
    <div className="max-w-lg mx-auto pb-24" style={{ background: "#0B0E14", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-white font-black text-xl">My Contests</h1>
        <Link href="/contests/join"
          className="text-xs bg-brand/10 border border-brand/40 text-brand font-bold px-3 py-1.5 rounded-xl">
          Enter Code
        </Link>
      </div>

      {valid.length === 0 ? (
        <div className="text-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-4xl">🏆</div>
          <p className="text-white font-bold text-lg mb-1">No contests yet</p>
          <p className="text-slate-500 text-sm mb-6">Join a contest to compete for prizes</p>
          <Link href="/matches"
            className="bg-brand text-white font-black px-8 py-3 rounded-2xl inline-block shadow-lg shadow-brand/20">
            Browse Matches →
          </Link>
        </div>
      ) : (
        <div className="px-4 space-y-6 pt-2">
          {live.length > 0 && (
            <Section label="🔴 Live" groups={live} />
          )}
          {review.length > 0 && (
            <Section label="⏳ In Review" groups={review} />
          )}
          {active.length > 0 && (
            <Section label="Upcoming" groups={active} />
          )}
          {done.length > 0 && (
            <Section label="Completed" groups={done} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, groups }: { label: string; groups: { match: any; entries: any[] }[] }) {
  return (
    <div>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">{label}</p>
      <div className="space-y-3">
        {groups.map(({ match: m, entries }) => (
          <MatchGroup key={m.id} match={m} entries={entries} />
        ))}
      </div>
    </div>
  );
}

function MatchGroup({ match: m, entries }: { match: any; entries: any[] }) {
  const isLive = m.status === "live";
  const totalWon = entries.reduce((s: number, e: any) => s + (e.prize_won ?? 0), 0);

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: isLive ? "rgba(239,68,68,0.3)" : "rgba(51,65,85,0.8)", background: "#111827" }}>
      {/* Match header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-white font-black text-sm">
              {shortTeam(m.team_home)} <span className="text-slate-600 font-normal">vs</span> {shortTeam(m.team_away)}
            </p>
            <p className="text-slate-500 text-xs">{entries.length} contest{entries.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          {totalWon > 0 && (
            <span className="text-green-400 font-black text-sm">{formatCurrency(totalWon)}</span>
          )}
          <Link href={`/contests/browse/${m.id}`}
            className="text-brand text-xs font-bold border border-brand/30 px-2.5 py-1 rounded-xl">
            + Join
          </Link>
        </div>
      </div>

      {/* Contest entries */}
      <div className="divide-y divide-slate-800/60">
        {(entries as any[]).map((e: any) => {
          const c = Array.isArray(e.contest) ? e.contest[0] : e.contest;
          return (
            <Link key={e.id} href={`/contests/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                    {c.contest_type}
                  </span>
                  <span className="text-slate-500 text-xs">·</span>
                  <span className="text-slate-500 text-xs">{formatCurrency(c.entry_fee)} entry</span>
                </div>
              </div>
              <div className="text-right ml-3 shrink-0">
                {e.rank ? (
                  <>
                    <p className="text-brand font-black text-lg leading-none">#{e.rank}</p>
                    <p className="text-slate-500 text-xs">{e.total_points ?? 0} pts</p>
                  </>
                ) : e.total_points > 0 ? (
                  <>
                    <p className="text-white font-bold">{e.total_points} pts</p>
                    <p className="text-slate-500 text-xs">Ranked</p>
                  </>
                ) : (
                  <>
                    <p className="text-brand font-bold text-sm">{formatCurrency(c.prize_pool)}</p>
                    <p className="text-slate-500 text-xs">Prize pool</p>
                  </>
                )}
                {e.prize_won > 0 && (
                  <p className="text-green-400 font-black text-sm">Won {formatCurrency(e.prize_won)}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
