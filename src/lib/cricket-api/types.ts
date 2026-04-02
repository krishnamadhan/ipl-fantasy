export interface CricApiMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  score?: CricApiScore[];
  series_id?: string;
  matchStarted: boolean;
  matchEnded: boolean;
  tossWinner?: string;
  tossChoice?: string;
  winner?: string;
  result?: string;
}

export interface CricApiScore {
  r: number;
  w: number;
  o: number;
  inning: string;
}

export interface CricApiScorecard {
  id: string;
  scorecard?: CricApiInnings[];
}

export interface CricApiInnings {
  inning: string;
  battingTeam?: string;
  batsmen?: CricApiBatsman[];
  bowlers?: CricApiBowler[];
  extras?: { r: number; b: number; lb: number; wd: number; nb: number; p: number };
}

export interface CricApiBatsman {
  batsman: string;
  batsmanId: string;
  r: number;
  b: number;
  fours: number;
  sixes: number;
  dismissal?: string;
}

export interface CricApiBowler {
  bowler: string;
  bowlerId: string;
  o: number;
  m: number;
  r: number;
  w: number;
  wd: number;
}

export interface CricApiPlayer {
  id: string;
  name: string;
  country?: string;
  playerType?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  role?: string;
}

export interface CricApiSquad {
  team: string;
  players: CricApiPlayer[];
}
