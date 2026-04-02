"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { formatCurrency } from "@/lib/utils/format";
import type { Contest } from "@/types/contest";

export default function ContestJoinButton({
  contest,
  matchId,
  userId,
}: {
  contest: Contest;
  matchId: string;
  userId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin() {
    // Retrieve saved team from sessionStorage
    const saved = sessionStorage.getItem(`team_${matchId}`);
    if (!saved) {
      toast.error("Build your team first!");
      router.push(`/team-builder/${matchId}`);
      return;
    }

    const team = JSON.parse(saved);

    setLoading(true);
    try {
      const res = await fetch("/api/contests/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contest_id: contest.id,
          ...team,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to join contest");
        return;
      }

      toast.success("Joined successfully!");
      sessionStorage.removeItem(`team_${matchId}`);
      router.push(`/contests/${contest.id}`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toaster />
      <button
        onClick={handleJoin}
        disabled={loading}
        className="bg-brand text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-brand-dark transition disabled:opacity-50"
      >
        {loading ? "Joining…" : contest.entry_fee > 0 ? `Pay ${formatCurrency(contest.entry_fee)}` : "Join Free"}
      </button>
    </>
  );
}
