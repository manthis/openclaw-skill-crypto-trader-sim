/**
 * CoinGecko API — Price data & historical OHLCV
 * Free tier: 10-30 req/min, no key needed
 * ⚠️ EDUCATIONAL ONLY
 */

import { OHLCV } from '../types';
import { log } from '../utils/logger';

const BASE_URL = 'https://api.coingecko.com/api/v3';

const COIN_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2',
  MATIC: 'matic-network', LINK: 'chainlink', ATOM: 'cosmos',
  UNI: 'uniswap', DOGE: 'dogecoin', XRP: 'ripple',
  BNB: 'binancecoin', LTC: 'litecoin',
};

function getCoinId(symbol: string): string {
  return COIN_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
}

async function fetchJSON(url: string): Promise<any> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinGecko ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getPrice(symbol: string): Promise<number> {
  const id = getCoinId(symbol);
  log('api', `Fetching price for ${symbol} (${id})`);
  const data = await fetchJSON(`${BASE_URL}/simple/price?ids=${id}&vs_currencies=eur`);
  return data[id]?.eur ?? 0;
}

export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols.map(getCoinId).join(',');
  log('api', `Fetching prices for ${symbols.join(',')}`);
  const data = await fetchJSON(`${BASE_URL}/simple/price?ids=${ids}&vs_currencies=eur`);
  const result: Record<string, number> = {};
  for (const symbol of symbols) {
    const id = getCoinId(symbol);
    result[symbol] = data[id]?.eur ?? 0;
  }
  return result;
}

export async function getOHLCV(symbol: string, days: number): Promise<OHLCV[]> {
  const id = getCoinId(symbol);
  log('api', `Fetching ${days}d OHLCV for ${symbol}`);
  const data = await fetchJSON(`${BASE_URL}/coins/${id}/ohlc?vs_currency=eur&days=${days}`);

  return (data as number[][]).map(([timestamp, open, high, low, close]) => ({
    timestamp, open, high, low, close, volume: 0
  }));
}

export async function getMarketChart(symbol: string, days: number): Promise<OHLCV[]> {
  const id = getCoinId(symbol);
  log('api', `Fetching ${days}d market chart for ${symbol}`);
  const data = await fetchJSON(`${BASE_URL}/coins/${id}/market_chart?vs_currency=eur&days=${days}`);

  const prices: [number, number][] = data.prices;
  const volumes: [number, number][] = data.total_volumes;

  return prices.map(([timestamp, price], i) => ({
    timestamp, open: price, high: price, low: price, close: price,
    volume: volumes[i]?.[1] ?? 0
  }));
}
