/**
 * ⚠️ DISCLAIMER: Educational simulator only. NOT financial advice.
 * Do NOT use signals from this tool to make real trading decisions.
 */

export type Signal = 'BUY' | 'SELL' | 'HOLD';
export type StrategyName = 'conservative' | 'aggressive' | 'balanced';

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  name: string;
  value: number | { [key: string]: number };
  signal: Signal;
  strength: number; // 0-100
  reason: string;
}

export interface TradeSignal {
  coin: string;
  signal: Signal;
  score: number; // -100 (strong sell) to +100 (strong buy)
  reasons: string[];
  indicators: IndicatorResult[];
  timestamp: number;
  price: number;
}

export interface Position {
  coin: string;
  entryPrice: number;
  quantity: number;
  entryTime: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface Trade {
  id: string;
  coin: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  total: number;
  timestamp: number;
  reason: string;
  indicators: string[];
}

export interface Portfolio {
  capital: number;
  initialCapital: number;
  positions: Position[];
  trades: Trade[];
  totalPnl: number;
  totalPnlPercent: number;
  lastUpdated: number;
}

export interface StrategyConfig {
  name: StrategyName;
  description: string;
  indicators: string[];
  buyThreshold: number;   // score above this → BUY
  sellThreshold: number;  // score below this → SELL
  maxPositionPct: number; // max % of capital per position
  stopLossPct: number;    // stop loss %
  takeProfitPct: number;  // take profit %
}

export interface SimulationConfig {
  strategy: StrategyName;
  initialCapital: number;
  coins: string[];
  durationDays: number;
  interval: string; // '1h', '4h', '1d'
}

export interface SimulationResult {
  config: SimulationConfig;
  portfolio: Portfolio;
  signals: TradeSignal[];
  startDate: string;
  endDate: string;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  disclaimer: string;
}
