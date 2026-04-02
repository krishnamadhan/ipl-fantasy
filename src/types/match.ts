export type MatchStatus =
  | 'scheduled'   // Match announced, not open for team creation
  | 'open'        // Team creation window (was 'lineup_open')
  | 'locked'      // Deadline passed, teams frozen, pre-match
  | 'live'        // Match in progress, live scoring
  | 'in_review'   // Match over, admin reviewing points
  | 'completed'   // Points finalized, winners declared
  | 'abandoned'   // Rained out / cancelled
  | 'no_result';  // No result possible

export interface IplMatch {
  id: string;
  cricapi_match_id: string | null;
  match_number: number | null;
  team_home: string;
  team_away: string;
  venue: string | null;
  city: string | null;
  scheduled_at: string;
  status: MatchStatus;
  toss_winner: string | null;
  batting_first: string | null;
  result_summary: string | null;
  winner: string | null;
  raw_api_payload: unknown | null;
  live_score_summary: unknown | null;
  is_scoring_paused: boolean;
  last_synced_at: string | null;
  created_at: string;
}
