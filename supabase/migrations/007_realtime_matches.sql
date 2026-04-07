-- Enable Supabase Realtime for f11_matches so LiveScoreHeader and DashboardLiveCard
-- receive live updates when sync-live cron writes new score data.
-- f11_entries is also confirmed here (used by LiveLeaderboard).

ALTER TABLE f11_matches REPLICA IDENTITY FULL;
ALTER TABLE f11_entries REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Add f11_matches to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'f11_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE f11_matches;
  END IF;

  -- Add f11_entries to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'f11_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE f11_entries;
  END IF;
END $$;
