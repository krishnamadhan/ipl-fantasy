-- Migration 005: FK constraints for captain/vc player joins
-- Adds missing FK references so PostgREST can join player names
-- in leaderboard queries via !captain_id / !vc_id hints.

-- ─── 1. f11_teams: captain_id → f11_players ────────────────────────────────
ALTER TABLE f11_teams
  ADD CONSTRAINT fk_teams_captain
    FOREIGN KEY (captain_id) REFERENCES f11_players(id) ON DELETE RESTRICT;

ALTER TABLE f11_teams
  ADD CONSTRAINT fk_teams_vc
    FOREIGN KEY (vc_id) REFERENCES f11_players(id) ON DELETE RESTRICT;

-- ─── 2. f11_entries: captain_id / vc_id → f11_players ─────────────────────
-- These are snapshot copies (no cascade delete — preserve match history)
ALTER TABLE f11_entries
  ADD CONSTRAINT fk_entries_captain
    FOREIGN KEY (captain_id) REFERENCES f11_players(id) ON DELETE RESTRICT;

ALTER TABLE f11_entries
  ADD CONSTRAINT fk_entries_vc
    FOREIGN KEY (vc_id) REFERENCES f11_players(id) ON DELETE RESTRICT;

-- ─── 3. f11_season_leaderboard: RLS ────────────────────────────────────────
ALTER TABLE f11_season_leaderboard ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'f11_season_leaderboard'
    AND policyname = 'season_lb_read'
  ) THEN
    CREATE POLICY "season_lb_read" ON f11_season_leaderboard
      FOR SELECT USING (true);
  END IF;
END $$;
