-- Migration 004 — Add FK constraints on f11_teams captain/vc columns
-- Run in Supabase SQL Editor

ALTER TABLE f11_teams
  ADD CONSTRAINT IF NOT EXISTS f11_teams_captain_fk
    FOREIGN KEY (captain_id) REFERENCES f11_players(id) ON DELETE RESTRICT,
  ADD CONSTRAINT IF NOT EXISTS f11_teams_vc_fk
    FOREIGN KEY (vc_id) REFERENCES f11_players(id) ON DELETE RESTRICT;
