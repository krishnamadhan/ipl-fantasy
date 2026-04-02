export type ContestType = 'mega' | 'small' | 'h2h' | 'private';
export type ContestStatus = 'open' | 'locked' | 'completed' | 'cancelled';
export type PrizePoolType = 'winner_takes_all' | 'tiered';

export interface Contest {
  id: string;
  match_id: string;
  created_by: string | null;
  name: string;
  contest_type: ContestType;
  invite_code: string | null;
  entry_fee: number;
  max_teams: number;
  prize_pool_type: PrizePoolType;
  prize_pool: number;
  status: ContestStatus;
  winner_paid_at: string | null;
  created_at: string;
  // Joined
  entry_count?: number;
}

export interface ContestEntry {
  id: string;
  contest_id: string;
  user_id: string;
  team_name: string | null;
  player_ids: string[];
  captain_id: string;
  vc_id: string;
  entry_fee_paid: number;
  total_points: number;
  rank: number | null;
  prize_won: number;
  created_at: string;
  // Joined
  profile?: { username: string; display_name: string | null; avatar_url: string | null };
}
