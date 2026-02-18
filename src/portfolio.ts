/**
 * Portfolio management — virtual capital tracking
 * ⚠️ EDUCATIONAL SIMULATOR — NOT REAL MONEY
 */

import * as fs from 'fs';
import * as path from 'path';
import { Portfolio, Position, Trade, TradeSignal, StrategyConfig } from './types';
import { log } from './utils/logger';

const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '../state');
const STATE_FILE = path.join(STATE_DIR, 'portfolio.json');

export function loadPortfolio(initialCapital: number): Portfolio {
  if (fs.existsSync(STATE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    log('info', `Loaded portfolio: €${data.capital.toFixed(2)} capital, ${data.positions.length} positions`);
    return data;
  }
  return {
    capital: initialCapital,
    initialCapital,
    positions: [],
    trades: [],
    totalPnl: 0,
    totalPnlPercent: 0,
    lastUpdated: Date.now(),
  };
}

export function savePortfolio(portfolio: Portfolio) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(portfolio, null, 2));
  log('info', 'Portfolio saved');
}

export function executeTrade(portfolio: Portfolio, signal: TradeSignal, strategy: StrategyConfig): Portfolio {
  const p = { ...portfolio, positions: [...portfolio.positions], trades: [...portfolio.trades] };

  if (signal.signal === 'BUY') {
    // Check if already have position
    if (p.positions.find(pos => pos.coin === signal.coin)) {
      log('trade', `Already have position in ${signal.coin}, skipping BUY`);
      return p;
    }

    const maxAmount = p.capital * (strategy.maxPositionPct / 100);
    const amount = Math.min(maxAmount, p.capital * 0.95); // Keep 5% reserve
    if (amount < 1) {
      log('trade', `Insufficient capital (€${p.capital.toFixed(2)}) for ${signal.coin}`);
      return p;
    }

    const quantity = amount / signal.price;
    p.capital -= amount;
    p.positions.push({
      coin: signal.coin,
      entryPrice: signal.price,
      quantity,
      entryTime: signal.timestamp,
    });

    const trade: Trade = {
      id: `T${Date.now()}`,
      coin: signal.coin,
      side: 'BUY',
      price: signal.price,
      quantity,
      total: amount,
      timestamp: signal.timestamp,
      reason: signal.reasons.join('; '),
      indicators: signal.indicators.map(i => i.name),
    };
    p.trades.push(trade);
    log('trade', `BUY ${quantity.toFixed(6)} ${signal.coin} @ €${signal.price.toFixed(2)} = €${amount.toFixed(2)}`);
  }

  if (signal.signal === 'SELL') {
    const posIdx = p.positions.findIndex(pos => pos.coin === signal.coin);
    if (posIdx === -1) {
      log('trade', `No position in ${signal.coin}, skipping SELL`);
      return p;
    }

    const pos = p.positions[posIdx];
    const amount = pos.quantity * signal.price;
    const pnl = amount - (pos.quantity * pos.entryPrice);
    p.capital += amount;
    p.positions.splice(posIdx, 1);

    const trade: Trade = {
      id: `T${Date.now()}`,
      coin: signal.coin,
      side: 'SELL',
      price: signal.price,
      quantity: pos.quantity,
      total: amount,
      timestamp: signal.timestamp,
      reason: signal.reasons.join('; '),
      indicators: signal.indicators.map(i => i.name),
    };
    p.trades.push(trade);
    log('trade', `SELL ${pos.quantity.toFixed(6)} ${signal.coin} @ €${signal.price.toFixed(2)} = €${amount.toFixed(2)} (PnL: €${pnl.toFixed(2)})`);
  }

  // Check stop-loss / take-profit for existing positions
  for (let i = p.positions.length - 1; i >= 0; i--) {
    const pos = p.positions[i];
    if (pos.currentPrice) {
      const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      if (pnlPct <= -strategy.stopLossPct) {
        log('trade', `STOP LOSS triggered for ${pos.coin} (${pnlPct.toFixed(1)}%)`);
        const amount = pos.quantity * pos.currentPrice;
        p.capital += amount;
        p.trades.push({
          id: `T${Date.now()}`, coin: pos.coin, side: 'SELL', price: pos.currentPrice,
          quantity: pos.quantity, total: amount, timestamp: Date.now(),
          reason: `Stop-loss at ${pnlPct.toFixed(1)}%`, indicators: [],
        });
        p.positions.splice(i, 1);
      } else if (pnlPct >= strategy.takeProfitPct) {
        log('trade', `TAKE PROFIT triggered for ${pos.coin} (${pnlPct.toFixed(1)}%)`);
        const amount = pos.quantity * pos.currentPrice;
        p.capital += amount;
        p.trades.push({
          id: `T${Date.now()}`, coin: pos.coin, side: 'SELL', price: pos.currentPrice,
          quantity: pos.quantity, total: amount, timestamp: Date.now(),
          reason: `Take-profit at ${pnlPct.toFixed(1)}%`, indicators: [],
        });
        p.positions.splice(i, 1);
      }
    }
  }

  // Update totals
  const positionsValue = p.positions.reduce((sum, pos) => sum + (pos.quantity * (pos.currentPrice || pos.entryPrice)), 0);
  const totalValue = p.capital + positionsValue;
  p.totalPnl = totalValue - p.initialCapital;
  p.totalPnlPercent = (p.totalPnl / p.initialCapital) * 100;
  p.lastUpdated = Date.now();

  return p;
}

export function formatPortfolio(portfolio: Portfolio): string {
  const posValue = portfolio.positions.reduce((sum, pos) =>
    sum + (pos.quantity * (pos.currentPrice || pos.entryPrice)), 0);
  const totalValue = portfolio.capital + posValue;

  let output = `
╔══════════════════════════════════════════════════╗
║  📊 PORTFOLIO — SIMULATION ÉDUCATIVE             ║
║  ⚠️ NOT FINANCIAL ADVICE                         ║
╚══════════════════════════════════════════════════╝

💰 Capital disponible:  €${portfolio.capital.toFixed(2)}
📦 Valeur positions:    €${posValue.toFixed(2)}
📈 Valeur totale:       €${totalValue.toFixed(2)}
🎯 Capital initial:     €${portfolio.initialCapital.toFixed(2)}
${portfolio.totalPnl >= 0 ? '✅' : '❌'} PnL:                 €${portfolio.totalPnl.toFixed(2)} (${portfolio.totalPnlPercent.toFixed(1)}%)
📊 Total trades:        ${portfolio.trades.length}
`;

  if (portfolio.positions.length > 0) {
    output += '\n📦 Positions ouvertes:\n';
    for (const pos of portfolio.positions) {
      const pnl = pos.currentPrice ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
      output += `  • ${pos.coin}: ${pos.quantity.toFixed(6)} @ €${pos.entryPrice.toFixed(2)}`;
      if (pos.currentPrice) output += ` → €${pos.currentPrice.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%)`;
      output += '\n';
    }
  }

  if (portfolio.trades.length > 0) {
    output += `\n📜 Derniers trades (${Math.min(5, portfolio.trades.length)} récents):\n`;
    for (const trade of portfolio.trades.slice(-5)) {
      const icon = trade.side === 'BUY' ? '🟢' : '🔴';
      const date = new Date(trade.timestamp).toLocaleDateString('fr-FR');
      output += `  ${icon} ${date} ${trade.side} ${trade.quantity.toFixed(6)} ${trade.coin} @ €${trade.price.toFixed(2)} (€${trade.total.toFixed(2)})\n`;
    }
  }

  return output;
}
