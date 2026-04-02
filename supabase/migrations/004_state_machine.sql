-- Migration 004: Match State Machine Overhaul
-- Run this in Supabase SQL Editor BEFORE deploying the code changes.
--
-- New match status flow:
--   scheduled → open → locked → live → in_review → completed
--                └──────────────────────────────→ abandoned / no_result

-- ─── 1. Drop old CHECK constraint on f11_matches.status ──────────────────────
-- The initial schema used a TEXT column + CHECK constraint.
-- We drop it and replace with a broader one covering all new states.
ALTER TABLE f11_matches DROP CONSTRAINT IF EXISTS f11_matches_status_check;

-- ─── 2. Update existing 'lineup_open' rows to 'open' ─────────────────────────
UPDATE f11_matches SET status = 'open' WHERE status = 'lineup_open';

-- ─── 3. Add new CHECK constraint covering all valid statuses ─────────────────
ALTER TABLE f11_matches
  ADD CONSTRAINT f11_matches_status_check
  CHECK (status IN (
    'scheduled', 'open', 'locked', 'live',
    'in_review', 'completed', 'abandoned', 'no_result'
  ));

-- ─── 4. Rebuild partial index (old one referenced 'lineup_open') ─────────────
DROP INDEX IF EXISTS idx_matches_status;
CREATE INDEX idx_matches_status ON f11_matches(status)
  WHERE status IN ('live', 'open', 'locked', 'in_review');

-- ─── 5. Add points_breakdown JSONB column to f11_player_stats (FIX-02) ───────
ALTER TABLE f11_player_stats
  ADD COLUMN IF NOT EXISTS points_breakdown JSONB DEFAULT '{}';

-- ─── 6. Add live_score_summary + is_scoring_paused to f11_matches ────────────
ALTER TABLE f11_matches
  ADD COLUMN IF NOT EXISTS live_score_summary JSONB DEFAULT NULL;

ALTER TABLE f11_matches
  ADD COLUMN IF NOT EXISTS is_scoring_paused BOOLEAN DEFAULT FALSE;

-- ─── 7. Add previous_rank to f11_entries (rank change tracking) ──────────────
ALTER TABLE f11_entries
  ADD COLUMN IF NOT EXISTS previous_rank INTEGER DEFAULT NULL;

-- ─── 8. Performance indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entries_contest ON f11_entries(contest_id);
CREATE INDEX IF NOT EXISTS idx_entries_user    ON f11_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_team    ON f11_entries(team_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_match ON f11_player_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_contests_match  ON f11_contests(match_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_match ON f11_teams(user_id, match_id);

-- ─── 9. Season leaderboard table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS f11_season_leaderboard (
  user_id          UUID PRIMARY KEY REFERENCES f11_profiles(id),
  total_points     NUMERIC(8,1)  DEFAULT 0,
  matches_played   INTEGER       DEFAULT 0,
  contests_entered INTEGER       DEFAULT 0,
  wins             INTEGER       DEFAULT 0,
  podiums          INTEGER       DEFAULT 0,
  best_match_points  NUMERIC(7,1) DEFAULT 0,
  worst_match_points NUMERIC(7,1) DEFAULT 999,
  avg_points       NUMERIC(6,1)  DEFAULT 0,
  current_rank     INTEGER       DEFAULT NULL,
  previous_rank    INTEGER       DEFAULT NULL,
  current_streak   INTEGER       DEFAULT 0,
  updated_at       TIMESTAMPTZ   DEFAULT now()
);
