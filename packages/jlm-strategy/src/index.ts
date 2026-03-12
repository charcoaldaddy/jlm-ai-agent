/**
 * JLM AI Agent - Strategy Library
 * 
 * Comprehensive trading strategies for Crypto, Forex, Metals, Stocks, and Prediction Markets
 */

import { EventEmitter } from 'events';

// ==================== BASE STRATEGY INTERFACE ====================

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  maxPositionSize: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Signal {
  type: 'buy' | 'sell' | 'close';
  strength: number; // 0-1
  price: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  openedAt: number;
}

// ==================== TREND FOLLOWING STRATEGIES ====================

export class TrendFollowingStrategy extends EventEmitter {
  private config: StrategyConfig;
  private emaShort: number = 12;
  private emaLong: number = 26;
  private candles: CandleData[] = [];

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
  }

  /**
   * Add candle data point
   */
  addCandle(candle: CandleData): void {
    this.candles.push(candle);
    if (this.candles.length > 100) {
      this.candles.shift();
    }
  }

  /**
   * Calculate EMA
   */
  calculateEMA(period: number): number {
    if (this.candles.length < period) return 0;
    
    const prices = this.candles.slice(-period).map(c => c.close);
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Generate trading signal
   */
  generateSignal(): Signal | null {
    if (this.candles.length < this.emaLong + 1) return null;
    
    const emaShort = this.calculateEMA(this.emaShort);
    const emaLong = this.calculateEMA(this.emaLong);
    
    if (emaShort > emaLong) {
      return {
        type: 'buy',
        strength: Math.min((emaShort - emaLong) / emaLong, 1),
        price: this.candles[this.candles.length - 1].close,
        timestamp: Date.now(),
      };
    } else if (emaShort < emaLong) {
      return {
        type: 'sell',
        strength: Math.min((emaLong - emaShort) / emaLong, 1),
        price: this.candles[this.candles.length - 1].close,
        timestamp: Date.now(),
      };
    }
    
    return null;
  }
}

// ==================== MEAN REVERSION STRATEGY ====================

export class MeanReversionStrategy extends EventEmitter {
  private config: StrategyConfig;
  private lookbackPeriod: number = 20;
  private stdDevMultiplier: number = 2;
  private prices: number[] = [];

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
  }

  /**
   * Add price data point
   */
  addPrice(price: number): void {
    this.prices.push(price);
    if (this.prices.length > 100) {
      this.prices.shift();
    }
  }

  /**
   * Calculate mean and standard deviation
   */
  calculateStats(): { mean: number; stdDev: number; upper: number; lower: number } {
    const data = this.prices.slice(-this.lookbackPeriod);
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean,
      stdDev,
      upper: mean + stdDev * this.stdDevMultiplier,
      lower: mean - stdDev * this.stdDevMultiplier,
    };
  }

  /**
   * Generate trading signal
   */
  generateSignal(currentPrice: number): Signal | null {
    if (this.prices.length < this.lookbackPeriod) return null;
    
    const { mean, upper, lower } = this.calculateStats();
    
    if (currentPrice < lower) {
      return {
        type: 'buy',
        strength: Math.min(Math.abs(currentPrice - mean) / mean, 1),
        price: currentPrice,
        timestamp: Date.now(),
        metadata: { mean, distance: (mean - currentPrice) / mean },
      };
    } else if (currentPrice > upper) {
      return {
        type: 'sell',
        strength: Math.min(Math.abs(currentPrice - mean) / mean, 1),
        price: currentPrice,
        timestamp: Date.now(),
        metadata: { mean, distance: (currentPrice - mean) / mean },
      };
    }
    
    return null;
  }
}

// ==================== ARBITRAGE STRATEGY ====================

export class ArbitrageStrategy extends EventEmitter {
  private config: StrategyConfig;
  private minSpread: number = 0.001; // 0.1%
  private opportunities: ArbitrageOpportunity[] = [];

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
  }

  /**
   * Check for arbitrage opportunities
   */
  checkArbitrage(
    exchange1Price: number,
    exchange2Price: number,
    symbol: string
  ): ArbitrageOpportunity | null {
    const spread = Math.abs(exchange1Price - exchange2Price) / Math.min(exchange1Price, exchange2Price);
    
    if (spread >= this.minSpread) {
      const opportunity: ArbitrageOpportunity = {
        id: `ARB-${Date.now()}`,
        symbol,
        exchange1: 'exchange1',
        exchange2: 'exchange2',
        buyExchange: exchange1Price < exchange2Price ? 'exchange1' : 'exchange2',
        sellExchange: exchange1Price < exchange2Price ? 'exchange2' : 'exchange1',
        buyPrice: Math.min(exchange1Price, exchange2Price),
        sellPrice: Math.max(exchange1Price, exchange2Price),
        spread,
        estimatedProfit: spread - 0.001, // After fees
        timestamp: Date.now(),
      };
      
      this.opportunities.push(opportunity);
      this.emit('opportunity', opportunity);
      
      return opportunity;
    }
    
    return null;
  }
}

export interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  exchange1: string;
  exchange2: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  estimatedProfit: number;
  timestamp: number;
}

// ==================== GLOBAL MACRO STRATEGY ====================

export class GlobalMacroStrategy extends EventEmitter {
  private config: StrategyConfig;
  private correlationAssets: Map<string, number> = new Map();

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
  }

  /**
   * Update DXY correlation
   */
  updateDXY(dxyIndex: number): void {
    this.correlationAssets.set('DXY', dxyIndex);
  }

  /**
   * Update Gold correlation
   */
  updateGold(goldPrice: number): void {
    this.correlationAssets.set('XAUUSD', goldPrice);
  }

  /**
   * Update Bitcoin correlation
   */
  updateBitcoin(btcPrice: number): void {
    this.correlationAssets.set('BTC', btcPrice);
  }

  /**
   * Generate macro-based signals
   */
  generateSignal(): Signal | null {
    const dxy = this.correlationAssets.get('DXY');
    const gold = this.correlationAssets.get('XAUUSD');
    const btc = this.correlationAssets.get('BTC');
    
    if (!dxy || !gold || !btc) return null;
    
    // DXY negatively correlated with Gold
    // When DXY rises, Gold tends to fall
    // When DXY falls, Gold tends to rise
    
    // Example: Long BTC / Short Gold when DXY is weakening
    if (dxy < 104 && btc > 45000) {
      return {
        type: 'buy',
        strength: 0.7,
        price: btc,
        timestamp: Date.now(),
        metadata: {
          rationale: 'DXY weakening, expect BTC strength',
          dxy,
          gold,
        },
      };
    }
    
    return null;
  }
}

// ==================== PAIRS TRADING STRATEGY ====================

export class PairsTradingStrategy extends EventEmitter {
  private config: StrategyConfig;
  private pair: [string, string];
  private spreadHistory: number[] = [];
  private lookback: number = 30;

  constructor(config: StrategyConfig, pair: [string, string]) {
    super();
    this.config = config;
    this.pair = pair;
  }

  /**
   * Update spread
   */
  updateSpread(price1: number, price2: number): void {
    const spread = price1 / price2;
    this.spreadHistory.push(spread);
    if (this.spreadHistory.length > 100) {
      this.spreadHistory.shift();
    }
  }

  /**
   * Calculate spread statistics
   */
  calculateStats(): { mean: number; zScore: number } {
    const recent = this.spreadHistory.slice(-this.lookback);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    const currentSpread = this.spreadHistory[this.spreadHistory.length - 1];
    const stdDev = Math.sqrt(
      recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length
    );
    
    const zScore = (currentSpread - mean) / stdDev;
    
    return { mean, zScore };
  }

  /**
   * Generate pairs trading signal
   */
  generateSignal(price1: number, price2: number): Signal | null {
    if (this.spreadHistory.length < this.lookback) return null;
    
    this.updateSpread(price1, price2);
    const { zScore } = this.calculateStats();
    
    // Enter when z-score > 2 (spread too wide)
    // Exit when z-score returns to 0
    if (zScore > 2) {
      return {
        type: 'sell', // Short the spread (short price1, long price2)
        strength: Math.min(Math.abs(zScore) / 3, 1),
        price: price1,
        timestamp: Date.now(),
        metadata: { zScore, pair: this.pair },
      };
    } else if (zScore < -2) {
      return {
        type: 'buy', // Long the spread (long price1, short price2)
        strength: Math.min(Math.abs(zScore) / 3, 1),
        price: price1,
        timestamp: Date.now(),
        metadata: { zScore, pair: this.pair },
      };
    }
    
    return null;
  }
}

// ==================== EVENT-DRIVEN POLYMARKET STRATEGY ====================

