-- Bulk leaderboard update function (no N+1)
CREATE OR REPLACE FUNCTION f11_update_leaderboard(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Update total_points for all entries in f11_contests for this match
  UPDATE f11_entries ce
  SET total_points = (
    SELECT COALESCE(SUM(
      CASE
        WHEN p.player_id = ce.captain_id THEN p.fantasy_points * 2
        WHEN p.player_id = ce.vc_id      THEN p.fantasy_points * 1.5
        ELSE p.fantasy_points
      END
    ), 0)
    FROM f11_player_stats p
    WHERE p.match_id = p_match_id
      AND p.player_id = ANY(ce.player_ids)
  )
  WHERE ce.contest_id IN (
    SELECT id FROM f11_contests WHERE match_id = p_match_id
  );

  -- Update ranks within each contest
  UPDATE f11_entries ce
  SET rank = ranked.rank
  FROM (
    SELECT id,
           RANK() OVER (PARTITION BY contest_id ORDER BY total_points DESC) AS rank
    FROM f11_entries
    WHERE contest_id IN (SELECT id FROM f11_contests WHERE match_id = p_match_id)
  ) ranked
  WHERE ce.id = ranked.id;
END;
$$;
