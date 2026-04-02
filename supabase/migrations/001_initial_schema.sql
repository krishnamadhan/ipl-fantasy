-- ============================================================
-- IPL Fantasy — Initial Schema
-- ============================================================

-- Settings table (stores series IDs, API keys etc)
CREATE TABLE IF NOT EXISTS f11_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS f11_profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       text UNIQUE NOT NULL,
  display_name   text,
  avatar_url     text,
  is_admin       boolean DEFAULT false,
  wallet_balance numeric(10,2) DEFAULT 10000.00 NOT NULL,
  created_at     timestamptz DEFAULT now()
);

-- IPL Players
CREATE TABLE IF NOT EXISTS f11_players (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cricapi_player_id   text UNIQUE,
  name                text NOT NULL,
  ipl_team            text NOT NULL,
  role                text NOT NULL CHECK (role IN ('WK','BAT','AR','BOWL')),
  batting_style       text,
  bowling_style       text,
  credit_value        numeric(3,1) NOT NULL DEFAULT 8.5,
  credit_override     boolean DEFAULT false,
  is_playing          boolean DEFAULT true,
  photo_url           text,
  last_synced_at      timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- IPL Matches
CREATE TABLE IF NOT EXISTS f11_matches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cricapi_match_id    text UNIQUE,
  match_number        int,
  team_home           text NOT NULL,
  team_away           text NOT NULL,
  venue               text,
  city                text,
  scheduled_at        timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','lineup_open','live','completed')),
  toss_winner         text,
  batting_first       text,
  result_summary      text,
  winner              text,
  raw_api_payload     jsonb,
  last_synced_at      timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- Player match stats
CREATE TABLE IF NOT EXISTS f11_player_stats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         uuid NOT NULL REFERENCES f11_matches(id) ON DELETE CASCADE,
  player_id        uuid NOT NULL REFERENCES f11_players(id) ON DELETE CASCADE,
  runs             int DEFAULT 0,
  balls_faced      int DEFAULT 0,
  fours            int DEFAULT 0,
  sixes            int DEFAULT 0,
  is_dismissed     boolean DEFAULT false,
  batting_position int,
  overs_bowled     numeric(4,1) DEFAULT 0,
  wickets          int DEFAULT 0,
  runs_conceded    int DEFAULT 0,
  maidens          int DEFAULT 0,
  wides            int DEFAULT 0,
  catches          int DEFAULT 0,
  stumpings        int DEFAULT 0,
  run_outs         int DEFAULT 0,
  run_outs_assist  int DEFAULT 0,
  fantasy_points   numeric(6,1) DEFAULT 0,
  UNIQUE(match_id, player_id)
);

