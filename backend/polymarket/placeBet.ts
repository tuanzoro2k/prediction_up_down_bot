/**
 * Simple helper to place an order (bet) on Polymarket using the CLOB client.
 *
 * Requirements:
 * - Install deps: npm install @polymarket/clob-client
 * - Set env PRIVATE_KEY to your Polygon wallet private key (EOA with USDCe).
 *
 * This follows the official quickstart:
 * https://docs.polymarket.com/quickstart/first-order
 */
const { ClobClient, Side, OrderType } = require("@polymarket/clob-client");
const { Wallet } = require("ethers");

const CLOB_HOST = "https://clob.polymarket.com";
const POLYGON_CHAIN_ID = 137; // Polygon mainnet

export interface PlaceBetParams {
  tokenId: string;          // CLOB token id for the outcome (from Gamma API: clobTokenIds)
  price: number;            // Price per share, e.g. 0.55
  size: number;             // Number of shares, e.g. 10
  side: "BUY" | "SELL";     // BUY or SELL
}

/**
 * Place a single limit order on Polymarket.
 * - Derives/uses user API credentials.
 * - Assumes you are trading as an EOA (signatureType = 0) with your own USDCe.
 */
export async function placePolymarketBet(params: PlaceBetParams) {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY in environment");
  }

  // Step 1: Initialize signer and base client
  const signer = new Wallet(privateKey);

  const baseClient = new ClobClient(CLOB_HOST, POLYGON_CHAIN_ID, signer);

  // Step 2: Derive or fetch user API credentials (L2 auth)
  const userApiCreds = await baseClient.createOrDeriveApiKey();

  // Step 3: Re-initialize fully authenticated client (EOA example)
  const SIGNATURE_TYPE = 0;            // 0 = EOA (you pay gas, use your own wallet)
  const FUNDER_ADDRESS = signer.address;

  const client = new ClobClient(
    CLOB_HOST,
    POLYGON_CHAIN_ID,
    signer,
    userApiCreds,
    SIGNATURE_TYPE,
    FUNDER_ADDRESS
  );

  // Get market info for this token (tick size, negRisk flag, etc)
  const market = await client.getMarket(params.tokenId);

  const sideEnum = params.side === "BUY" ? Side.BUY : Side.SELL;

  // Step 5: Place the order
  const response = await client.createAndPostOrder(
    {
      tokenID: params.tokenId,
      price: params.price,
      size: params.size,
      side: sideEnum,
    },
    {
      tickSize: market.tickSize,
      negRisk: market.negRisk,
    },
    OrderType.GTC // Good-Til-Cancelled
  );

  return response;
}

