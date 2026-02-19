/**
 * Auto-trader — Automated trading logic for heartbeat mode
 * ⚠️ EDUCATIONAL SIMULATOR ONLY — NOT FINANCIAL ADVICE
 * 
 * Loads portfolio, analyzes market, executes trades automatically,
 * and persists state for the next heartbeat cycle.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StrategyName, TradeSignal, Portfolio, Trade } from './types';
import { STRATEGIES, analyzeIndicators, computeSignal } from './strategies/strategies';
import { getMarketChart, getPrices } from './api/coingecko';
import { loadPortfolio, savePortfolio } from './portfolio';
import { log, setLogFile } from './utils/logger';

const CAPITAL_RESERVE = 10; // Keep €10 minimum reserve

interface AutoTradeResult {
  new_trades: {
    action: 'BUY' | 'SELL';
    coin: string;
    amount: number;
    price: number;
    signal: string;
    pnl?: number;
  }[];
  portfolio: {
    capital: number;
    positions: number;
    pnl: number;
    pnl_pct: number;
    total_value: number;
  };
  errors: string[];
  timestamp: string;
}

export async function runAutoTrade(
  coins: string[],
  strategyName: StrategyName,
  initialCapital: number
): Promise<AutoTradeResult> {
  const dateStr = new Date().toISOString().slice(0, 10);
  setLogFile(`auto-trade-${dateStr}.log`);

  log('info', `=== AUTO-TRADE START === strategy=${strategyName}, coins=${coins.join(',')}`);

  const strategy = STRATEGIES[strategyName];
  let portfolio = loadPortfolio(initialCapital);
  const newTrades: AutoTradeResult['new_trades'] = [];
  const errors: string[] = [];

  // Fetch current prices for existing positions (for stop-loss/take-profit)
  if (portfolio.positions.length > 0) {
    try {
      const posCoins = portfolio.positions.map(p => p.coin);
      const prices = await getPrices(posCoins);
      for (const pos of portfolio.positions) {
        pos.currentPrice = prices[pos.coin] || pos.entryPrice;
        pos.pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
        pos.pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      }
    } catch (e: any) {
      log('warn', `Failed to update position prices: ${e.message}`);
      errors.push(`Price update failed: ${e.message}`);
    }
  }

  // Check stop-loss / take-profit on existing positions FIRST
  for (let i = portfolio.positions.length - 1; i >= 0; i--) {
    const pos = portfolio.positions[i];
    if (!pos.currentPrice) continue;
    const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

    let reason = '';
    if (pnlPct <= -strategy.stopLossPct) {
      reason = `Stop-loss triggered at ${pnlPct.toFixed(1)}%`;
    } else if (pnlPct >= strategy.takeProfitPct) {
      reason = `Take-profit triggered at ${pnlPct.toFixed(1)}%`;
    }

    if (reason) {
      const amount = pos.quantity * pos.currentPrice;
      const pnl = amount - (pos.quantity * pos.entryPrice);
      portfolio.capital += amount;

      const trade: Trade = {
        id: `T${Date.now()}-${i}`,
        coin: pos.coin,
        side: 'SELL',
        price: pos.currentPrice,
        quantity: pos.quantity,
        total: amount,
        timestamp: Date.now(),
        reason,
        indicators: [],
      };
      portfolio.trades.push(trade);
      portfolio.positions.splice(i, 1);

      newTrades.push({
        action: 'SELL',
        coin: pos.coin,
        amount: pos.quantity,
        price: pos.currentPrice,
        signal: reason,
        pnl,
      });

      log('trade', `AUTO ${reason}: SELL ${pos.coin} @ €${pos.currentPrice.toFixed(2)}, PnL: €${pnl.toFixed(2)}`);
    }
  }

  // Analyze each coin and generate signals
  for (const coin of coins) {
    try {
      const candles = await getMarketChart(coin, 30);
      if (candles.length < 30) {
        log('warn', `Not enough data for ${coin} (${candles.length} candles)`);
        errors.push(`${coin}: insufficient data`);
        continue;
      }

      const price = candles[candles.length - 1].close;
      const indicators = analyzeIndicators(candles.slice(-60), strategy);
      const signal = computeSignal(coin, price, indicators, strategy);

      log('signal', `${coin}: ${signal.signal} (score=${signal.score}) @ €${price.toFixed(2)}`);

      if (signal.signal === 'BUY') {
        // Check: no double-trade on same coin
        if (portfolio.positions.find(p => p.coin === coin)) {
          log('trade', `Already holding ${coin}, skipping BUY`);
          continue;
        }

        // Check: enough capital (respect reserve)
        const availableCapital = portfolio.capital - CAPITAL_RESERVE;
        if (availableCapital < 1) {
          log('trade', `Insufficient capital (€${portfolio.capital.toFixed(2)}, reserve=€${CAPITAL_RESERVE})`);
          continue;
        }

        const maxAmount = availableCapital * (strategy.maxPositionPct / 100);
        const tradeAmount = Math.min(maxAmount, availableCapital);
        const quantity = tradeAmount / price;

        portfolio.capital -= tradeAmount;
        portfolio.positions.push({
          coin,
          entryPrice: price,
          quantity,
          entryTime: Date.now(),
          currentPrice: price,
          pnl: 0,
          pnlPercent: 0,
        });

        const trade: Trade = {
          id: `T${Date.now()}`,
          coin,
          side: 'BUY',
          price,
          quantity,
          total: tradeAmount,
          timestamp: Date.now(),
          reason: signal.reasons.join('; '),
          indicators: signal.indicators.map(i => i.name),
        };
        portfolio.trades.push(trade);

        newTrades.push({
          action: 'BUY',
          coin,
          amount: quantity,
          price,
          signal: signal.reasons.join(' + '),
        });

        log('trade', `AUTO BUY ${quantity.toFixed(6)} ${coin} @ €${price.toFixed(2)} = €${tradeAmount.toFixed(2)}`);
      }

      if (signal.signal === 'SELL') {
        const posIdx = portfolio.positions.findIndex(p => p.coin === coin);
        if (posIdx === -1) {
          log('trade', `No position in ${coin}, skipping SELL signal`);
          continue;
        }

        const pos = portfolio.positions[posIdx];
        const amount = pos.quantity * price;
        const pnl = amount - (pos.quantity * pos.entryPrice);

        portfolio.capital += amount;
        portfolio.positions.splice(posIdx, 1);

        const trade: Trade = {
          id: `T${Date.now()}`,
          coin,
          side: 'SELL',
          price,
          quantity: pos.quantity,
          total: amount,
          timestamp: Date.now(),
          reason: signal.reasons.join('; '),
          indicators: signal.indicators.map(i => i.name),
        };
        portfolio.trades.push(trade);

        newTrades.push({
          action: 'SELL',
          coin,
          amount: pos.quantity,
          price,
          signal: signal.reasons.join(' + '),
          pnl,
        });

        log('trade', `AUTO SELL ${pos.quantity.toFixed(6)} ${coin} @ €${price.toFixed(2)} = €${amount.toFixed(2)}, PnL: €${pnl.toFixed(2)}`);
      }

      // Rate limit between coins
      await new Promise(r => setTimeout(r, 1500));
    } catch (e: any) {
      log('error', `Error analyzing ${coin}: ${e.message}`);
      errors.push(`${coin}: ${e.message}`);
    }
  }

  // Update portfolio totals
  const positionsValue = portfolio.positions.reduce(
    (sum, pos) => sum + (pos.quantity * (pos.currentPrice || pos.entryPrice)), 0
  );
  const totalValue = portfolio.capital + positionsValue;
  portfolio.totalPnl = totalValue - portfolio.initialCapital;
  portfolio.totalPnlPercent = (portfolio.totalPnl / portfolio.initialCapital) * 100;
  portfolio.lastUpdated = Date.now();

  // Persist
  savePortfolio(portfolio);

  log('info', `=== AUTO-TRADE END === trades=${newTrades.length}, capital=€${portfolio.capital.toFixed(2)}, pnl=€${portfolio.totalPnl.toFixed(2)}`);

  return {
    new_trades: newTrades,
    portfolio: {
      capital: portfolio.capital,
      positions: portfolio.positions.length,
      pnl: portfolio.totalPnl,
      pnl_pct: portfolio.totalPnlPercent,
      total_value: totalValue,
    },
    errors,
    timestamp: new Date().toISOString(),
  };
}
