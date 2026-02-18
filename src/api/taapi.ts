/**
 * TAAPI.IO API — Technical indicators
 * Free tier: 1 req/15s — use sparingly, fallback to local calc
 * ⚠️ EDUCATIONAL ONLY
 */

import { IndicatorResult } from '../types';
import { log } from '../utils/logger';

const BASE_URL = 'https://api.taapi.io';

async function fetchIndicator(indicator: string, params: Record<string, string>): Promise<any> {
  const apiKey = process.env.TAAPI_API_KEY;
  if (!apiKey) {
    log('api', `TAAPI: No API key, skipping ${indicator}`);
    return null;
  }

  const query = new URLSearchParams({ secret: apiKey, exchange: 'binance', ...params });
  const url = `${BASE_URL}/${indicator}?${query}`;
  log('api', `TAAPI: Fetching ${indicator} for ${params.symbol}`);

  const res = await fetch(url);
  if (!res.ok) {
    log('api', `TAAPI error ${res.status}: ${await res.text()}`);
    return null;
  }
  return res.json();
}

export async function getTaapiRSI(symbol: string, interval: string = '1h'): Promise<IndicatorResult | null> {
  const data = await fetchIndicator('rsi', { symbol: `${symbol}/USDT`, interval });
  if (!data) return null;

  const rsi = data.value;
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `TAAPI RSI=${rsi.toFixed(1)}`;

  if (rsi < 30) { signal = 'BUY'; strength = 80; reason += ' — Oversold'; }
  else if (rsi > 70) { signal = 'SELL'; strength = 80; reason += ' — Overbought'; }

  return { name: 'RSI (TAAPI)', value: rsi, signal, strength, reason };
}

export async function getTaapiMACD(symbol: string, interval: string = '1h'): Promise<IndicatorResult | null> {
  const data = await fetchIndicator('macd', { symbol: `${symbol}/USDT`, interval });
  if (!data) return null;

  const { valueMACD, valueMACDSignal, valueMACDHist } = data;
  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `TAAPI MACD hist=${valueMACDHist.toFixed(4)}`;

  if (valueMACDHist > 0 && valueMACD > valueMACDSignal) { signal = 'BUY'; strength = 70; reason += ' — Bullish'; }
  else if (valueMACDHist < 0 && valueMACD < valueMACDSignal) { signal = 'SELL'; strength = 70; reason += ' — Bearish'; }

  return { name: 'MACD (TAAPI)', value: { macd: valueMACD, signal: valueMACDSignal, histogram: valueMACDHist }, signal, strength, reason };
}
