/**
 * Trading strategies — configurable combinations of indicators
 * ⚠️ EDUCATIONAL ONLY — NOT FINANCIAL ADVICE
 */

import { StrategyConfig, StrategyName, IndicatorResult, TradeSignal, OHLCV } from '../types';
import { calcRSI, calcMACD, calcBollingerBands, calcVolumeSignal, calcMovingAverages } from '../indicators/technical';
import { log } from '../utils/logger';

export const STRATEGIES: Record<StrategyName, StrategyConfig> = {
  conservative: {
    name: 'conservative',
    description: 'Low risk — requires strong consensus from multiple indicators',
    indicators: ['RSI', 'MACD', 'BollingerBands', 'MovingAverages', 'Volume'],
    buyThreshold: 60,
    sellThreshold: -60,
    maxPositionPct: 20,
    stopLossPct: 5,
    takeProfitPct: 10,
  },
  balanced: {
    name: 'balanced',
    description: 'Medium risk — balanced between indicators',
    indicators: ['RSI', 'MACD', 'BollingerBands', 'MovingAverages'],
    buyThreshold: 40,
    sellThreshold: -40,
    maxPositionPct: 33,
    stopLossPct: 8,
    takeProfitPct: 15,
  },
  aggressive: {
    name: 'aggressive',
    description: 'High risk — acts on fewer confirmations',
    indicators: ['RSI', 'MACD', 'BollingerBands'],
    buyThreshold: 25,
    sellThreshold: -25,
    maxPositionPct: 50,
    stopLossPct: 12,
    takeProfitPct: 25,
  },
};

export function analyzeIndicators(candles: OHLCV[], strategy: StrategyConfig): IndicatorResult[] {
  const closes = candles.map(c => c.close);
  if (closes.length < 30) {
    log('warn', `Only ${closes.length} candles available, need at least 30 for reliable indicators`);
  }

  const results: IndicatorResult[] = [];

  if (strategy.indicators.includes('RSI') && closes.length >= 15) {
    results.push(calcRSI(closes));
  }
  if (strategy.indicators.includes('MACD') && closes.length >= 27) {
    results.push(calcMACD(closes));
  }
  if (strategy.indicators.includes('BollingerBands') && closes.length >= 21) {
    results.push(calcBollingerBands(closes));
  }
  if (strategy.indicators.includes('Volume') && candles.length >= 21) {
    results.push(calcVolumeSignal(candles));
  }
  if (strategy.indicators.includes('MovingAverages') && closes.length >= 21) {
    results.push(calcMovingAverages(closes));
  }

  return results;
}

export function computeSignal(coin: string, price: number, indicators: IndicatorResult[], strategy: StrategyConfig): TradeSignal {
  // Score: weighted average of indicator signals
  let totalScore = 0;
  const reasons: string[] = [];

  for (const ind of indicators) {
    const multiplier = ind.signal === 'BUY' ? 1 : ind.signal === 'SELL' ? -1 : 0;
    const score = multiplier * ind.strength;
    totalScore += score;
    reasons.push(ind.reason);
    log('signal', `  ${ind.name}: ${ind.signal} (strength=${ind.strength}, score=${score})`);
  }

  const avgScore = indicators.length > 0 ? totalScore / indicators.length : 0;
  const finalSignal = avgScore >= strategy.buyThreshold ? 'BUY'
    : avgScore <= strategy.sellThreshold ? 'SELL'
    : 'HOLD';

  log('signal', `${coin} final: ${finalSignal} (score=${avgScore.toFixed(1)}, thresholds: buy>${strategy.buyThreshold}, sell<${strategy.sellThreshold})`);

  return {
    coin,
    signal: finalSignal,
    score: Math.round(avgScore),
    reasons,
    indicators,
    timestamp: Date.now(),
    price,
  };
}
