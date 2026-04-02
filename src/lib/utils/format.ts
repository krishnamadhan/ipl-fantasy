import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    ...IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    ...IST,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format time only in IST, e.g. "7:30 PM" */
export function formatTimeIST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    ...IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Started";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function shortTeam(name: string): string {
  const map: Record<string, string> = {
    "Mumbai Indians": "MI",
    "Chennai Super Kings": "CSK",
    "Royal Challengers Bengaluru": "RCB",
    "Royal Challengers Bangalore": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Delhi Capitals": "DC",
    "Punjab Kings": "PBKS",
    "Rajasthan Royals": "RR",
    "Sunrisers Hyderabad": "SRH",
    "Lucknow Super Giants": "LSG",
    "Gujarat Titans": "GT",
  };
  return map[name] ?? name.slice(0, 3).toUpperCase();
}

export const TEAM_COLORS: Record<string, string> = {
  MI: "#004BA0",
  CSK: "#F7C948",
  RCB: "#EC1C24",
  KKR: "#552583",
  DC: "#00008B",
  PBKS: "#DCDDDE",
  RR: "#EA1A85",
  SRH: "#FF6600",
  LSG: "#A72056",
  GT: "#1C1C1C",
};
