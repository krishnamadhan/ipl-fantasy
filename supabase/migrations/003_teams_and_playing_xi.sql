-- ============================================================
-- Migration 003 — f11_teams, playing XI, prize_tiers
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Saved teams (multiple per user per match, up to 6)
CREATE TABLE IF NOT EXISTS f11_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES f11_profiles(id) ON DELETE CASCADE,
  match_id    uuid NOT NULL REFERENCES f11_matches(id) ON DELETE CASCADE,
  team_name   text NOT NULL DEFAULT 'My Team',
  player_ids  uuid[] NOT NULL,
  captain_id  uuid NOT NULL,
  vc_id       uuid NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_user_match ON f11_teams(user_id, match_id);

-- 2. Per-match playing XI status
CREATE TABLE IF NOT EXISTS f11_match_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid NOT NULL REFERENCES f11_matches(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES f11_players(id) ON DELETE CASCADE,
  is_playing_xi   boolean DEFAULT false,
  batting_order   int,
  UNIQUE(match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON f11_match_players(match_id);

-- 3. Extend f11_contests with prize_tiers
ALTER TABLE f11_contests
  ADD COLUMN IF NOT EXISTS prize_tiers      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS guaranteed_pool  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS winners_count    int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS platform_rake    numeric(4,3) DEFAULT 0.10;

-- 4. Add team_id to f11_entries + allow multiple entries per user per contest
ALTER TABLE f11_entries
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES f11_teams(id) ON DELETE SET NULL;

-- Drop old single-entry constraint
ALTER TABLE f11_entries
  DROP CONSTRAINT IF EXISTS f11_entries_contest_id_user_id_key;

-- New: same team can't enter same contest twice
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'f11_entries_contest_team_unique'
  ) THEN
    ALTER TABLE f11_entries ADD CONSTRAINT f11_entries_contest_team_unique UNIQUE (contest_id, team_id);
  END IF;
END $$;

-- 5. RLS
ALTER TABLE f11_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_match_players ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teams_own' AND tablename = 'f11_teams') THEN
    CREATE POLICY "teams_own" ON f11_teams
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teams_read_live' AND tablename = 'f11_teams') THEN
    CREATE POLICY "teams_read_live" ON f11_teams FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM f11_matches m
        WHERE m.id = match_id AND m.status IN ('live','completed')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_players_read' AND tablename = 'f11_match_players') THEN
    CREATE POLICY "match_players_read" ON f11_match_players FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_players_admin' AND tablename = 'f11_match_players') THEN
    CREATE POLICY "match_players_admin" ON f11_match_players FOR ALL USING (
      EXISTS (SELECT 1 FROM f11_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- 6. Updated leaderboard function — points via f11_teams
CREATE OR REPLACE FUNCTION f11_update_leaderboard(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Recompute total_points for all entries in contests for this match
  UPDATE f11_entries ce
  SET total_points = COALESCE((
    SELECT SUM(
      CASE
        WHEN ps.player_id = t.captain_id THEN ps.fantasy_points * 2
        WHEN ps.player_id = t.vc_id      THEN ps.fantasy_points * 1.5
        ELSE ps.fantasy_points
      END
    )
    FROM f11_teams t
    JOIN f11_player_stats ps
      ON ps.match_id = p_match_id
      AND ps.player_id = ANY(t.player_ids)
    WHERE t.id = ce.team_id
  ), 0)
  WHERE ce.contest_id IN (
    SELECT id FROM f11_contests WHERE match_id = p_match_id
  );

  -- Re-rank within each contest
  UPDATE f11_entries ce
  SET rank = r.rank
  FROM (
    SELECT id,
           RANK() OVER (PARTITION BY contest_id ORDER BY total_points DESC) AS rank
    FROM f11_entries
    WHERE contest_id IN (SELECT id FROM f11_contests WHERE match_id = p_match_id)
  ) r
  WHERE ce.id = r.id;
END;
$$;
