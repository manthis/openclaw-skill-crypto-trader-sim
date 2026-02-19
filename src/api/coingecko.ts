/**
 * CoinGecko API — Price data & historical OHLCV
 * Free tier: 10-30 req/min, no key needed
 * Supports 10k+ coins via dynamic symbol→id resolution
 * ⚠️ EDUCATIONAL ONLY
 */

import * as fs from 'fs';
import * as path from 'path';
import { OHLCV } from '../types';
import { log } from '../utils/logger';

const BASE_URL = 'https://api.coingecko.com/api/v3';
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '../../state');
const COIN_LIST_CACHE = path.join(STATE_DIR, 'coingecko-coins.json');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

// Common symbols as seed — dynamically extended via API
const KNOWN_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2',
  MATIC: 'matic-network', LINK: 'chainlink', ATOM: 'cosmos',
  UNI: 'uniswap', DOGE: 'dogecoin', XRP: 'ripple',
  BNB: 'binancecoin', LTC: 'litecoin', NEAR: 'near',
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism',
  FTM: 'fantom', ALGO: 'algorand', FIL: 'filecoin',
  AAVE: 'aave', MKR: 'maker', CRV: 'curve-dao-token',
  SAND: 'the-sandbox', MANA: 'decentraland', AXS: 'axie-infinity',
  SHIB: 'shiba-inu', PEPE: 'pepe', TRX: 'tron',
  TON: 'the-open-network', SUI: 'sui', SEI: 'sei-network',
  INJ: 'injective-protocol', TIA: 'celestia', RENDER: 'render-token',
  FET: 'fetch-ai', RNDR: 'render-token', WLD: 'worldcoin-wld',
};

// Runtime cache: symbol → id
let symbolToId: Record<string, string> = { ...KNOWN_MAP };
let coinListLoaded = false;

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

/**
 * Load the full CoinGecko coin list (symbol→id mapping).
 * Cached to disk for 24h to avoid burning API calls.
 */
async function loadCoinList(): Promise<void> {
  if (coinListLoaded) return;

  // Try disk cache first
  if (fs.existsSync(COIN_LIST_CACHE)) {
    try {
      const stat = fs.statSync(COIN_LIST_CACHE);
      if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
        const cached = JSON.parse(fs.readFileSync(COIN_LIST_CACHE, 'utf-8'));
        for (const entry of cached) {
          const sym = entry.symbol?.toUpperCase();
          if (sym && entry.id && !symbolToId[sym]) {
            symbolToId[sym] = entry.id;
          }
        }
        coinListLoaded = true;
        log('info', `Loaded ${cached.length} coins from cache`);
        return;
      }
    } catch {
      log('warn', 'Coin list cache corrupted, refetching');
    }
  }

  // Fetch from API
  try {
    log('api', 'Fetching full CoinGecko coin list...');
    const data = await fetchJSON(`${BASE_URL}/coins/list`);
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(COIN_LIST_CACHE, JSON.stringify(data));

    for (const entry of data) {
      const sym = entry.symbol?.toUpperCase();
      if (sym && entry.id && !symbolToId[sym]) {
        symbolToId[sym] = entry.id;
      }
    }
    coinListLoaded = true;
    log('info', `Fetched and cached ${data.length} coins from CoinGecko`);
  } catch (e: any) {
    log('warn', `Failed to fetch coin list: ${e.message}. Using known mappings only.`);
    coinListLoaded = true;
  }
}

/**
 * Resolve a symbol (e.g. "BTC") or CoinGecko ID (e.g. "bitcoin") to a CoinGecko ID.
 */
export async function resolveCoinId(symbolOrId: string): Promise<string> {
  const upper = symbolOrId.toUpperCase();
  if (symbolToId[upper]) return symbolToId[upper];

  // Maybe it's already a CoinGecko ID
  if (symbolOrId === symbolOrId.toLowerCase() && symbolOrId.length > 2) {
    return symbolOrId;
  }

  // Load full list and try again
  await loadCoinList();
  if (symbolToId[upper]) return symbolToId[upper];

  log('warn', `Unknown symbol "${symbolOrId}", using lowercase as-is`);
  return symbolOrId.toLowerCase();
}

/**
 * Validate that a coin exists on CoinGecko. Returns the resolved ID or null.
 */
export async function validateCoin(symbolOrId: string): Promise<string | null> {
  const id = await resolveCoinId(symbolOrId);
  try {
    const data = await fetchJSON(`${BASE_URL}/simple/price?ids=${id}&vs_currencies=eur`);
    if (data[id]?.eur != null) return id;
    return null;
  } catch {
    return null;
  }
}

export async function getPrice(symbol: string): Promise<number> {
  const id = await resolveCoinId(symbol);
  log('api', `Fetching price for ${symbol} (${id})`);
  const data = await fetchJSON(`${BASE_URL}/simple/price?ids=${id}&vs_currencies=eur`);
  return data[id]?.eur ?? 0;
}

export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const idMap: Record<string, string> = {};
  for (const s of symbols) {
    idMap[s] = await resolveCoinId(s);
  }
  const ids = Object.values(idMap).join(',');
  log('api', `Fetching prices for ${symbols.join(',')}`);
  const data = await fetchJSON(`${BASE_URL}/simple/price?ids=${ids}&vs_currencies=eur`);
  const result: Record<string, number> = {};
  for (const symbol of symbols) {
    result[symbol] = data[idMap[symbol]]?.eur ?? 0;
  }
  return result;
}

export async function getOHLCV(symbol: string, days: number): Promise<OHLCV[]> {
  const id = await resolveCoinId(symbol);
  log('api', `Fetching ${days}d OHLCV for ${symbol} (${id})`);
  const data = await fetchJSON(`${BASE_URL}/coins/${id}/ohlc?vs_currency=eur&days=${days}`);

  return (data as number[][]).map(([timestamp, open, high, low, close]) => ({
    timestamp, open, high, low, close, volume: 0
  }));
}

export async function getMarketChart(symbol: string, days: number): Promise<OHLCV[]> {
  const id = await resolveCoinId(symbol);
  log('api', `Fetching ${days}d market chart for ${symbol} (${id})`);
  const data = await fetchJSON(`${BASE_URL}/coins/${id}/market_chart?vs_currency=eur&days=${days}`);

  const prices: [number, number][] = data.prices;
  const volumes: [number, number][] = data.total_volumes;

  return prices.map(([timestamp, price], i) => ({
    timestamp, open: price, high: price, low: price, close: price,
    volume: volumes[i]?.[1] ?? 0
  }));
}

/**
 * Fetch top N coins by market cap.
 */
export async function getTopCoins(limit: number = 100): Promise<Array<{
  symbol: string;
  id: string;
  name: string;
  market_cap: number;
  price: number;
}>> {
  log('api', `Fetching top ${limit} coins by market cap`);
  const perPage = Math.min(limit, 250);
  const pages = Math.ceil(limit / perPage);
  const results: any[] = [];

  for (let page = 1; page <= pages; page++) {
    const data = await fetchJSON(
      `${BASE_URL}/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`
    );
    results.push(...data);
    if (page < pages) await new Promise(r => setTimeout(r, 1500));
  }

  return results.slice(0, limit).map((c: any) => ({
    symbol: c.symbol.toUpperCase(),
    id: c.id,
    name: c.name,
    market_cap: c.market_cap,
    price: c.current_price,
  }));
}
