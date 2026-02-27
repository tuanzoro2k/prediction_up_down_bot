import express from 'express';
import dotenv from 'dotenv';
import { PolymarketUpDownAgent } from './polymarket/prediction.js';
import { placePolymarketBet } from './polymarket/placeBet.js';
import prisma from './lib/db.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

const agent = new PolymarketUpDownAgent();

function toHistoryResponse(row: {
  id: string;
  symbol: string;
  timestamp: Date;
  currentPrice: number | null;
  marketSlug: string;
  question: string;
  outcomes: unknown;
  outcomePrices: unknown;
  clobTokenIds: unknown;
  direction: string;
  sizeUsd: number;
  maxLossUsd: number;
  edgeProb: number;
  reasoning: string;
}) {
  return {
    id: row.id,
    symbol: row.symbol,
    timestamp: row.timestamp.toISOString(),
    current_price: row.currentPrice,
    market: {
      market_slug: row.marketSlug,
      question: row.question,
      outcomes: row.outcomes as string[],
      outcomePrices: row.outcomePrices as number[],
      clobTokenIds: (row.clobTokenIds as string[]) ?? [],
    },
    prediction: {
      market_slug: row.marketSlug,
      direction: row.direction,
      size_usd: row.sizeUsd,
      max_loss_usd: row.maxLossUsd,
      edge_prob: row.edgeProb,
    },
    reasoning: row.reasoning,
  };
}

/**
 * GET /api/predict?symbol=BTC
 */
app.get('/api/predict', async (req, res) => {
  const symbol = (req.query.symbol as string | undefined)?.trim();

  if (!symbol) {
    res.status(400).json({ error: 'Missing required query parameter: symbol (e.g. ?symbol=BTC)' });
    return;
  }

  try {
    const { market, marketData, result } = await agent.predict(symbol);

    const row = await prisma.prediction.create({
      data: {
        symbol: symbol.toUpperCase(),
        currentPrice: marketData[0]?.current_price ?? null,
        marketSlug: market.market_slug,
        question: market.question,
        outcomes: market.outcomes,
        outcomePrices: market.outcomePrices,
        clobTokenIds: market.clobTokenIds,
        direction: result.decision.direction,
        sizeUsd: result.decision.size_usd,
        maxLossUsd: result.decision.max_loss_usd,
        edgeProb: result.decision.edge_prob,
        reasoning: result.reasoning,
      },
    });

    res.json(toHistoryResponse(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[predict] ${symbol} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/predictions?market_slug=xxx (optional filter)
 */
app.get('/api/predictions', async (req, res) => {
  try {
    const marketSlug = (req.query.market_slug as string | undefined)?.trim();

    const rows = await prisma.prediction.findMany({
      where: marketSlug ? { marketSlug } : undefined,
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    res.json(rows.map(toHistoryResponse));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[predictions] failed:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/place-bet
 * Body: { tokenId, price, size, side }
 */
app.post('/api/place-bet', async (req, res) => {
  try {
    const { tokenId, price, size, side } = req.body as {
      tokenId?: string;
      price?: number;
      size?: number;
      side?: 'BUY' | 'SELL';
    };

    if (!tokenId || price == null || size == null) {
      res.status(400).json({ error: 'Missing required fields: tokenId, price, size' });
      return;
    }

    const result = await placePolymarketBet({
      tokenId,
      price,
      size,
      side: side ?? 'BUY',
    });

    res.json({ success: true, order: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[place-bet] failed:', message);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Prediction API running on http://localhost:${PORT}`);
  console.log(`Try: GET http://localhost:${PORT}/api/predict?symbol=BTC`);
});
