-- Prevent duplicate entries: same user joining the same contest with the same team
ALTER TABLE f11_entries ADD CONSTRAINT f11_entries_contest_team_unique UNIQUE (contest_id, team_id);
