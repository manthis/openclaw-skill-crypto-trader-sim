#!/usr/bin/env node
/**
 * crypto-trader-sim — Educational Crypto Trading Simulator
 * ⚠️ DISCLAIMER: NOT financial advice. Simulation with VIRTUAL money only.
 */

import * as path from 'path';
import * as fs from 'fs';
import { SimulationConfig, StrategyName } from './types';
import { STRATEGIES, analyzeIndicators, computeSignal } from './strategies/strategies';
import { getMarketChart, getPrices } from './api/coingecko';
import { loadPortfolio, savePortfolio, executeTrade, formatPortfolio } from './portfolio';
import { runSimulation, formatResult } from './simulator';
import { log, setVerbose, setLogFile } from './utils/logger';
import { runAutoTrade } from './auto-trader';

// Load config.env if present
const envFile = path.join(__dirname, '../config.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      result[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    }
  }
  return result;
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════╗
║  🪙 crypto-trader-sim — Crypto Trading Simulator ║
║  ⚠️ EDUCATIONAL ONLY — NOT FINANCIAL ADVICE      ║
╚══════════════════════════════════════════════════╝

Usage:
  crypto-trader-sim --simulate <days>d --strategy <name> --capital <eur> --coins <list>
  crypto-trader-sim --analyze --coins <list> [--strategy <name>]
  crypto-trader-sim --auto-trade --coins <list> [--strategy <name>]
  crypto-trader-sim --portfolio
  crypto-trader-sim --signals --coins <list>

Commands:
  --simulate <N>d   Run backtest simulation over N days
  --analyze         Analyze current market conditions
  --auto-trade      Auto-trade mode (for heartbeat): analyze & execute trades
  --signals         Show current BUY/SELL/HOLD signals
  --portfolio       Show current virtual portfolio

Options:
  --strategy <name>  conservative | balanced | aggressive (default: balanced)
  --capital <eur>    Initial virtual capital in EUR (default: 100)
  --coins <list>     Comma-separated: BTC,ETH,SOL (default: BTC,ETH)
  --verbose          Detailed debug logging
  --help             Show this help

Strategies:
  conservative  Low risk — needs strong consensus, small positions, tight stops
  balanced      Medium risk — balanced indicators, moderate positions
  aggressive    High risk — fewer confirmations needed, larger positions

Examples:
  crypto-trader-sim --simulate 30d --strategy conservative --capital 100 --coins BTC,ETH,SOL
  crypto-trader-sim --analyze --coins BTC,ETH --strategy balanced
  crypto-trader-sim --signals --coins BTC,SOL
  crypto-trader-sim --auto-trade --coins BTC,ETH,SOL --strategy balanced
  crypto-trader-sim --portfolio

⚠️ This is a SIMULATION with virtual money. NOT financial advice.
`);
}

async function cmdAnalyze(coins: string[], strategyName: StrategyName) {
  const strategy = STRATEGIES[strategyName];
  console.log(`\n🔍 Analyzing ${coins.join(', ')} with ${strategyName} strategy...\n`);

  for (const coin of coins) {
    try {
      const candles = await getMarketChart(coin, 30);
      const price = candles[candles.length - 1].close;
      const indicators = analyzeIndicators(candles.slice(-60), strategy);
      const signal = computeSignal(coin, price, indicators, strategy);

      const icon = signal.signal === 'BUY' ? '🟢' : signal.signal === 'SELL' ? '🔴' : '⚪';
      console.log(`${icon} ${coin} @ €${price.toFixed(2)} — ${signal.signal} (score: ${signal.score})`);
      console.log(`  Raisons:`);
      for (const reason of signal.reasons) {
        console.log(`    • ${reason}`);
      }
      console.log();

      await new Promise(r => setTimeout(r, 1500)); // rate limit
    } catch (e: any) {
      console.error(`  ❌ Error analyzing ${coin}: ${e.message}`);
    }
  }
  console.log('⚠️ RAPPEL: Simulation éducative uniquement. Pas de conseil financier.');
}

async function cmdSignals(coins: string[], strategyName: StrategyName) {
  const strategy = STRATEGIES[strategyName];
  console.log(`\n📡 Current signals (${strategyName}):\n`);

  for (const coin of coins) {
    try {
      const candles = await getMarketChart(coin, 14);
      const price = candles[candles.length - 1].close;
      const indicators = analyzeIndicators(candles.slice(-60), strategy);
      const signal = computeSignal(coin, price, indicators, strategy);

      const icon = signal.signal === 'BUY' ? '🟢 BUY ' : signal.signal === 'SELL' ? '🔴 SELL' : '⚪ HOLD';
      console.log(`  ${icon}  ${coin.padEnd(5)} €${price.toFixed(2).padStart(10)}  score: ${String(signal.score).padStart(4)}`);

      await new Promise(r => setTimeout(r, 1500));
    } catch (e: any) {
      console.error(`  ❌ ${coin}: ${e.message}`);
    }
  }
  console.log('\n⚠️ NOT financial advice. Educational only.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    printHelp();
    return;
  }

  if (args.verbose) setVerbose(true);
  setLogFile(`sim-${new Date().toISOString().slice(0, 10)}.log`);

  const strategyName = (args.strategy || 'balanced') as StrategyName;
  if (!STRATEGIES[strategyName]) {
    console.error(`❌ Unknown strategy: ${strategyName}. Use: conservative, balanced, aggressive`);
    process.exit(1);
  }

  const coins = (args.coins || 'BTC,ETH').split(',').map(c => c.trim().toUpperCase());
  const capital = parseFloat(args.capital || '100');

  if (args.simulate) {
    const days = parseInt(args.simulate.replace('d', ''));
    if (isNaN(days) || days < 1) {
      console.error('❌ Invalid duration. Use: --simulate 30d');
      process.exit(1);
    }

    const config: SimulationConfig = {
      strategy: strategyName,
      initialCapital: capital,
      coins,
      durationDays: days,
      interval: '4h',
    };

    const result = await runSimulation(config);
    console.log(formatResult(result));

    // Save state
    savePortfolio(result.portfolio);
    const resultFile = path.join(__dirname, '../state/last-simulation.json');
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    log('info', `Results saved to ${resultFile}`);
  }

  else if (args['auto-trade']) {
    const result = await runAutoTrade(coins, strategyName, capital);
    // Output JSON for wrapper/heartbeat consumption
    console.log(JSON.stringify(result, null, 2));
  }

  else if (args.analyze) {
    await cmdAnalyze(coins, strategyName);
  }

  else if (args.signals) {
    await cmdSignals(coins, strategyName);
  }

  else if (args.portfolio) {
    const portfolio = loadPortfolio(capital);
    // Update prices
    try {
      const prices = await getPrices(portfolio.positions.map(p => p.coin));
      for (const pos of portfolio.positions) {
        pos.currentPrice = prices[pos.coin] || pos.entryPrice;
        pos.pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
        pos.pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      }
    } catch (e) {
      log('warn', 'Could not update prices');
    }
    console.log(formatPortfolio(portfolio));
  }

  else {
    printHelp();
  }
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.message}`);
  log('error', e.message, e.stack);
  process.exit(1);
});
