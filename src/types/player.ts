export type PlayerRole = 'WK' | 'BAT' | 'AR' | 'BOWL';

export interface IplPlayer {
  id: string;
  cricapi_player_id: string | null;
  name: string;
  ipl_team: string;
  role: PlayerRole;
  batting_style: string | null;
  bowling_style: string | null;
  credit_value: number;
  credit_override: boolean;
  is_playing: boolean;
  photo_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerMatchStats {
  id: string;
  match_id: string;
  player_id: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_dismissed: boolean;
  batting_position: number | null;
  overs_bowled: number;
  wickets: number;
  runs_conceded: number;
  maidens: number;
  wides: number;
  catches: number;
  stumpings: number;
  run_outs: number;
  run_outs_assist: number;
  fantasy_points: number;
}

export interface PlayerCreditHistory {
  id: string;
  player_id: string;
  old_value: number;
  new_value: number;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface PlayerWithStats extends IplPlayer {
  last_5_stats?: PlayerMatchStats[];
  credit_history?: PlayerCreditHistory[];
}
