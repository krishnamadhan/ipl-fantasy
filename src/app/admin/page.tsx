import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "./AdminDashboard";

export const revalidate = 30;

export default async function AdminPage() {
  const supabase = await createClient();

  const [matchesRes, playersRes, syncLogRes] = await Promise.all([
    supabase
      .from("f11_matches")
      .select("id, team_home, team_away, status, scheduled_at, cricapi_match_id")
      .order("scheduled_at", { ascending: false })
      .limit(20),
    supabase
      .from("f11_players")
      .select("id, name, ipl_team, role, credit_value, is_playing")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("f11_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <AdminDashboard
      matches={matchesRes.data ?? []}
      recentPlayers={playersRes.data ?? []}
      syncLog={syncLogRes.data ?? []}
    />
  );
}
