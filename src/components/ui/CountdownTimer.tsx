"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/format";

export default function CountdownTimer({ targetDate, compact = false }: { targetDate: string; compact?: boolean }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (timeLeft.total <= 0) return <span className="text-red-400 text-xs font-bold">Starting…</span>;

  const urgent = timeLeft.total < 60 * 60 * 1000; // < 1 hour

  if (compact) {
    if (timeLeft.days > 0) {
      return <span className="text-slate-400 text-xs">{timeLeft.days}d {timeLeft.hours}h</span>;
    }
    if (timeLeft.hours > 0) {
      return <span className={cn("text-xs font-medium", urgent ? "text-red-400" : "text-slate-400")}>
        {timeLeft.hours}h {timeLeft.minutes}m
      </span>;
    }
    return <span className="text-red-400 text-xs font-bold animate-pulse">
      {timeLeft.minutes}m {timeLeft.seconds}s
    </span>;
  }

  return (
    <div className="flex gap-2 items-center justify-center">
      {timeLeft.days > 0 && (
        <Unit value={timeLeft.days} label="d" urgent={urgent} />
      )}
      <Unit value={timeLeft.hours} label="h" urgent={urgent} />
      <Unit value={timeLeft.minutes} label="m" urgent={urgent} />
      <Unit value={timeLeft.seconds} label="s" urgent={urgent} />
    </div>
  );
}

function Unit({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <div className={cn("flex flex-col items-center bg-surface-elevated rounded-lg px-2.5 py-1", urgent && "bg-red-500/10")}>
      <span className={cn("text-lg font-bold leading-none", urgent ? "text-red-400" : "text-white")}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

function getTimeLeft(targetDate: string) {
  const total = new Date(targetDate).getTime() - Date.now();
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
  };
}
