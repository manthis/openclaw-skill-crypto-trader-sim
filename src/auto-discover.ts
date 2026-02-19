/**
 * Auto-discover — Scan top coins by market cap for strong signals
 * ⚠️ EDUCATIONAL ONLY — NOT FINANCIAL ADVICE
 */

import { StrategyName } from './types';
import { STRATEGIES, analyzeIndicators, computeSignal } from './strategies/strategies';
import { getTopCoins, getMarketChart } from './api/coingecko';
import { log, setLogFile } from './utils/logger';

interface DiscoverResult {
  scanned: number;
  opportunities: Array<{
    coin: string;
    name: string;
    price: number;
    market_cap: number;
    signal: string;
    score: number;
    reasons: string[];
  }>;
  timestamp: string;
}

export async function runAutoDiscover(
  strategyName: StrategyName,
  topN: number = 50
): Promise<DiscoverResult> {
  const dateStr = new Date().toISOString().slice(0, 10);
  setLogFile(`auto-discover-${dateStr}.log`);

  const strategy = STRATEGIES[strategyName];
  log('info', `=== AUTO-DISCOVER START === top ${topN} coins, strategy=${strategyName}`);

  const topCoins = await getTopCoins(topN);
  const opportunities: DiscoverResult['opportunities'] = [];

  // Skip stablecoins
  const stablecoins = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FDUSD', 'USDD', 'PYUSD', 'FRAX']);

  for (const coin of topCoins) {
    if (stablecoins.has(coin.symbol)) continue;

    try {
      const candles = await getMarketChart(coin.symbol, 14);
      if (candles.length < 30) continue;

      const price = candles[candles.length - 1].close;
      const indicators = analyzeIndicators(candles.slice(-60), strategy);
      const signal = computeSignal(coin.symbol, price, indicators, strategy);

      if (signal.signal === 'BUY' && signal.score >= strategy.buyThreshold) {
        opportunities.push({
          coin: coin.symbol,
          name: coin.name,
          price,
          market_cap: coin.market_cap,
          signal: signal.signal,
          score: signal.score,
          reasons: signal.reasons,
        });
        log('signal', `🟢 ${coin.symbol} (${coin.name}): BUY score=${signal.score}`);
      }

      // Rate limit: CoinGecko free = ~10-30 req/min
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      log('warn', `Skipping ${coin.symbol}: ${e.message}`);
    }
  }

  // Sort by score descending
  opportunities.sort((a, b) => b.score - a.score);

  log('info', `=== AUTO-DISCOVER END === ${opportunities.length} opportunities from ${topCoins.length} coins`);

  return {
    scanned: topCoins.length,
    opportunities,
    timestamp: new Date().toISOString(),
  };
}
