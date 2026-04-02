"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { PlayerCreditHistory } from "@/types/player";

export default function CreditHistoryChart({
  history,
  currentCredit,
}: {
  history: PlayerCreditHistory[];
  currentCredit: number;
}) {
  const data = [
    ...history.map((h) => ({ date: h.created_at.slice(0, 10), credit: h.new_value })).reverse(),
    { date: "Now", credit: currentCredit },
  ];

  return (
    <div className="bg-surface-card rounded-2xl p-4 border border-slate-700">
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} />
          <YAxis
            domain={["dataMin - 0.5", "dataMax + 0.5"]}
            tick={{ fill: "#64748B", fontSize: 10 }}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
            formatter={(v: number) => [`${v} cr`, "Credit"]}
          />
          <Line
            type="monotone"
            dataKey="credit"
            stroke="#F5A623"
            strokeWidth={2}
            dot={{ fill: "#F5A623", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
