import type { PredictionResponse, PredictionHistoryEntry, PlaceBetRequest, PlaceBetResponse } from '../types';

const BASE = '';

export async function fetchPrediction(symbol: string): Promise<PredictionResponse> {
  const res = await fetch(`${BASE}/api/predict?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<PredictionResponse>;
}

export async function fetchPredictionHistory(): Promise<PredictionHistoryEntry[]> {
  const res = await fetch(`${BASE}/api/predictions`);
  if (!res.ok) {
    throw new Error(`Failed to load history (${res.status})`);
  }
  return res.json() as Promise<PredictionHistoryEntry[]>;
}

export async function placeBet(params: PlaceBetRequest): Promise<PlaceBetResponse> {
  const res = await fetch(`${BASE}/api/place-bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json() as PlaceBetResponse;
  if (!res.ok) {
    throw new Error(data.error || `Place bet failed (${res.status})`);
  }
  return data;
}
