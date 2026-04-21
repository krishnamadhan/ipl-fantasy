-- ============================================================
-- Migration 010 — Fix f11_update_leaderboard for null team_id entries
-- ============================================================
-- Bug: migration 003 rewrote f11_update_leaderboard to join via f11_teams.
-- Entries created directly via f11_entries (bot teams, legacy entries, or
-- entries created before migration 003) have team_id = NULL.
-- When team_id IS NULL, the subquery returns no rows → SUM is NULL → 0.
-- Fix: fall back to f11_entries.player_ids / captain_id / vc_id when team_id IS NULL.
--
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION f11_update_leaderboard(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Recompute total_points for all entries in contests for this match.
  -- When team_id IS NOT NULL, use f11_teams (canonical source).
  -- When team_id IS NULL, fall back to f11_entries.player_ids/captain_id/vc_id.
  UPDATE f11_entries ce
  SET total_points = COALESCE((
    SELECT SUM(
      CASE
        WHEN ps.player_id = COALESCE(t.captain_id, ce.captain_id)
          THEN ps.fantasy_points * 2
        WHEN ps.player_id = COALESCE(t.vc_id, ce.vc_id)
          THEN ps.fantasy_points * 1.5
        ELSE ps.fantasy_points
      END
    )
    FROM f11_player_stats ps
    LEFT JOIN f11_teams t ON t.id = ce.team_id
    WHERE ps.match_id = p_match_id
      AND ps.player_id = ANY(
        CASE
          WHEN ce.team_id IS NOT NULL THEN t.player_ids
          ELSE ce.player_ids
        END
      )
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
