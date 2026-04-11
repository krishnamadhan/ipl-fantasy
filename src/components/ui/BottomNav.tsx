"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/format";

const LEFT_NAV  = [
  { href: "/dashboard", label: "Home",    icon: HomeIcon },
  { href: "/matches",   label: "Matches", icon: CricketIcon },
];
const RIGHT_NAV = [
  { href: "/my-teams",  label: "My Teams", icon: ShieldIcon },
  { href: "/wallet",    label: "Wallet",   icon: WalletIcon },
];

export default function BottomNav() {
  const path = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? path === "/dashboard" || path === "/"
      : path === href || path.startsWith(href + "/");

  const contestActive = isActive("/contests");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background:    "#0B0E14",
        borderTop:     "1px solid #252D3D",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height:        "calc(64px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto h-16 relative">

        {/* Left tabs */}
        {LEFT_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 group relative"
            >
              {/* Active teal dot indicator */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2"
                  style={{
                    width:        24,
                    height:        3,
                    background:   "#3FEFB4",
                    borderRadius: "0 0 4px 4px",
                  }}
                />
              )}
              <span
                className="relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all"
                style={active ? { background: "rgba(63,239,180,0.10)" } : {}}
              >
                <Icon active={active} />
              </span>
              <span
                className={cn(
                  "relative z-10 text-[9px] font-bold tracking-wide transition-colors font-rajdhani leading-none",
                  active ? "text-[#3FEFB4]" : "text-[#4A5568] group-hover:text-slate-400"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* ── Center raised "Contests" button ── */}
        <div className="flex flex-col items-center justify-end flex-1 pb-1 relative">
          <Link href="/contests" className="flex flex-col items-center gap-0.5 group">
            <div
              className="absolute -top-5 flex items-center justify-center transition-transform active:scale-95"
              style={{
                width:      56,
                height:     56,
                borderRadius: "50%",
                background:   contestActive
                  ? "linear-gradient(135deg, #3FEFB4 0%, #21C55D 100%)"
                  : "linear-gradient(135deg, #1C2B35 0%, #152B22 100%)",
                border:     contestActive ? "none" : "1.5px solid rgba(63,239,180,0.30)",
                boxShadow:  contestActive
                  ? "0 4px 20px rgba(63,239,180,0.40), 0 0 0 4px rgba(63,239,180,0.10)"
                  : "0 4px 16px rgba(0,0,0,0.40), 0 0 0 4px rgba(63,239,180,0.06)",
              }}
            >
              <TrophyIcon active={contestActive} center />
            </div>
            <span
              className={cn(
                "text-[9px] font-bold tracking-wide font-rajdhani leading-none",
                contestActive ? "text-[#3FEFB4]" : "text-[#4A5568] group-hover:text-slate-400"
              )}
            >
              Contests
            </span>
          </Link>
        </div>

        {/* Right tabs */}
        {RIGHT_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 group relative"
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2"
                  style={{
                    width:        24,
                    height:        3,
                    background:   "#3FEFB4",
                    borderRadius: "0 0 4px 4px",
                  }}
                />
              )}
              <span
                className="relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all"
                style={active ? { background: "rgba(63,239,180,0.10)" } : {}}
              >
                <Icon active={active} />
              </span>
              <span
                className={cn(
                  "relative z-10 text-[9px] font-bold tracking-wide transition-colors font-rajdhani leading-none",
                  active ? "text-[#3FEFB4]" : "text-[#4A5568] group-hover:text-slate-400"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}

      </div>
    </nav>
  );
}

/* ── Icons ── */

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "#3FEFB4" : "#4A5568";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
        fill={active ? "rgba(63,239,180,0.15)" : "none"}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M9 21V13h6v8" stroke={active ? "#3FEFB4" : c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CricketIcon({ active }: { active: boolean }) {
  const c = active ? "#3FEFB4" : "#4A5568";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8" fill={active ? "rgba(63,239,180,0.12)" : "none"} />
      <path d="M8 16l8-8M8 12l4-4M12 16l4-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon({ active, center }: { active: boolean; center?: boolean }) {
  const c = center ? (active ? "#0B0E14" : "#3FEFB4") : (active ? "#3FEFB4" : "#4A5568");
  return (
    <svg width={center ? 24 : 20} height={center ? 24 : 20} viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3h10v8a5 5 0 01-10 0V3z"
        fill={center ? (active ? "rgba(11,14,20,0.20)" : "rgba(63,239,180,0.20)") : (active ? "rgba(63,239,180,0.15)" : "none")}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M5 3H3v4a4 4 0 004 4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 3h2v4a4 4 0 01-4 4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16v4M8 20h8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ active }: { active: boolean }) {
  const c = active ? "#3FEFB4" : "#4A5568";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill={active ? "rgba(63,239,180,0.12)" : "none"}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M9 12l2 2 4-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon({ active }: { active: boolean }) {
  const c = active ? "#3FEFB4" : "#4A5568";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect
        x="2" y="7" width="20" height="13" rx="2"
        fill={active ? "rgba(63,239,180,0.12)" : "none"}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M16 3H6a2 2 0 00-2 2v2" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="13.5" r="1.5" fill={c} />
    </svg>
  );
}
