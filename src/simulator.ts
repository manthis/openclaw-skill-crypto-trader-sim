/**
 * Backtesting simulator — historical simulation with virtual capital
 * ⚠️ DISCLAIMER: EDUCATIONAL ONLY — Past performance does NOT predict future results.
 * This is a SIMULATION with NO real money. NOT financial advice.
 */

import { SimulationConfig, SimulationResult, Portfolio, TradeSignal, OHLCV } from './types';
import { STRATEGIES, analyzeIndicators, computeSignal } from './strategies/strategies';
import { getMarketChart } from './api/coingecko';
import { loadPortfolio, executeTrade, formatPortfolio } from './portfolio';
import { log } from './utils/logger';

const DISCLAIMER = `
⚠️ DISCLAIMER — EDUCATIONAL SIMULATOR ONLY
This is a simulation with VIRTUAL money. Results are hypothetical.
Past simulated performance does NOT guarantee future results.
This tool is NOT financial advice. Do NOT make real trading decisions based on these results.
Crypto markets are extremely volatile and you can lose 100% of your investment.
`;

export async function runSimulation(config: SimulationConfig): Promise<SimulationResult> {
  log('info', `Starting simulation: ${config.strategy} strategy, €${config.initialCapital} capital, ${config.coins.join(',')} for ${config.durationDays}d`);
  console.log(DISCLAIMER);

  const strategy = STRATEGIES[config.strategy];
  let portfolio = loadPortfolio(config.initialCapital);
  // Reset for fresh simulation
  portfolio = {
    capital: config.initialCapital,
    initialCapital: config.initialCapital,
    positions: [],
    trades: [],
    totalPnl: 0,
    totalPnlPercent: 0,
    lastUpdated: Date.now(),
  };

  const allSignals: TradeSignal[] = [];
  let maxValue = config.initialCapital;
  let maxDrawdown = 0;

  // Fetch historical data for all coins
  const coinData: Record<string, OHLCV[]> = {};
  for (const coin of config.coins) {
    try {
      coinData[coin] = await getMarketChart(coin, config.durationDays + 30); // extra for indicator warmup
      log('info', `Loaded ${coinData[coin].length} candles for ${coin}`);
      // Rate limit
      await new Promise(r => setTimeout(r, 1500));
    } catch (e: any) {
      log('error', `Failed to fetch ${coin}: ${e.message}`);
      coinData[coin] = [];
    }
  }

  // Determine simulation window
  const minCandles = Math.min(...Object.values(coinData).map(d => d.length));
  if (minCandles < 30) {
    log('error', `Not enough data for simulation (${minCandles} candles)`);
    throw new Error('Insufficient historical data');
  }

  const warmup = 30; // candles needed for indicators
  const startIdx = warmup;
  const endIdx = minCandles;
  const step = Math.max(1, Math.floor((endIdx - startIdx) / (config.durationDays * 6))); // ~6 checks per day

  log('info', `Simulating ${endIdx - startIdx} candles, step=${step}`);

  for (let i = startIdx; i < endIdx; i += step) {
    for (const coin of config.coins) {
      const candles = coinData[coin].slice(0, i + 1);
      if (candles.length < 30) continue;

      const currentPrice = candles[candles.length - 1].close;

      // Update position prices
      for (const pos of portfolio.positions) {
        if (pos.coin === coin) pos.currentPrice = currentPrice;
      }

      // Analyze and generate signal
      const indicators = analyzeIndicators(candles.slice(-60), strategy);
      const signal = computeSignal(coin, currentPrice, indicators, strategy);
      allSignals.push(signal);

      // Execute trades based on signal
      portfolio = executeTrade(portfolio, signal, strategy);
    }

    // Track drawdown
    const posValue = portfolio.positions.reduce((sum, pos) =>
      sum + (pos.quantity * (pos.currentPrice || pos.entryPrice)), 0);
    const totalValue = portfolio.capital + posValue;
    maxValue = Math.max(maxValue, totalValue);
    const drawdown = ((maxValue - totalValue) / maxValue) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Final update
  const posValue = portfolio.positions.reduce((sum, pos) =>
    sum + (pos.quantity * (pos.currentPrice || pos.entryPrice)), 0);
  const totalValue = portfolio.capital + posValue;
  portfolio.totalPnl = totalValue - config.initialCapital;
  portfolio.totalPnlPercent = (portfolio.totalPnl / config.initialCapital) * 100;

  const wins = portfolio.trades.filter((t, i, arr) => {
    if (t.side !== 'SELL') return false;
    const buyTrade = arr.slice(0, i).reverse().find(b => b.coin === t.coin && b.side === 'BUY');
    return buyTrade ? t.price > buyTrade.price : false;
  });
  const sellTrades = portfolio.trades.filter(t => t.side === 'SELL');
  const winRate = sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0;

  const result: SimulationResult = {
    config,
    portfolio,
    signals: allSignals.slice(-20), // keep last 20 signals
    startDate: new Date(Date.now() - config.durationDays * 86400000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    totalReturn: portfolio.totalPnl,
    totalReturnPct: portfolio.totalPnlPercent,
    maxDrawdown,
    winRate,
    totalTrades: portfolio.trades.length,
    disclaimer: DISCLAIMER,
  };

  return result;
}

export function formatResult(result: SimulationResult): string {
  const emoji = result.totalReturn >= 0 ? '📈' : '📉';
  const pnlEmoji = result.totalReturn >= 0 ? '✅' : '❌';

  return `
${DISCLAIMER}
╔══════════════════════════════════════════════════╗
║  ${emoji} SIMULATION RESULTS                         ║
╚══════════════════════════════════════════════════╝

📋 Configuration:
  • Stratégie:     ${result.config.strategy.toUpperCase()}
  • Capital:       €${result.config.initialCapital}
  • Coins:         ${result.config.coins.join(', ')}
  • Période:       ${result.config.durationDays} jours
  • Du:            ${result.startDate} au ${result.endDate}

📊 Résultats:
  ${pnlEmoji} Rendement:     €${result.totalReturn.toFixed(2)} (${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct.toFixed(1)}%)
  📉 Max drawdown:  ${result.maxDrawdown.toFixed(1)}%
  🎯 Win rate:      ${result.winRate.toFixed(1)}%
  🔄 Total trades:  ${result.totalTrades}

${formatPortfolio(result.portfolio)}

📜 Derniers signaux:
${result.signals.slice(-5).map(s => {
  const icon = s.signal === 'BUY' ? '🟢' : s.signal === 'SELL' ? '🔴' : '⚪';
  return `  ${icon} ${s.coin}: ${s.signal} (score: ${s.score}) @ €${s.price.toFixed(2)}`;
}).join('\n')}

⚠️ RAPPEL: Ceci est une SIMULATION éducative. Pas de conseil financier.
`;
}
