"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/format";

const NAV = [
  { href: "/dashboard",  label: "Home",     icon: HomeIcon },
  { href: "/matches",    label: "Matches",   icon: CricketIcon },
  { href: "/contests",   label: "Contests",  icon: TrophyIcon },
  { href: "/my-teams",   label: "My Teams",  icon: ShieldIcon },
  { href: "/wallet",     label: "Wallet",    icon: WalletIcon },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(10, 10, 10, 0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto h-14">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? path === "/dashboard" || path === "/"
              : path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 group"
            >
              <Icon active={active} />
              <span
                className={cn(
                  "text-[9px] font-bold tracking-wide transition-colors",
                  active ? "text-brand" : "text-slate-600 group-hover:text-slate-400"
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
  const c = active ? "#F5A623" : "#4B5563";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
        fill={active ? `${c}25` : "none"}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M9 21V13h6v8" stroke={active ? "white" : c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CricketIcon({ active }: { active: boolean }) {
  const c = active ? "#F5A623" : "#4B5563";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8" fill={active ? `${c}18` : "none"} />
      <path d="M8 16l8-8M8 12l4-4M12 16l4-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon({ active }: { active: boolean }) {
  const c = active ? "#F5A623" : "#4B5563";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3h10v8a5 5 0 01-10 0V3z"
        fill={active ? `${c}25` : "none"}
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
  const c = active ? "#F5A623" : "#4B5563";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill={active ? `${c}20` : "none"}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M9 12l2 2 4-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon({ active }: { active: boolean }) {
  const c = active ? "#F5A623" : "#4B5563";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect
        x="2" y="7" width="20" height="13" rx="2"
        fill={active ? `${c}18` : "none"}
        stroke={c}
        strokeWidth="1.8"
      />
      <path d="M16 3H6a2 2 0 00-2 2v2" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="13.5" r="1.5" fill={c} />
    </svg>
  );
}
