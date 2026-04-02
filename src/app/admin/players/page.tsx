import { createClient } from "@/lib/supabase/server";
import AdminPlayersClient from "./AdminPlayersClient";

export const revalidate = 60;

export default async function AdminPlayersPage() {
  const supabase = await createClient();
  const { data: players } = await supabase
    .from("f11_players")
    .select("*")
    .order("ipl_team", { ascending: true })
    .order("name", { ascending: true });

  return <AdminPlayersClient players={players ?? []} />;
}
