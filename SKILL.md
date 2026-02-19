# crypto-trader-sim — Educational Crypto Trading Simulator

⚠️ **DISCLAIMER: This is an EDUCATIONAL tool only. NOT financial advice. Uses VIRTUAL money.**

## What it does
Simulates crypto trading strategies with virtual capital (default €100) using technical indicators.
Backtests strategies on historical data to see hypothetical gains/losses.

## Quick Start
```bash
# Simulate 30 days with conservative strategy
./crypto-trader-sim.sh --simulate 30d --strategy conservative --capital 100 --coins BTC,ETH,SOL

# Current signals
./crypto-trader-sim.sh --signals --coins BTC,ETH,SOL

# Analyze market
./crypto-trader-sim.sh --analyze --coins BTC --strategy balanced

# Auto-trade mode (for heartbeat — outputs JSON)
./crypto-trader-sim.sh --auto-trade --coins BTC,ETH,SOL --strategy balanced

# View portfolio
./crypto-trader-sim.sh --portfolio
```

## Auto-Trade Mode (Heartbeat)
The `--auto-trade` flag is designed for automated heartbeat execution:
- Loads portfolio from `state/portfolio.json`
- Fetches real-time market data & computes indicators
- Executes BUY/SELL trades automatically based on strategy signals
- Checks stop-loss / take-profit on existing positions
- Persists updated portfolio to `state/portfolio.json`
- Outputs JSON with trades executed and portfolio summary
- Logs to `logs/auto-trade-YYYY-MM-DD.log`

**Safety rules:**
- No double-trade on same coin (skip if already holding)
- Keeps €10 capital reserve minimum
- Position sizing respects strategy limits (5-50% depending on strategy)
- Stop-loss and take-profit auto-triggered

## Strategies
- **conservative** — Needs strong consensus, small positions (20% max), tight stop-loss (5%)
- **balanced** — Moderate positions (33%), medium thresholds
- **aggressive** — Fewer confirmations, large positions (50%), wide stops (12%)

## Indicators
RSI, MACD, Bollinger Bands, Moving Averages, Volume analysis

## APIs (optional)
- CoinGecko (free, no key needed) — prices & historical data
- TAAPI.IO (free tier, key in config.env) — server-side indicators
- Copy `config.env.example` → `config.env` and add keys

## Files
- `state/portfolio.json` — Virtual portfolio state
- `state/last-simulation.json` — Last backtest results
- `logs/` — Detailed strategy debug logs
