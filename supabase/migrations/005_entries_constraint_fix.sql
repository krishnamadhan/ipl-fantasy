-- Migration 005: Fix f11_entries constraint to handle NULL team_id properly
-- Run in Supabase SQL Editor

-- The UNIQUE(contest_id, team_id) constraint is bypassed when team_id is NULL
-- (databases treat NULL != NULL for uniqueness). Replace with a partial unique index
-- that only enforces uniqueness for non-NULL team_ids.

-- Drop old constraint if it exists
ALTER TABLE f11_entries
  DROP CONSTRAINT IF EXISTS f11_entries_contest_team_unique;

-- Replace with partial unique index (only enforces where team_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_contest_team_unique
  ON f11_entries(contest_id, team_id)
  WHERE team_id IS NOT NULL;

-- Also add index to speed up per-user-per-contest queries (for team limit check)
CREATE INDEX IF NOT EXISTS idx_entries_contest_user
  ON f11_entries(contest_id, user_id);
