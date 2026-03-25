export interface League {
  slug: string;
  name: string;
  country: string;
  flag: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
}

export interface Competitor {
  team: Team;
  score: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
}

export interface GameStatus {
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  description: string;
  detail: string;
  clock?: string;
  period?: number;
}

export interface Game {
  id: string;
  league: League;
  name: string;
  date: string;
  status: GameStatus;
  home: Competitor;
  away: Competitor;
  venue?: string;
}

export interface GameEvent {
  name: string;
  clock: string;
  period: number;
  type: {
    id: string;
    text: string;
  };
  team?: {
    id: string;
    displayName: string;
  };
  athletesInvolved?: {
    id: string;
    displayName: string;
    shortName: string;
    jersey: string;
  }[];
}

export interface StatItem {
  name: string;
  displayValue: string;
  homeValue?: string;
  awayValue?: string;
}

export interface Player {
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    jersey: string;
    position?: { abbreviation: string };
  };
  starter: boolean;
  position?: string;
  subbedIn?: boolean;
  subbedOut?: boolean;
}

export interface MatchDetail {
  game: Game;
  plays: GameEvent[];
  homeStats: StatItem[];
  awayStats: StatItem[];
  homePlayers: Player[];
  awayPlayers: Player[];
}

export interface Standing {
  team: Team;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  gamesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}
