/**
 * Technical indicators — pure math, no API calls needed.
 * ⚠️ EDUCATIONAL ONLY — NOT FINANCIAL ADVICE
 */

import { OHLCV, IndicatorResult } from '../types';

export function calcSMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

export function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    result.push(prices[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calcRSI(prices: number[], period: number = 14): IndicatorResult {
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let avgGain = 0, avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (changes[i] < 0 ? Math.abs(changes[i]) : 0)) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `RSI=${rsi.toFixed(1)}`;

  if (rsi < 30) { signal = 'BUY'; strength = 80; reason += ' — Oversold'; }
  else if (rsi < 40) { signal = 'BUY'; strength = 60; reason += ' — Approaching oversold'; }
  else if (rsi > 70) { signal = 'SELL'; strength = 80; reason += ' — Overbought'; }
  else if (rsi > 60) { signal = 'SELL'; strength = 60; reason += ' — Approaching overbought'; }
  else { reason += ' — Neutral'; }

  return { name: 'RSI', value: rsi, signal, strength, reason };
}

export function calcMACD(prices: number[]): IndicatorResult {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);

  const current = histogram[histogram.length - 1];
  const prev = histogram[histogram.length - 2];

  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `MACD histogram=${current.toFixed(4)}`;

  if (current > 0 && prev <= 0) { signal = 'BUY'; strength = 85; reason += ' — Bullish crossover'; }
  else if (current < 0 && prev >= 0) { signal = 'SELL'; strength = 85; reason += ' — Bearish crossover'; }
  else if (current > 0 && current > prev) { signal = 'BUY'; strength = 60; reason += ' — Bullish momentum'; }
  else if (current < 0 && current < prev) { signal = 'SELL'; strength = 60; reason += ' — Bearish momentum'; }
  else { reason += ' — Neutral'; }

  return {
    name: 'MACD',
    value: { macd: macdLine[macdLine.length - 1], signal: signalLine[signalLine.length - 1], histogram: current },
    signal, strength, reason
  };
}

export function calcBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): IndicatorResult {
  const sma = calcSMA(prices, period);
  const lastSMA = sma[sma.length - 1];
  const recentPrices = prices.slice(-period);
  const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - lastSMA, 2), 0) / period;
  const sd = Math.sqrt(variance);

  const upper = lastSMA + stdDev * sd;
  const lower = lastSMA - stdDev * sd;
  const current = prices[prices.length - 1];
  const pctB = (current - lower) / (upper - lower);

  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `BB %B=${(pctB * 100).toFixed(1)}%`;

  if (pctB < 0) { signal = 'BUY'; strength = 85; reason += ' — Below lower band'; }
  else if (pctB < 0.2) { signal = 'BUY'; strength = 65; reason += ' — Near lower band'; }
  else if (pctB > 1) { signal = 'SELL'; strength = 85; reason += ' — Above upper band'; }
  else if (pctB > 0.8) { signal = 'SELL'; strength = 65; reason += ' — Near upper band'; }
  else { reason += ' — Within bands'; }

  return {
    name: 'BollingerBands',
    value: { upper, middle: lastSMA, lower, pctB },
    signal, strength, reason
  };
}

export function calcVolumeSignal(candles: OHLCV[]): IndicatorResult {
  const volumes = candles.map(c => c.volume);
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const ratio = currentVolume / avgVolume;
  const priceChange = (candles[candles.length - 1].close - candles[candles.length - 2].close) / candles[candles.length - 2].close;

  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `Volume ratio=${ratio.toFixed(2)}x avg`;

  if (ratio > 2 && priceChange > 0.02) { signal = 'BUY'; strength = 75; reason += ' — High volume + price up'; }
  else if (ratio > 2 && priceChange < -0.02) { signal = 'SELL'; strength = 75; reason += ' — High volume + price down'; }
  else if (ratio > 1.5 && priceChange > 0) { signal = 'BUY'; strength = 55; reason += ' — Above avg volume + up'; }
  else if (ratio > 1.5 && priceChange < 0) { signal = 'SELL'; strength = 55; reason += ' — Above avg volume + down'; }
  else { reason += ' — Normal volume'; }

  return { name: 'Volume', value: { ratio, avgVolume, currentVolume }, signal, strength, reason };
}

export function calcMovingAverages(prices: number[]): IndicatorResult {
  const sma20 = calcSMA(prices, 20);
  const sma50 = calcSMA(prices, Math.min(50, prices.length));
  const current = prices[prices.length - 1];
  const lastSMA20 = sma20[sma20.length - 1];
  const lastSMA50 = sma50[sma50.length - 1];

  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strength = 50;
  let reason = `Price vs SMA20: ${((current / lastSMA20 - 1) * 100).toFixed(1)}%`;

  if (current > lastSMA20 && lastSMA20 > lastSMA50) {
    signal = 'BUY'; strength = 70; reason += ' — Price > SMA20 > SMA50 (uptrend)';
  } else if (current < lastSMA20 && lastSMA20 < lastSMA50) {
    signal = 'SELL'; strength = 70; reason += ' — Price < SMA20 < SMA50 (downtrend)';
  } else if (current > lastSMA20) {
    signal = 'BUY'; strength = 55; reason += ' — Above SMA20';
  } else if (current < lastSMA20) {
    signal = 'SELL'; strength = 55; reason += ' — Below SMA20';
  }

  return { name: 'MovingAverages', value: { sma20: lastSMA20, sma50: lastSMA50, price: current }, signal, strength, reason };
}
