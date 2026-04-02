// Supabase Edge Function — syncs IPL squads from Cricbuzz (RapidAPI)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CB_HOST = "cricbuzz-cricket.p.rapidapi.com";
const CB_BASE = `https://${CB_HOST}`;

function cbHeaders() {
  return {
    "X-RapidAPI-Key": Deno.env.get("RAPIDAPI_KEY")!,
    "X-RapidAPI-Host": CB_HOST,
  };
}

// Map Cricbuzz role strings to our WK/BAT/AR/BOWL values
function mapRole(role: string = ""): string {
  const r = role.toLowerCase();
  if (r.includes("keeper") || r.includes("wicket")) return "WK";
  if (r.includes("all")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  return "BAT";
}

// Cricbuzz /mcenter/v1/{matchId}/squad response structure:
// { team1: { players: [...], teamName: "..." }, team2: { players: [...], teamName: "..." } }
// Each player: { id, name, role, ... }
// Player ID field: "id" (confirmed from pycricbuzz source)
function extractPlayers(squadData: any): Array<{ id: string; name: string; role: string; team: string }> {
  const players: any[] = [];

  function processTeam(teamObj: any, fallbackName: string) {
    if (!teamObj) return;
    const teamName = teamObj.teamName ?? teamObj.name ?? fallbackName;

    // Players may be in different locations depending on wrapper version
    let playerList: any[] = [];
    if (Array.isArray(teamObj.players)) {
      playerList = teamObj.players;
    } else if (teamObj.players && typeof teamObj.players === "object") {
      playerList = Object.values(teamObj.players);
    } else if (Array.isArray(teamObj.squad)) {
      playerList = teamObj.squad;
    }

    for (const p of playerList) {
      // Player ID: confirmed as "id" in Cricbuzz format
      const id = String(p.id ?? p.playerId ?? p.pid ?? "");
      if (!id || id === "undefined") continue;

      players.push({
        id,
        name: p.name ?? p.fullName ?? p.playerName ?? "",
        role: mapRole(p.role ?? p.playerRole ?? p.playerType ?? ""),
        team: p.teamName ?? teamName,
      });
    }
  }

  if (squadData?.team1) {
    processTeam(squadData.team1, "Team 1");
    processTeam(squadData.team2, "Team 2");
  } else if (squadData?.squad) {
    processTeam(squadData.squad, squadData.squad?.teamName ?? "");
  } else if (Array.isArray(squadData?.players)) {
    processTeam(squadData, squadData?.teamName ?? "");
  } else {
    // Try iterating top-level keys as team objects
    for (const [key, val] of Object.entries(squadData ?? {})) {
      if (typeof val === "object" && val !== null && !Array.isArray(val) && (val as any).players) {
        processTeam(val, key);
      }
    }
  }

  return players;
}

Deno.serve(async () => {
  const start = Date.now();
  let recordsUpserted = 0;

  try {
    // Get upcoming/open matches that have a cricbuzz match ID
    const { data: matches, error: matchErr } = await supabase
      .from("f11_matches")
      .select("id, cricapi_match_id, team_home, team_away")
      .not("cricapi_match_id", "is", null)
      .in("status", ["scheduled", "open", "locked"])
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (matchErr) throw new Error(`DB error: ${matchErr.message}`);
    if (!matches?.length) throw new Error("No scheduled matches — run sync-schedule first");

    const processed = new Set<string>();

    for (const match of matches) {
      if (processed.has(match.cricapi_match_id)) continue;
      processed.add(match.cricapi_match_id);

      const res = await fetch(
        `${CB_BASE}/mcenter/v1/${match.cricapi_match_id}/squad`,
        { headers: cbHeaders() }
      );
      const data = await res.json();

      if (!data || data.error) {
        console.warn(`Squad fetch failed for match ${match.cricapi_match_id}:`, data?.error ?? "unknown");
        continue;
      }

      const players = extractPlayers(data);
      console.log(`Match ${match.cricapi_match_id}: found ${players.length} players`);

      for (const p of players) {
        const teamName = p.team || match.team_home;
        const { error } = await supabase
          .from("f11_players")
          .upsert(
            {
              cricapi_player_id: p.id,
              name: p.name,
              ipl_team: teamName,
              role: p.role,
              credit_value: 8.5,
              is_playing: true,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "cricapi_player_id", ignoreDuplicates: false }
          );
        if (!error) recordsUpserted++;
        else console.warn(`Upsert failed for player ${p.id}:`, error.message);
      }
    }

    await supabase.from("f11_sync_log").insert({
      sync_type: "sync-squads",
      status: "success",
      records_upserted: recordsUpserted,
      duration_ms: Date.now() - start,
    });

    return new Response(
      JSON.stringify({ ok: true, recordsUpserted, matchesChecked: processed.size }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    await supabase.from("f11_sync_log").insert({
      sync_type: "sync-squads",
      status: "error",
      error_message: err.message,
      duration_ms: Date.now() - start,
    });
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
