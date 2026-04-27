/**
 * /contests/[id]/diff?u1=<userId>&u2=<userId>
 *
 * Dream11-style side-by-side team comparison.
 * Different players first (each row shows the player on the side they're in, "—" on the other).
 * Captain / VC badges inline.
 * Common players listed at the bottom.
 *
 * Accessible from the leaderboard (tap any row → "Compare with my team").
 * Falls back to comparing the top-2 teams if u1/u2 are omitted.
 */
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ u1?: string; u2?: string }>;
}

const ROLE_LABEL: Record<string, string> = {
  WK: "WK", BAT: "BAT", AR: "AR", BOWL: "BOWL",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-black px-1.5 py-0.5 rounded leading-none"
      style={{ background: color, color: "#0B0E14" }}
    >
      {label}
    </span>
  );
}

/**
 * Render one cell in the diff row (left = team1 pick, right = team2 pick).
 * Called as a plain function (not JSX component) to avoid async-component nesting issues.
 */
function renderCell(
  pid: string | null,
  entry: { captain_id: string; vc_id: string },
  side: "left" | "right",
  playerMap: Map<string, any>,
  pointsMap: Map<string, any>,
  showPoints: boolean,
) {
  const isLeft = side === "left";
  const borderSide = isLeft ? { borderRight: "1px solid #1C2333" } : {};

  if (!pid) {
    return (
      <div className="flex-1 flex items-center justify-center py-3" style={borderSide}>
        <span className="text-slate-700 text-xs">—</span>
      </div>
    );
  }

  const p = playerMap.get(pid);
  if (!p) return <div className="flex-1" style={borderSide} />;

  const cap = entry.captain_id === pid;
  const vc  = entry.vc_id === pid;
  const s   = pointsMap.get(pid);
  const basePts = s?.fantasy_points ?? 0;
  const pts = showPoints ? (cap ? basePts * 2 : vc ? basePts * 1.5 : basePts) : null;

  return (
    <div
      className={cn("flex-1 flex gap-2 px-3 py-2.5", isLeft ? "flex-row" : "flex-row-reverse")}
      style={{
        ...borderSide,
        background: cap ? "rgba(63,239,180,0.07)" : vc ? "rgba(247,163,37,0.05)" : "transparent",
      }}
    >
      <span
        className="text-[9px] font-bold px-1 py-0.5 rounded self-center shrink-0"
        style={{ background: "#1C2333", color: "#8892A4" }}
      >
        {ROLE_LABEL[p.role] ?? p.role}
      </span>

      <div className={cn("flex flex-col min-w-0", isLeft ? "items-start" : "items-end")}>
        <div className={cn("flex items-center gap-1", isLeft ? "" : "flex-row-reverse")}>
          <span className="text-white text-xs font-semibold break-words leading-snug">{p.name}</span>
          {cap && <Badge label="C"  color="#3FEFB4" />}
          {vc  && <Badge label="VC" color="#F7A325" />}
        </div>
        <span className="text-slate-500 text-[10px]">{p.ipl_team}</span>
        {pts !== null && (
          <span className="text-[10px] font-bold" style={{ color: pts > 0 ? "#3FEFB4" : "#4A5568" }}>
            {pts > 0 ? `${pts.toFixed(1)}pts` : "0pts"}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function TeamDiffPage({ params, searchParams }: PageProps) {
  const { id: contestId } = await params;
  const { u1, u2 } = await searchParams;

  const supabase = await createClient();
  const admin = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Contest + match ────────────────────────────────────────────────────────
  const { data: contest } = await admin
    .from("f11_contests")
    .select("id, match_id, status, name, match:f11_matches(id, team_home, team_away, status)")
    .eq("id", contestId)
    .single();

  if (!contest) notFound();

  // ── All entries, ranked ────────────────────────────────────────────────────
  const { data: allEntries } = await admin
    .from("f11_entries")
    .select(`
      id, user_id, team_name, player_ids, captain_id, vc_id, total_points, rank,
      profile:f11_profiles!user_id(display_name, username, avatar_url)
    `)
    .eq("contest_id", contestId)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("total_points", { ascending: false });

  if (!allEntries?.length) notFound();

  // ── Resolve the two entries ────────────────────────────────────────────────
  const findByUserId = (uid: string) => allEntries.find((e: any) => e.user_id === uid) ?? null;

  let entry1: any = u1 ? findByUserId(u1) : null;
  let entry2: any = u2 ? findByUserId(u2) : null;

  // Smart defaults: current user vs top entry (or top 2 if user not in contest)
  if (!entry1 && !entry2) {
    const myEntry = findByUserId(user.id);
    const top = allEntries[0];
    if (myEntry && myEntry.id !== top?.id) {
      entry1 = myEntry;
      entry2 = top;
    } else {
      entry1 = allEntries[0] ?? null;
      entry2 = allEntries[1] ?? null;
    }
  } else if (!entry1) {
    entry1 = allEntries.find((e: any) => e.id !== entry2?.id) ?? null;
  } else if (!entry2) {
    entry2 = allEntries.find((e: any) => e.id !== entry1?.id) ?? null;
  }

  if (!entry1 || !entry2) notFound();

  // ── Batch-fetch players ────────────────────────────────────────────────────
  const allIds: string[] = [...new Set([
    ...(entry1.player_ids as string[]),
    ...(entry2.player_ids as string[]),
  ])];

  const [{ data: players }, { data: stats }] = await Promise.all([
    admin.from("f11_players").select("id, name, ipl_team, role, credit_value").in("id", allIds),
    admin.from("f11_player_stats").select("player_id, fantasy_points, runs, wickets, catches")
      .eq("match_id", (contest.match as any)?.id ?? "")
      .in("player_id", allIds),
  ]);

  const pointsMap = new Map<string, any>(
    (stats ?? []).map((s: any) => [s.player_id, s])
  );
  const playerMap = new Map<string, any>(
    (players ?? []).map((p: any) => [p.id, p])
  );

  const ids1 = new Set<string>(entry1.player_ids as string[]);
  const ids2 = new Set<string>(entry2.player_ids as string[]);

  const only1 = (entry1.player_ids as string[]).filter((id: string) => !ids2.has(id));
  const only2 = (entry2.player_ids as string[]).filter((id: string) => !ids1.has(id));
  const common = (entry1.player_ids as string[]).filter((id: string) => ids2.has(id));

  const matchStatus = (contest.match as any)?.status ?? "open";
  const showPoints = ["live", "completed", "in_review"].includes(matchStatus);

  const name1 = (entry1.profile?.display_name ?? entry1.profile?.username ?? "Team 1") as string;
  const name2 = (entry2.profile?.display_name ?? entry2.profile?.username ?? "Team 2") as string;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function isCap(entry: any, pid: string) { return entry.captain_id === pid; }
  function isVC(entry: any, pid: string)  { return entry.vc_id === pid; }

  // Diff rows: pair up only1 and only2 (different players side-by-side)
  const diffRowCount = Math.max(only1.length, only2.length);
  const diffRows: Array<{ left: string | null; right: string | null }> = [];
  for (let i = 0; i < diffRowCount; i++) {
    diffRows.push({ left: only1[i] ?? null, right: only2[i] ?? null });
  }

  const capSame = entry1.captain_id === entry2.captain_id;
  const vcSame  = entry1.vc_id === entry2.vc_id;

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: "#0B0E14" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: "#0B0E14", borderBottom: "1px solid #1C2333" }}
      >
        <Link
          href={`/contests/${contestId}`}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ←
        </Link>
        <div>
          <h1 className="text-white font-bold text-base leading-none font-rajdhani">
            TEAM COMPARISON
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">{(contest as any).name}</p>
        </div>
      </div>

      {/* Team name banner */}
      <div
        className="grid grid-cols-2 divide-x"
        style={{ borderBottom: "1px solid #252D3D" }}
      >
        {[
          { name: name1, entry: entry1, pts: entry1.total_points ?? 0 },
          { name: name2, entry: entry2, pts: entry2.total_points ?? 0 },
        ].map(({ name, entry, pts }, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center py-4 gap-1",
              i === 1 ? "border-l" : ""
            )}
            style={{ borderColor: "#252D3D" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black"
              style={{ background: i === 0 ? "rgba(63,239,180,0.15)" : "rgba(247,163,37,0.15)" }}
            >
              <span style={{ color: i === 0 ? "#3FEFB4" : "#F7A325" }}>
                {name[0]?.toUpperCase()}
              </span>
            </div>
            <p className="text-white text-sm font-bold font-rajdhani leading-none">{name}</p>
            {entry.rank && (
              <p className="text-slate-500 text-[10px]">Rank #{entry.rank}</p>
            )}
            {showPoints && (
              <p className="text-[11px] font-bold" style={{ color: i === 0 ? "#3FEFB4" : "#F7A325" }}>
                {pts.toFixed(1)} pts
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── DIFFERENT PLAYERS ── */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black text-slate-400 tracking-widest font-rajdhani">
            DIFFERENT PLAYERS
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#1C2333", color: "#8892A4" }}
          >
            {only1.length + only2.length}
          </span>
        </div>

        {diffRows.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            Identical squads! 😳
          </p>
        ) : (
          <div
            className="rounded-xl overflow-hidden divide-y"
            style={{ border: "1px solid #252D3D" }}
          >
            {/* Sub-header */}
            <div
              className="grid grid-cols-2 divide-x text-center py-1"
              style={{ background: "#141920" }}
            >
              <p className="text-[10px] font-bold" style={{ color: "#3FEFB4" }}>{name1}</p>
              <p className="text-[10px] font-bold" style={{ color: "#F7A325" }}>{name2}</p>
            </div>

            {diffRows.map(({ left, right }, idx) => (
              <div
                key={idx}
                className="grid grid-cols-2"
                style={{
                  background: idx % 2 === 0 ? "#0F1318" : "#141920",
                  borderTop: "1px solid #1C2333",
                }}
              >
                {/* Left cell — entry1's unique player */}
                {renderCell(left, entry1, "left", playerMap, pointsMap, showPoints)}
                {/* Right cell — entry2's unique player */}
                {renderCell(right, entry2, "right", playerMap, pointsMap, showPoints)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CAPTAIN / VC ── */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-black text-slate-400 tracking-widest font-rajdhani mb-3">
          CAPTAIN / VC
        </p>
        <div
          className="rounded-xl overflow-hidden divide-y"
          style={{ border: "1px solid #252D3D" }}
        >
          {/* Captain row */}
          <div
            className="grid grid-cols-2 divide-x"
            style={{ background: capSame ? "rgba(63,239,180,0.04)" : "#141920" }}
          >
            {[entry1, entry2].map((entry, i) => {
              const p = playerMap.get(entry.captain_id);
              return (
                <div
                  key={i}
                  className={cn("flex items-center gap-2 px-3 py-2", i === 1 ? "flex-row-reverse" : "")}
                >
                  <Badge label="C" color="#3FEFB4" />
                  <div className={cn("flex flex-col min-w-0 flex-1", i === 1 ? "items-end" : "")}>
                    <span className="text-white text-xs font-semibold break-words leading-snug">
                      {p?.name ?? "—"}
                    </span>
                    <span className="text-slate-500 text-[10px]">{p?.ipl_team}</span>
                  </div>
                  {capSame && i === 1 && (
                    <span className="text-[10px]" style={{ color: "#3FEFB4" }}>✓ Same</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* VC row */}
          <div
            className="grid grid-cols-2 divide-x"
            style={{ background: vcSame ? "rgba(247,163,37,0.04)" : "#141920" }}
          >
            {[entry1, entry2].map((entry, i) => {
              const p = playerMap.get(entry.vc_id);
              return (
                <div
                  key={i}
                  className={cn("flex items-center gap-2 px-3 py-2", i === 1 ? "flex-row-reverse" : "")}
                >
                  <Badge label="VC" color="#F7A325" />
                  <div className={cn("flex flex-col min-w-0 flex-1", i === 1 ? "items-end" : "")}>
                    <span className="text-white text-xs font-semibold break-words leading-snug">
                      {p?.name ?? "—"}
                    </span>
                    <span className="text-slate-500 text-[10px]">{p?.ipl_team}</span>
                  </div>
                  {vcSame && i === 1 && (
                    <span className="text-[10px]" style={{ color: "#F7A325" }}>✓ Same</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── COMMON PLAYERS ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black text-slate-400 tracking-widest font-rajdhani">
            COMMON PLAYERS
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#1C2333", color: "#8892A4" }}
          >
            {common.length}/11
          </span>
        </div>

        {common.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No common players — maximum variance!
          </p>
        ) : (
          <div
            className="rounded-xl overflow-hidden divide-y"
            style={{ border: "1px solid #252D3D" }}
          >
            {common.map((pid: string, idx: number) => {
              const p = playerMap.get(pid);
              if (!p) return null;
              const s = pointsMap.get(pid);
              const base = s?.fantasy_points ?? 0;
              const cap1 = isCap(entry1, pid);
              const vc1  = isVC(entry1, pid);
              const cap2 = isCap(entry2, pid);
              const vc2  = isVC(entry2, pid);

              return (
                <div
                  key={pid}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ background: idx % 2 === 0 ? "#0F1318" : "#141920" }}
                >
                  {/* Role */}
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: "#1C2333", color: "#8892A4" }}
                  >
                    {ROLE_LABEL[p.role] ?? p.role}
                  </span>

                  {/* Name + team */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold break-words leading-snug">{p.name}</p>
                    <p className="text-slate-500 text-[10px]">{p.ipl_team}</p>
                  </div>

                  {/* C/VC badges — show per-team differences */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(cap1 || vc1) && (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px] font-bold" style={{ color: "#3FEFB4" }}>
                          {name1.slice(0, 4)}
                        </span>
                        {cap1 ? <Badge label="C" color="#3FEFB4" /> : <Badge label="VC" color="#F7A325" />}
                      </div>
                    )}
                    {(cap2 || vc2) && (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px] font-bold" style={{ color: "#F7A325" }}>
                          {name2.slice(0, 4)}
                        </span>
                        {cap2 ? <Badge label="C" color="#3FEFB4" /> : <Badge label="VC" color="#F7A325" />}
                      </div>
                    )}
                  </div>

                  {/* Points */}
                  {showPoints && (
                    <div className="text-right shrink-0 w-12">
                      <p
                        className="text-xs font-bold"
                        style={{ color: base > 0 ? "#3FEFB4" : "#4A5568" }}
                      >
                        {base > 0 ? `${base}` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-600">pts</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
