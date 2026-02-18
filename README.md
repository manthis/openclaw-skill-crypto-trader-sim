# 🪙 crypto-trader-sim

> **⚠️ EDUCATIONAL SIMULATOR ONLY — NOT FINANCIAL ADVICE**
>
> This tool uses VIRTUAL money to simulate trading. Do NOT use its signals to make real trading decisions. Crypto markets are extremely volatile and you can lose 100% of your investment.

## Overview

An educational crypto trading simulator for OpenClaw that lets you test trading strategies with virtual capital. Analyze technical indicators, backtest strategies on historical data, and track a virtual portfolio — all without risking real money.

## Features

- 📊 **Technical Indicators**: RSI, MACD, Bollinger Bands, Moving Averages, Volume
- 🎯 **3 Strategies**: Conservative, Balanced, Aggressive
- 📈 **Backtesting**: Simulate on historical data (CoinGecko)
- 💰 **Portfolio Tracking**: Virtual positions, PnL, trade history
- 📡 **Live Signals**: BUY/SELL/HOLD with scoring and reasons
- 🔌 **Multiple APIs**: CoinGecko (free), TAAPI.IO (optional), CoinAPI (optional)

## Installation

```bash
# Clone into OpenClaw skills
cd ~/.openclaw/workspace/skills/
git clone https://github.com/manthis/openclaw-skill-crypto-trader-sim.git crypto-trader-sim

# Install & build
cd crypto-trader-sim
npm install
npm run build

# Make CLI executable
chmod +x crypto-trader-sim.sh
```

## Usage

### Backtest Simulation
```bash
./crypto-trader-sim.sh --simulate 30d --strategy conservative --capital 100 --coins BTC,ETH,SOL
```

### Current Signals
```bash
./crypto-trader-sim.sh --signals --coins BTC,ETH,SOL --strategy balanced
```

### Market Analysis
```bash
./crypto-trader-sim.sh --analyze --coins BTC --strategy aggressive
```

### View Portfolio
```bash
./crypto-trader-sim.sh --portfolio
```

## Strategies

| Strategy | Buy Threshold | Max Position | Stop Loss | Take Profit | Description |
|----------|:---:|:---:|:---:|:---:|---|
| Conservative | 60 | 20% | 5% | 10% | Needs strong consensus from all 5 indicators |
| Balanced | 40 | 33% | 8% | 15% | Moderate, uses 4 indicators |
| Aggressive | 25 | 50% | 12% | 25% | Fewer confirmations, bigger swings |

## Indicators

| Indicator | Signal Logic |
|-----------|-------------|
| **RSI** | <30 = oversold (BUY), >70 = overbought (SELL) |
| **MACD** | Histogram crossover = signal, momentum direction |
| **Bollinger Bands** | %B <0 = below band (BUY), >1 = above (SELL) |
| **Moving Averages** | Price vs SMA20/SMA50 alignment |
| **Volume** | Above-average volume confirms price moves |

## Configuration

Copy `config.env.example` to `config.env`:

```bash
cp config.env.example config.env
```

API keys are **optional**. Without them, the tool uses CoinGecko free tier for price data and computes indicators locally.

## Example Backtest Output

```
╔══════════════════════════════════════════════════╗
║  📈 SIMULATION RESULTS                           ║
╚══════════════════════════════════════════════════╝

📋 Configuration:
  • Stratégie:     CONSERVATIVE
  • Capital:       €100
  • Coins:         BTC, ETH, SOL
  • Période:       30 jours

📊 Résultats:
  ✅ Rendement:     €7.42 (+7.4%)
  📉 Max drawdown:  3.2%
  🎯 Win rate:      66.7%
  🔄 Total trades:  6

⚠️ RAPPEL: Ceci est une SIMULATION éducative. Pas de conseil financier.
```

## Architecture

```
crypto-trader-sim/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── types.ts           # TypeScript types
│   ├── simulator.ts       # Backtesting engine
│   ├── portfolio.ts       # Portfolio management
│   ├── strategies/
│   │   └── strategies.ts  # Strategy definitions & scoring
│   ├── indicators/
│   │   └── technical.ts   # RSI, MACD, BB, MA, Volume
│   ├── api/
│   │   ├── coingecko.ts   # CoinGecko price data
│   │   └── taapi.ts       # TAAPI.IO indicators
│   └── utils/
│       └── logger.ts      # Logging system
├── state/                 # Portfolio & simulation state
├── logs/                  # Debug logs
├── crypto-trader-sim.sh   # Bash CLI wrapper
├── config.env.example     # API keys template
├── SKILL.md              # OpenClaw skill doc
└── README.md
```

## License

MIT

## Disclaimer

⚠️ **This software is for EDUCATIONAL purposes ONLY.** It simulates trading with virtual money and does NOT connect to any real exchange. The signals, indicators, and results produced by this tool should NOT be used to make real financial decisions. Cryptocurrency trading involves substantial risk of loss. Past simulated performance does not guarantee future results.

---

*Made with ❤️ for learning about trading strategies — not for actual trading.*
