import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { shortTeam } from "@/lib/utils/format";

export default async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, liveRes] = await Promise.all([
    supabase
      .from("f11_profiles")
      .select("username, display_name, wallet_balance")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("f11_matches")
      .select("id, team_home, team_away, live_score_summary")
      .eq("status", "live"),
  ]);

  const profile = profileRes.data;
  const liveMatches = liveRes.data ?? [];
  const balance = profile?.wallet_balance ?? 0;
  const initial = (profile?.display_name ?? profile?.username ?? "P")[0].toUpperCase();

  // Build ticker text items
  const tickerItems = liveMatches.map((m) => {
    const ls = m.live_score_summary as any;
    const score = ls
      ? `${ls.team1_runs}/${ls.team1_wickets} (${ls.team1_overs} ov)`
      : "In Progress";
    return `${shortTeam(m.team_home)} vs ${shortTeam(m.team_away)}  ${score}`;
  });

  return (
    <div className="sticky top-0 z-50" style={{ background: "#0B0E14" }}>
      {/* ── 56px main header row ── */}
      <header
        className="flex items-center justify-between px-4"
        style={{
          height: 56,
          borderBottom: "1px solid #252D3D",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* Left — logo + name */}
        <Link href="/dashboard" className="flex items-center gap-2 select-none">
          <ShieldIcon />
          <span
            className="font-rajdhani font-bold text-[18px] leading-none tracking-wide"
            style={{ color: "#3FEFB4" }}
          >
            IPL Fantasy
          </span>
        </Link>

        {/* Right — wallet + bell + avatar */}
        <div className="flex items-center gap-2">
          {/* Wallet chip */}
          <Link
            href="/wallet"
            className="flex items-center gap-1.5 px-3 py-[6px] rounded-full transition-opacity hover:opacity-80"
            style={{
              background: "#1C2333",
              border: "1px solid #252D3D",
            }}
          >
            <span className="text-[13px] leading-none">⚡</span>
            <span
              className="font-rajdhani font-bold text-[13px] tabular-nums leading-none"
              style={{ color: "#3FEFB4" }}
            >
              ₹{balance.toLocaleString("en-IN")}
            </span>
          </Link>

          {/* Bell */}
          <div
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "#141920", border: "1px solid #252D3D" }}
          >
            <BellIcon />
          </div>

          {/* Avatar */}
          <Link href="/profile">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-rajdhani font-bold text-sm select-none"
              style={{
                background: "rgba(63,239,180,0.10)",
                border: "2px solid #3FEFB4",
                color: "#3FEFB4",
              }}
            >
              {initial}
            </div>
          </Link>
        </div>
      </header>

      {/* ── 28px live ticker (only when matches are live) ── */}
      {liveMatches.length > 0 && (
        <div
          className="flex items-center overflow-hidden"
          style={{
            height: 28,
            background: "rgba(255,59,59,0.10)",
            borderBottom: "1px solid rgba(255,59,59,0.25)",
          }}
        >
          {/* Static "LIVE" label */}
          <div
            className="flex items-center gap-1.5 px-3 shrink-0 h-full"
            style={{ borderRight: "1px solid rgba(255,59,59,0.20)" }}
          >
            <span className="live-dot" />
            <span
              className="font-rajdhani font-bold text-[10px] uppercase tracking-[0.12em] leading-none"
              style={{ color: "#FF3B3B" }}
            >
              Live
            </span>
          </div>

          {/* Scrolling marquee */}
          <div className="flex-1 overflow-hidden">
            <div
              className="flex items-center whitespace-nowrap"
              style={{ animation: "ticker 22s linear infinite" }}
            >
              {/* Duplicated for seamless loop */}
              {[...tickerItems, ...tickerItems].map((text, i) => (
                <span
                  key={i}
                  className="text-[11px] shrink-0 px-4"
                  style={{ color: "#F0F4FF" }}
                >
                  {text}
                  <span className="mx-3 opacity-20">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Icons ── */

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill="rgba(63,239,180,0.12)"
        stroke="#3FEFB4"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="#3FEFB4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="#8A95A8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="#8A95A8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