export class EventDrivenPolymarketStrategy extends EventEmitter {
  private config: StrategyConfig;

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
  }

  /**
   * Analyze market vs sentiment
   */
  analyzeMarket(
    currentProbability: number,
    sentimentScore: number // -1 to 1
  ): Signal | null {
    // If sentiment strongly suggests outcome but market hasn't moved
    // There's potential for value
    
    const expectedProbability = (sentimentScore + 1) / 2; // Convert -1..1 to 0..1
    
    const diff = expectedProbability - currentProbability;
    
    if (Math.abs(diff) > 0.2) {
      return {
        type: diff > 0 ? 'buy' : 'sell',
        strength: Math.abs(diff),
        price: currentProbability,
        timestamp: Date.now(),
        metadata: {
          expectedProbability,
          sentimentScore,
          edge: diff,
        },
      };
    }
    
    return null;
  }

  /**
   * Check for news-driven opportunities
   */
  analyzeNewsImpact(
    headline: string,
    currentProbability: number
  ): Signal | null {
    // Simple keyword-based sentiment
    const positiveWords = ['approve', 'bullish', 'growth', 'rally', 'surge', 'gain', 'win', 'success'];
    const negativeWords = ['crash', 'bearish', 'decline', 'fall', 'lose', 'fail', 'ban', 'lawsuit'];
    
    const lower = headline.toLowerCase();
    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negCount = negativeWords.filter(w => lower.includes(w)).length;
    
    if (posCount > negCount) {
      return {
        type: 'buy',
        strength: Math.min(posCount / 3, 1),
        price: currentProbability,
        timestamp: Date.now(),
        metadata: { headline, sentiment: 'positive' },
      };
    } else if (negCount > posCount) {
      return {
        type: 'sell',
        strength: Math.min(negCount / 3, 1),
        price: currentProbability,
        timestamp: Date.now(),
        metadata: { headline, sentiment: 'negative' },
      };
    }
    
    return null;
  }
}

// ==================== GRID TRADING STRATEGY ====================

export class GridTradingStrategy extends EventEmitter {
  private config: StrategyConfig;
  private gridLevels: GridLevel[] = [];
  private basePrice: number = 0;
  private gridSpacing: number = 0.01; // 1%
  private gridCount: number = 10;
  private activeOrders: GridOrder[] = [];

  constructor(config: StrategyConfig, basePrice: number, gridCount: number = 10) {
    super();
    this.config = config;
    this.basePrice = basePrice;
    this.gridCount = gridCount;
    this.generateGrid();
  }

  /**
   * Generate grid levels
   */
  private generateGrid(): void {
    const range = this.gridSpacing * this.gridCount;
    const start = this.basePrice * (1 - range);
    const step = (this.basePrice * 2 * range) / this.gridCount;
    
    for (let i = 0; i <= this.gridCount; i++) {
      this.gridLevels.push({
        level: i,
        price: start + i * step,
        type: i < this.gridCount / 2 ? 'buy' : 'sell',
        filled: false,
      });
    }
  }

  /**
   * Check current price and generate signals
   */
  checkGrid(currentPrice: number): Signal[] {
    const signals: Signal[] = [];
    
    for (const level of this.gridLevels) {
      const triggerPrice = level.type === 'buy' 
        ? level.price * 0.999 // Buy slightly below
        : level.price * 1.001; // Sell slightly above
      
      if (!level.filled) {
        if (level.type === 'buy' && currentPrice <= triggerPrice) {
          signals.push({
            type: 'buy',
            strength: 1,
            price: level.price,
            timestamp: Date.now(),
            metadata: { gridLevel: level.level },
          });
          level.filled = true;
        } else if (level.type === 'sell' && currentPrice >= triggerPrice) {
          signals.push({
            type: 'sell',
            strength: 1,
            price: level.price,
            timestamp: Date.now(),
            metadata: { gridLevel: level.level },
          });
          level.filled = true;
        }
      }
    }
    
    return signals;
  }
}

export interface GridLevel {
  level: number;
  price: number;
  type: 'buy' | 'sell';
  filled: boolean;
}

export interface GridOrder {
  level: number;
  price: number;
  type: 'buy' | 'sell';
  filled: boolean;
  filledAt?: number;
}

// ==================== DATA TYPES ====================

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

// ==================== STRATEGY FACTORY ====================

export class StrategyFactory {
  /**
   * Create trend following strategy
   */
  static createTrendFollowing(config: StrategyConfig): TrendFollowingStrategy {
    return new TrendFollowingStrategy(config);
  }

  /**
   * Create mean reversion strategy
   */
  static createMeanReversion(config: StrategyConfig): MeanReversionStrategy {
    return new MeanReversionStrategy(config);
  }

  /**
   * Create arbitrage strategy
   */
  static createArbitrage(config: StrategyConfig): ArbitrageStrategy {
    return new ArbitrageStrategy(config);
  }

  /**
   * Create global macro strategy
   */
  static createGlobalMacro(config: StrategyConfig): GlobalMacroStrategy {
    return new GlobalMacroStrategy(config);
  }

  /**
   * Create pairs trading strategy
   */
  static createPairsTrading(config: StrategyConfig, pair: [string, string]): PairsTradingStrategy {
    return new PairsTradingStrategy(config, pair);
  }

  /**
   * Create event-driven Polymarket strategy
   */
  static createEventDrivenPolymarket(config: StrategyConfig): EventDrivenPolymarketStrategy {
    return new EventDrivenPolymarketStrategy(config);
  }

  /**
   * Create grid trading strategy
   */
  static createGridTrading(config: StrategyConfig, basePrice: number, gridCount?: number): GridTradingStrategy {
    return new GridTradingStrategy(config, basePrice, gridCount);
  }
}

export default StrategyFactory;
