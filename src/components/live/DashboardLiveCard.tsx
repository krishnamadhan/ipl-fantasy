"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { shortTeam, TEAM_COLORS } from "@/lib/utils/format";

interface LiveScore {
  team1: string; team1_runs: number; team1_wickets: number; team1_overs: string;
  team2: string; team2_runs: number; team2_wickets: number; team2_overs: string;
  current_batting: string; situation: string;
}

interface LiveMatch {
  id: string;
  team_home: string;
  team_away: string;
  live_score_summary: LiveScore | null;
}

function teamColor(team: string): string {
  return TEAM_COLORS[shortTeam(team)] ?? "#F5A623";
}

export default function DashboardLiveCard({ matches }: { matches: LiveMatch[] }) {
  const [scores, setScores] = useState<Record<string, LiveScore | null>>(
    Object.fromEntries(matches.map((m) => [m.id, m.live_score_summary]))
  );
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!matches.length) return;
    const supabase = createClient();
    const matchIds = matches.map((m) => m.id);

    // Subscribe to score updates for all live matches
    const channel = supabase
      .channel("dashboard-live-scores")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "f11_matches" },
        (payload) => {
          const matchId = payload.new?.id as string;
          if (matchIds.includes(matchId)) {
            setScores((prev) => ({
              ...prev,
              [matchId]: payload.new?.live_score_summary ?? null,
            }));
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [matches]);

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden border border-red-500/30"
      style={{ background: "linear-gradient(135deg, #200808 0%, #140404 100%)" }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-red-500/20">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Live Now</span>
      </div>
      {matches.map((m) => {
        const hc = teamColor(m.team_home);
        const ac = teamColor(m.team_away);
        const ls = scores[m.id];
        return (
          <Link key={m.id} href={`/matches/${m.id}/live`}
            className="block px-4 py-3 hover:bg-red-500/5 transition border-b border-red-500/10 last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full border flex items-center justify-center text-[9px] font-black"
                    style={{ borderColor: hc, background: hc + "33", color: hc }}>
                    {shortTeam(m.team_home).slice(0, 2)}
                  </div>
                  <span className="text-white font-black text-sm">{shortTeam(m.team_home)}</span>
                </div>
                <span className="text-slate-600 text-xs">vs</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-black text-sm">{shortTeam(m.team_away)}</span>
                  <div className="w-7 h-7 rounded-full border flex items-center justify-center text-[9px] font-black"
                    style={{ borderColor: ac, background: ac + "33", color: ac }}>
                    {shortTeam(m.team_away).slice(0, 2)}
                  </div>
                </div>
              </div>
              <span className="text-red-400 text-xs font-black">Watch →</span>
            </div>
            {ls ? (
              <div className="mt-1.5 text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold">
                    {ls.team1_runs}/{ls.team1_wickets}
                    <span className="text-slate-500 font-normal ml-1">({ls.team1_overs} ov)</span>
                  </span>
                  {ls.team2_runs > 0 && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="text-slate-300">
                        {ls.team2_runs}/{ls.team2_wickets}
                        <span className="text-slate-500 ml-1">({ls.team2_overs} ov)</span>
                      </span>
                    </>
                  )}
                </div>
                {ls.situation && (
                  <p className="text-amber-400 mt-0.5 line-clamp-2 leading-snug">{ls.situation}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-600 text-[10px] mt-1">Score syncing…</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
