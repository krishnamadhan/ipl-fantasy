-- ============================================================
-- 008: Backup Players (Substitute System) + Season Leaderboard
-- ============================================================

-- ── Backup Players: add bench_player_ids to teams and entries ──
-- Users pick 4 bench players alongside their 11. If a main player
-- doesn't play (not in playing XI), the first available bench player
-- who IS in playing XI auto-substitutes before scoring starts.
ALTER TABLE f11_teams
  ADD COLUMN IF NOT EXISTS bench_player_ids UUID[] DEFAULT '{}';

ALTER TABLE f11_entries
  ADD COLUMN IF NOT EXISTS bench_player_ids UUID[] DEFAULT '{}';

-- ── Impact Player tracking in f11_match_players ──
ALTER TABLE f11_match_players
  ADD COLUMN IF NOT EXISTS is_impact_player BOOLEAN DEFAULT FALSE;

-- ── Season Leaderboard: aggregate points across all completed matches ──
CREATE TABLE IF NOT EXISTS f11_season_leaderboard (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  matches      INTEGER DEFAULT 0,
  total_points NUMERIC(10,1) DEFAULT 0,
  best_rank    INTEGER,
  prizes_won   NUMERIC(12,2) DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE f11_season_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_leaderboard_public_read" ON f11_season_leaderboard
  FOR SELECT USING (true);
CREATE POLICY "season_leaderboard_service_write" ON f11_season_leaderboard
  FOR ALL USING (auth.role() = 'service_role');

-- ── RPC: Rebuild season leaderboard from all completed match entries ──
CREATE OR REPLACE FUNCTION f11_update_season_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO f11_season_leaderboard (user_id, display_name, matches, total_points, best_rank, prizes_won, updated_at)
  SELECT
    e.user_id,
    COALESCE(p.display_name, p.username, 'Player') AS display_name,
    COUNT(DISTINCT m.id)                            AS matches,
    COALESCE(SUM(e.total_points), 0)               AS total_points,
    MIN(e.rank)                                     AS best_rank,
    COALESCE(SUM(e.prize_won), 0)                  AS prizes_won,
    NOW()                                           AS updated_at
  FROM f11_entries e
  JOIN f11_contests c ON c.id = e.contest_id
  JOIN f11_matches  m ON m.id = c.match_id
  LEFT JOIN f11_profiles p ON p.id = e.user_id
  WHERE m.status = 'completed'
  GROUP BY e.user_id, p.display_name, p.username
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    matches      = EXCLUDED.matches,
    total_points = EXCLUDED.total_points,
    best_rank    = EXCLUDED.best_rank,
    prizes_won   = EXCLUDED.prizes_won,
    updated_at   = NOW();
END;
$$;

-- Add realtime for season leaderboard too
ALTER TABLE f11_season_leaderboard REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'f11_season_leaderboard'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE f11_season_leaderboard;
  END IF;
END $$;

-- ── Index for bench player lookup ──
CREATE INDEX IF NOT EXISTS idx_f11_entries_bench ON f11_entries USING gin(bench_player_ids);