-- Contests
CREATE TABLE IF NOT EXISTS f11_contests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         uuid NOT NULL REFERENCES f11_matches(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES f11_profiles(id),
  name             text NOT NULL,
  contest_type     text NOT NULL CHECK (contest_type IN ('mega','small','h2h','private')),
  invite_code      text UNIQUE,
  entry_fee        numeric(8,2) NOT NULL DEFAULT 0,
  max_teams        int NOT NULL DEFAULT 100,
  prize_pool_type  text NOT NULL DEFAULT 'winner_takes_all'
                     CHECK (prize_pool_type IN ('winner_takes_all','tiered')),
  prize_pool       numeric(10,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','locked','completed','cancelled')),
  winner_paid_at   timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- Contest entries
CREATE TABLE IF NOT EXISTS f11_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id     uuid NOT NULL REFERENCES f11_contests(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES f11_profiles(id) ON DELETE CASCADE,
  team_name      text,
  player_ids     uuid[] NOT NULL,
  captain_id     uuid NOT NULL,
  vc_id          uuid NOT NULL,
  entry_fee_paid numeric(8,2) DEFAULT 0,
  total_points   numeric(8,1) DEFAULT 0,
  rank           int,
  prize_won      numeric(8,2) DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(contest_id, user_id)
);

-- Wallet transactions (append-only ledger)
CREATE TABLE IF NOT EXISTS f11_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES f11_profiles(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('credit','debit')),
  amount         numeric(8,2) NOT NULL,
  reason         text NOT NULL,
  reference_id   uuid,
  balance_after  numeric(10,2) NOT NULL,
  created_at     timestamptz DEFAULT now()
);

-- Player credit history
CREATE TABLE IF NOT EXISTS f11_credit_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES f11_players(id) ON DELETE CASCADE,
  old_value   numeric(3,1) NOT NULL,
  new_value   numeric(3,1) NOT NULL,
  reason      text,
  changed_by  uuid REFERENCES f11_profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- API sync log
CREATE TABLE IF NOT EXISTS f11_sync_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          uuid REFERENCES f11_matches(id),
  sync_type         text NOT NULL,
  status            text NOT NULL CHECK (status IN ('success','error')),
  records_upserted  int DEFAULT 0,
  error_message     text,
  duration_ms       int,
  created_at        timestamptz DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_entries_contest_pts ON f11_entries(contest_id, total_points DESC);
CREATE INDEX idx_matches_status ON f11_matches(status) WHERE status IN ('live','lineup_open');
CREATE INDEX idx_entries_player_ids ON f11_entries USING GIN (player_ids);
CREATE INDEX idx_wallet_user_created ON f11_transactions(user_id, created_at DESC);
CREATE INDEX idx_players_team_role ON f11_players(ipl_team, role);
CREATE INDEX idx_stats_match ON f11_player_stats(match_id);

-- ============================================================
-- Atomic wallet deduction (prevents race conditions)
-- ============================================================
CREATE OR REPLACE FUNCTION f11_deduct_wallet(
  p_user_id     uuid,
  p_amount      numeric,
  p_reason      text,
  p_reference_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT wallet_balance INTO v_balance
  FROM f11_profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE f11_profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  INSERT INTO f11_transactions (user_id, type, amount, reason, reference_id, balance_after)
  VALUES (p_user_id, 'debit', p_amount, p_reason, p_reference_id, v_balance - p_amount);
END;
$$;

-- Credit wallet function
CREATE OR REPLACE FUNCTION f11_credit_wallet(
  p_user_id      uuid,
  p_amount       numeric,
  p_reason       text,
  p_reference_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT wallet_balance INTO v_balance
  FROM f11_profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE f11_profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;

  INSERT INTO f11_transactions (user_id, type, amount, reason, reference_id, balance_after)
  VALUES (p_user_id, 'credit', p_amount, p_reason, p_reference_id, v_balance + p_amount);
END;
$$;

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION f11_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO f11_profiles (id, username, display_name, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    10000.00
  );
  -- Log signup bonus
  INSERT INTO f11_transactions (user_id, type, amount, reason, balance_after)
  VALUES (NEW.id, 'credit', 10000.00, 'Signup bonus', 10000.00);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE f11_handle_new_user();

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE f11_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE f11_sync_log ENABLE ROW LEVEL SECURITY;

-- Profiles: read own, update own
CREATE POLICY "profiles_read_own" ON f11_profiles FOR SELECT USING (auth.uid() = id OR true); -- public read for leaderboard names
CREATE POLICY "profiles_update_own" ON f11_profiles FOR UPDATE USING (auth.uid() = id);

-- Players: public read
CREATE POLICY "players_read" ON f11_players FOR SELECT USING (true);
CREATE POLICY "players_admin_write" ON f11_players FOR ALL USING (
  EXISTS (SELECT 1 FROM f11_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Matches: public read
CREATE POLICY "matches_read" ON f11_matches FOR SELECT USING (true);
CREATE POLICY "matches_admin_write" ON f11_matches FOR ALL USING (
  EXISTS (SELECT 1 FROM f11_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Stats: public read
CREATE POLICY "stats_read" ON f11_player_stats FOR SELECT USING (true);
CREATE POLICY "stats_admin_write" ON f11_player_stats FOR ALL USING (
  EXISTS (SELECT 1 FROM f11_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Contests: public read
CREATE POLICY "contests_read" ON f11_contests FOR SELECT USING (true);
CREATE POLICY "contests_insert" ON f11_contests FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "contests_admin_write" ON f11_contests FOR ALL USING (
  EXISTS (SELECT 1 FROM f11_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Contest entries: own always, others only when match is live/completed
CREATE POLICY "entries_read_own" ON f11_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "entries_read_others_live" ON f11_entries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM f11_contests c
    JOIN f11_matches m ON m.id = c.match_id
    WHERE c.id = contest_id AND m.status IN ('live','completed')
  )
);
CREATE POLICY "entries_insert" ON f11_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update_own" ON f11_entries FOR UPDATE USING (auth.uid() = user_id);

-- Wallet: read own only, no direct insert/update/delete
CREATE POLICY "wallet_read_own" ON f11_transactions FOR SELECT USING (auth.uid() = user_id);

-- Credit history: public read
CREATE POLICY "credit_history_read" ON f11_credit_history FOR SELECT USING (true);

-- Sync log: admin only
CREATE POLICY "sync_log_admin" ON f11_sync_log FOR ALL USING (
  EXISTS (SELECT 1 FROM f11_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================================
-- Seed: default f11_settings
-- ============================================================
INSERT INTO f11_settings (key, value) VALUES
  ('cricapi_series_id', ''),
  ('ipl_season', '2025')
ON CONFLICT (key) DO NOTHING;
