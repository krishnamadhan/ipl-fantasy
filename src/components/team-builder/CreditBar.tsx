"use client";
import { cn } from "@/lib/utils/format";

export default function CreditBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, (used / max) * 100);
  const remaining = max - used;
  const overBudget = used > max;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={overBudget ? "text-red-400 font-semibold" : "text-slate-400"}>
          {used.toFixed(1)} / {max} cr used
        </span>
        <span className={cn("font-semibold", overBudget ? "text-red-400" : remaining <= 5 ? "text-yellow-400" : "text-green-400")}>
          {remaining.toFixed(1)} left
        </span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", overBudget ? "bg-red-500" : "bg-brand")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
