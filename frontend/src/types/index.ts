export interface PredictionMarket {
  market_slug: string;
  question: string;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
}

export interface PredictionDecision {
  market_slug: string;
  direction: 'UP' | 'DOWN' | 'NO_BET';
  size_usd: number;
  max_loss_usd: number;
  edge_prob: number;
}

export interface PredictionResponse {
  symbol: string;
  timestamp: string;
  market: PredictionMarket;
  current_price: number | null;
  prediction: PredictionDecision;
  reasoning: string;
}

export interface PredictionHistoryEntry extends PredictionResponse {
  id: string;
}

export interface PlaceBetRequest {
  tokenId: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
}

export interface PlaceBetResponse {
  success: boolean;
  order: unknown;
  error?: string;
}
