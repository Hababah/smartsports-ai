
export type Sport = "football" | "basketball" | "tennis";

export type DataStatus =
  | "verified"
  | "provisional"
  | "stale"
  | "unavailable"
  | "rejected";

export type FixtureStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "postponed"
  | "cancelled"
  | "abandoned";

export type MarketStatus =
  | "active"
  | "suspended"
  | "settled"
  | "unavailable";

export type MarketType =
  | "match_winner"
  | "draw"
  | "double_chance"
  | "over_under"
  | "handicap"
  | "both_teams_to_score"
  | "correct_score"
  | "set_winner"
  | "game_handicap"
  | "set_handicap"
  | "player_points"
  | "team_total"
  | "other";

export interface Participant {
  id: string;
  name: string;
  country?: string;
  shortName?: string;
}

export interface Competition {
  id: string;
  name: string;
  country?: string;
  sport: Sport;
  genderCategory?: "men" | "women" | "mixed" | "unknown";
  season?: string;
}

export interface Fixture {
  id: string;
  providerId: string;
  providerName: string;

  sport: Sport;
  competition: Competition;

  home: Participant;
  away: Participant;

  startTime: string;
  timezone: string;

  status: FixtureStatus;
  dataStatus: DataStatus;

  lastUpdated: string;
  sourceUrl?: string;
}

export interface MarketOutcome {
  id: string;
  name: string;
  decimalOdds: number;

  status: MarketStatus;
  lastUpdated: string;
}

export interface BettingMarket {
  id: string;
  providerMarketId: string;

  fixtureId: string;
  sport: Sport;

  type: MarketType;
  name: string;

  line?: number;
  outcomes: MarketOutcome[];

  status: MarketStatus;
  lastUpdated: string;
}

export interface OddsSnapshot {
  id: string;
  fixtureId: string;
  marketId: string;

  providerName: string;
  capturedAt: string;

  outcomes: MarketOutcome[];
}

export interface DataQuality {
  status: DataStatus;
  score: number;

  missingFields: string[];
  warnings: string[];

  sourceCount: number;
  lastVerifiedAt?: string;
}

export interface Prediction {
  id: string;

  fixtureId: string;
  marketId: string;
  outcomeId: string;

  estimatedProbability: number;
  lowerProbabilityBound: number;
  upperProbabilityBound: number;

  decimalOdds: number;
  estimatedExpectedValue: number;

  confidence: number;
  quality: DataQuality;

  explanation: string[];
  modelVersion: string;

  generatedAt: string;
  expiresAt: string;
}

export interface SelectionCandidate {
  id: string;

  fixture: Fixture;
  market: BettingMarket;
  outcome: MarketOutcome;
  prediction: Prediction;

  eligible: boolean;
  rejectionReasons: string[];

  duplicateKey: string;
}

export interface TicketSelection {
  selectionId: string;
  fixtureId: string;

  marketId: string;
  outcomeId: string;

  decimalOdds: number;
  estimatedProbability: number;
}

export interface GeneratedTicket {
  id: string;

  sessionId: string;
  sessionType: "daytime" | "overnight";

  selections: TicketSelection[];

  combinedOdds: number;
  selectionCount: number;

  status: "draft" | "qualified" | "rejected";

  warnings: string[];
  generatedAt: string;
}
