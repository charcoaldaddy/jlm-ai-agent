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

// ==================== BREAKOUT STRATEGY ====================

export class BreakoutStrategy extends EventEmitter {
  private config: StrategyConfig;
  private candles: CandleData[] = [];
  private supportLevels: number[] = [];
  private resistanceLevels: number[] = [];
  private lookbackPeriod: number = 20;
  private volumeThreshold: number = 1.5; // Volume must be 1.5x average
  private atrPeriod: number = 14;
  private atr: number = 0;
  private trailingStopPercent: number = 0.02; // 2%

  constructor(config: StrategyConfig, lookbackPeriod: number = 20) {
    super();
    this.config = config;
    this.lookbackPeriod = lookbackPeriod;
  }

  /**
   * Add candle data point
   */
  addCandle(candle: CandleData): void {
    this.candles.push(candle);
    if (this.candles.length > 100) {
      this.candles.shift();
    }
    
    // Update ATR when we have enough data
    if (this.candles.length >= this.atrPeriod + 1) {
      this.calculateATR();
    }
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private calculateATR(): void {
    const periods = this.candles.slice(-this.atrPeriod);
    let atrSum = 0;
    
    for (let i = 1; i < periods.length; i++) {
      const high = periods[i].high;
      const low = periods[i].low;
      const prevClose = periods[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      atrSum += tr;
    }
    
    this.atr = atrSum / this.atrPeriod;
  }

  /**
   * Identify support and resistance levels using pivot points
   */
  private identifyLevels(): { support: number[]; resistance: number[] } {
    const support: number[] = [];
    const resistance: number[] = [];
    
    if (this.candles.length < this.lookbackPeriod) {
      return { support, resistance };
    }

    // Use swing high/low method
    const recentCandles = this.candles.slice(-this.lookbackPeriod);
    
    for (let i = 2; i < recentCandles.length - 2; i++) {
      const prev2 = recentCandles[i - 2];
      const prev1 = recentCandles[i - 1];
      const current = recentCandles[i];
      const next1 = recentCandles[i + 1];
      const next2 = recentCandles[i + 2];
      
      // Resistance (swing high)
      if (
        current.high > prev1.high &&
        current.high > prev2.high &&
        current.high > next1.high &&
        current.high > next2.high
      ) {
        resistance.push(current.high);
      }
      
      // Support (swing low)
      if (
        current.low < prev1.low &&
        current.low < prev2.low &&
        current.low < next1.low &&
        current.low < next2.low
      ) {
        support.push(current.low);
      }
    }

    return { support, resistance };
  }

  /**
   * Get average volume
   */
  private getAverageVolume(): number {
    if (this.candles.length < 20) return 0;
    const recentVolumes = this.candles.slice(-20).map(c => c.volume);
    return recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  }

  /**
   * Check if breakout is confirmed by volume
   */
  private isVolumeConfirmed(): boolean {
    if (this.candles.length < 2) return false;
    const currentVolume = this.candles[this.candles.length - 1].volume;
    const avgVolume = this.getAverageVolume();
    return currentVolume >= avgVolume * this.volumeThreshold;
  }

  /**
   * Get closest support and resistance levels
   */
  private getClosestLevels(currentPrice: number): { closestSupport: number; closestResistance: number } {
    const { support, resistance } = this.identifyLevels();
    
    let closestSupport = 0;
    let closestResistance = 0;
    
    // Find closest support below current price
    for (const level of support) {
      if (level < currentPrice && level > closestSupport) {
        closestSupport = level;
      }
    }
    
    // Find closest resistance above current price
    for (const level of resistance) {
      if (level > currentPrice && (closestResistance === 0 || level < closestResistance)) {
        closestResistance = level;
      }
    }
    
    return { closestSupport, closestResistance };
  }

  /**
   * Generate breakout trading signals
   */
  generateSignal(): BreakoutSignal | null {
    if (this.candles.length < this.lookbackPeriod + 5) return null;
    
    const currentCandle = this.candles[this.candles.length - 1];
    const prevCandle = this.candles[this.candles.length - 2];
    const currentPrice = currentCandle.close;
    
    const { support, resistance } = this.identifyLevels();
    const { closestSupport, closestResistance } = this.getClosestLevels(currentPrice);
    
    // Calculate breakout thresholds
    const breakoutThreshold = this.atr * 0.5; // Half ATR from level
    
    // Check for upside breakout
    if (resistance.length > 0 && closestResistance > 0) {
      const breakoutLevel = closestResistance + breakoutThreshold;
      
      if (currentPrice >= breakoutLevel && this.isVolumeConfirmed()) {
        const distanceToSupport = closestSupport > 0 ? (currentPrice - closestSupport) / currentPrice : 1;
        const riskRewardRatio = closestResistance > 0 
          ? (closestResistance - currentPrice) / (currentPrice - closestSupport) 
          : 2;
        
        return {
          type: 'buy',
          strength: Math.min(riskRewardRatio / 2, 1),
          price: currentPrice,
          timestamp: Date.now(),
          metadata: {
            breakoutType: 'resistance',
            breakoutLevel: closestResistance,
            currentLevel: breakoutLevel,
            closestSupport,
            atr: this.atr,
            volumeConfirmed: true,
            riskRewardRatio,
            distanceToSupport,
          },
        };
      }
    }
    
    // Check for downside breakout
    if (support.length > 0 && closestSupport > 0) {
      const breakoutLevel = closestSupport - breakoutThreshold;
      
      if (currentPrice <= breakoutLevel && this.isVolumeConfirmed()) {
        const distanceToResistance = closestResistance > 0 ? (closestResistance - currentPrice) / currentPrice : 1;
        const riskRewardRatio = closestResistance > 0 
          ? (currentPrice - closestSupport) / (closestResistance - currentPrice)
          : 2;
        
        return {
          type: 'sell',
          strength: Math.min(riskRewardRatio / 2, 1),
          price: currentPrice,
          timestamp: Date.now(),
          metadata: {
            breakoutType: 'support',
            breakoutLevel: closestSupport,
            currentLevel: breakoutLevel,
            closestResistance,
            atr: this.atr,
            volumeConfirmed: true,
            riskRewardRatio,
            distanceToResistance,
          },
        };
      }
    }
    
    return null;
  }

  /**
   * Calculate position size based on risk
   */
  calculatePositionSize(entryPrice: number, stopLossPercent: number): number {
    const riskAmount = this.config.maxPositionSize * stopLossPercent;
    const priceRisk = entryPrice * stopLossPercent;
    return riskAmount / priceRisk;
  }

  /**
   * Calculate trailing stop price
   */
  calculateTrailingStop(currentPrice: number, entryPrice: number, side: 'long' | 'short'): number {
    if (side === 'long') {
      const profit = (currentPrice - entryPrice) / entryPrice;
      if (profit > 0.02) { // Move to breakeven after 2% profit
        return Math.max(entryPrice, currentPrice * (1 - this.trailingStopPercent));
      }
      return entryPrice * (1 - this.stopLoss || 0.02);
    } else {
      const profit = (entryPrice - currentPrice) / entryPrice;
      if (profit > 0.02) {
        return Math.min(entryPrice, currentPrice * (1 + this.trailingStopPercent));
      }
      return entryPrice * (1 + (this.stopLoss || 0.02));
    }
  }
}

export interface BreakoutSignal extends Signal {
  metadata: {
    breakoutType: 'resistance' | 'support';
    breakoutLevel: number;
    currentLevel: number;
    closestSupport: number;
    closestResistance: number;
    atr: number;
    volumeConfirmed: boolean;
    riskRewardRatio: number;
    distanceToSupport?: number;
    distanceToResistance?: number;
  };
}

// ==================== RSI MOMENTUM STRATEGY ====================

export class RSIMomentumStrategy extends EventEmitter {
  private config: StrategyConfig;
  private prices: number[] = [];
  private rsiPeriod: number = 14;
  private oversoldLevel: number = 30;
  private overboughtLevel: number = 70;
  private divergenceLookback: number = 5;

  constructor(config: StrategyConfig, rsiPeriod: number = 14) {
    super();
    this.config = config;
    this.rsiPeriod = rsiPeriod;
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
   * Calculate RSI
   */
  calculateRSI(): number {
    if (this.prices.length < this.rsiPeriod + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    const recentPrices = this.prices.slice(-this.rsiPeriod);
    
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / this.rsiPeriod;
    const avgLoss = losses / this.rsiPeriod;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  /**
   * Detect bullish divergence (price makes lower low, RSI makes higher low)
   */
  private detectBullishDivergence(): boolean {
    if (this.prices.length < this.divergenceLookback * 2) return false;
    
    const recentPrices = this.prices.slice(-this.divergenceLookback * 2);
    const priceLow1 = Math.min(...recentPrices.slice(0, this.divergenceLookback));
    const priceLow2 = Math.min(...recentPrices.slice(this.divergenceLookback));
    
    // Calculate RSI for each period
    const rsi1 = this.calculateRSIForPeriod(recentPrices.slice(0, this.divergenceLookback + this.rsiPeriod));
    const rsi2 = this.calculateRSIForPeriod(recentPrices.slice(this.divergenceLookback));
    
    return priceLow2 < priceLow1 && rsi2 > rsi1;
  }

  /**
   * Detect bearish divergence (price makes higher high, RSI makes lower high)
   */
  private detectBearishDivergence(): boolean {
    if (this.prices.length < this.divergenceLookback * 2) return false;
    
    const recentPrices = this.prices.slice(-this.divergenceLookback * 2);
    const priceHigh1 = Math.max(...recentPrices.slice(0, this.divergenceLookback));
    const priceHigh2 = Math.max(...recentPrices.slice(this.divergenceLookback));
    
    const rsi1 = this.calculateRSIForPeriod(recentPrices.slice(0, this.divergenceLookback + this.rsiPeriod));
    const rsi2 = this.calculateRSIForPeriod(recentPrices.slice(this.divergenceLookback));
    
    return priceHigh2 > priceHigh1 && rsi2 < rsi1;
  }

  /**
   * Calculate RSI for a specific period
   */
  private calculateRSIForPeriod(prices: number[]): number {
    if (prices.length < 2) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / (prices.length - 1);
    const avgLoss = losses / (prices.length - 1);
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Generate RSI-based trading signals
   */
  generateSignal(): Signal | null {
    if (this.prices.length < this.rsiPeriod + 5) return null;
    
    const currentPrice = this.prices[this.prices.length - 1];
    const rsi = this.calculateRSI();
    
    // Oversold condition with bullish divergence
    if (rsi < this.oversoldLevel && this.detectBullishDivergence()) {
      return {
        type: 'buy',
        strength: Math.min((this.oversoldLevel - rsi) / this.oversoldLevel + 0.3, 1),
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          rsi,
          condition: 'oversold_bullish_divergence',
          oversoldLevel: this.oversoldLevel,
        },
      };
    }
    
    // Oversold condition
    if (rsi < this.oversoldLevel) {
      return {
        type: 'buy',
        strength: (this.oversoldLevel - rsi) / this.oversoldLevel,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          rsi,
          condition: 'oversold',
          oversoldLevel: this.oversoldLevel,
        },
      };
    }
    
    // Overbought condition with bearish divergence
    if (rsi > this.overboughtLevel && this.detectBearishDivergence()) {
      return {
        type: 'sell',
        strength: Math.min((rsi - this.overboughtLevel) / (100 - this.overboughtLevel) + 0.3, 1),
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          rsi,
          condition: 'overbought_bearish_divergence',
          overboughtLevel: this.overboughtLevel,
        },
      };
    }
    
    // Overbought condition
    if (rsi > this.overboughtLevel) {
      return {
        type: 'sell',
        strength: (rsi - this.overboughtLevel) / (100 - this.overboughtLevel),
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          rsi,
          condition: 'overbought',
          overboughtLevel: this.overboughtLevel,
        },
      };
    }
    
    return null;
  }
}

// ==================== MACD CROSSOVER STRATEGY ====================

export class MACDCrossoverStrategy extends EventEmitter {
  private config: StrategyConfig;
  private candles: CandleData[] = [];
  private fastPeriod: number = 12;
  private slowPeriod: number = 26;
  private signalPeriod: number = 9;
  private histogramHistory: number[] = [];

  constructor(config: StrategyConfig, fastPeriod: number = 12, slowPeriod: number = 26) {
    super();
    this.config = config;
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
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
   * Calculate EMA for a period
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Calculate MACD values
   */
  calculateMACD(): { macd: number; signal: number; histogram: number } {
    if (this.candles.length < this.slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const prices = this.candles.map(c => c.close);
    const fastEMA = this.calculateEMA(prices, this.fastPeriod);
    const slowEMA = this.calculateEMA(prices, this.slowPeriod);
    
    const macd = fastEMA - slowEMA;
    
    // Calculate signal line from MACD history
    this.histogramHistory.push(macd);
    if (this.histogramHistory.length > this.signalPeriod) {
      this.histogramHistory.shift();
    }
    
    const signal = this.calculateEMA(this.histogramHistory, Math.min(this.histogramHistory.length, this.signalPeriod));
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  /**
   * Detect MACD crossover
   */
  private detectCrossover(prevMACD: number, prevSignal: number, currMACD: number, currSignal: number): 'bullish' | 'bearish' | null {
    // Bullish crossover: MACD crosses above signal
    if (prevMACD < prevSignal && currMACD > currSignal) {
      return 'bullish';
    }
    // Bearish crossover: MACD crosses below signal
    if (prevMACD > prevSignal && currMACD < currSignal) {
      return 'bearish';
    }
    return null;
  }

  /**
   * Generate MACD-based trading signals
   */
  generateSignal(): Signal | null {
    if (this.candles.length < this.slowPeriod + 2) return null;
    
    const currentPrice = this.candles[this.candles.length - 1].close;
    const prevCandle = this.candles[this.candles.length - 2];
    
    // Calculate MACD for current and previous candle
    const prevMACD = this.calculateMACDAt(this.candles.length - 2);
    const currMACD = this.calculateMACD();
    
    const crossover = this.detectCrossover(prevMACD.macd, prevMACD.signal, currMACD.macd, currMACD.signal);
    
    if (crossover === 'bullish') {
      const strength = Math.min(Math.abs(currMACD.histogram) / (currentPrice * 0.01), 1);
      return {
        type: 'buy',
        strength: 0.5 + strength * 0.5,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          macd: currMACD.macd,
          signal: currMACD.signal,
          histogram: currMACD.histogram,
          crossover: 'bullish',
        },
      };
    }
    
    if (crossover === 'bearish') {
      const strength = Math.min(Math.abs(currMACD.histogram) / (currentPrice * 0.01), 1);
      return {
        type: 'sell',
        strength: 0.5 + strength * 0.5,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          macd: currMACD.macd,
          signal: currMACD.signal,
          histogram: currMACD.histogram,
          crossover: 'bearish',
        },
      };
    }
    
    // Zero line crossover
    if (currMACD.macd > 0 && prevMACD.macd < 0) {
      return {
        type: 'buy',
        strength: 0.6,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          macd: currMACD.macd,
          signal: currMACD.signal,
          histogram: currMACD.histogram,
          crossover: 'zero_line_bullish',
        },
      };
    }
    
    if (currMACD.macd < 0 && prevMACD.macd > 0) {
      return {
        type: 'sell',
        strength: 0.6,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          macd: currMACD.macd,
          signal: currMACD.signal,
          histogram: currMACD.histogram,
          crossover: 'zero_line_bearish',
        },
      };
    }
    
    return null;
  }

  /**
   * Calculate MACD at specific index
   */
  private calculateMACDAt(index: number): { macd: number; signal: number; histogram: number } {
    if (index < this.slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const prices = this.candles.slice(0, index + 1).map(c => c.close);
    const fastEMA = this.calculateEMA(prices, this.fastPeriod);
    const slowEMA = this.calculateEMA(prices, this.slowPeriod);
    
    const macd = fastEMA - slowEMA;
    
    // Calculate signal from historical values
    const histValues: number[] = [];
    for (let i = this.slowPeriod; i <= index; i++) {
      const p = this.candles.slice(0, i + 1).map(c => c.close);
      const fEM = this.calculateEMA(p, this.fastPeriod);
      const sEM = this.calculateEMA(p, this.slowPeriod);
      histValues.push(fEM - sEM);
    }
    
    const signal = this.calculateEMA(histValues, Math.min(histValues.length, this.signalPeriod));
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }
}

// ==================== BOLLINGER BANDS STRATEGY ====================

export class BollingerBandsStrategy extends EventEmitter {
  private config: StrategyConfig;
  private candles: CandleData[] = [];
  private period: number = 20;
  private stdDevMultiplier: number = 2;
  private upperBand: number = 0;
  private middleBand: number = 0;
  private lowerBand: number = 0;

  constructor(config: StrategyConfig, period: number = 20, stdDevMultiplier: number = 2) {
    super();
    this.config = config;
    this.period = period;
    this.stdDevMultiplier = stdDevMultiplier;
  }

  /**
   * Add candle data point
   */
  addCandle(candle: CandleData): void {
    this.candles.push(candle);
    if (this.candles.length > 100) {
      this.candles.shift();
    }
    
    if (this.candles.length >= this.period) {
      this.calculateBands();
    }
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBands(): void {
    const prices = this.candles.slice(-this.period).map(c => c.close);
    
    // Calculate middle band (SMA)
    this.middleBand = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Calculate standard deviation
    const variance = prices.reduce((a, b) => a + Math.pow(b - this.middleBand, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate upper and lower bands
    this.upperBand = this.middleBand + stdDev * this.stdDevMultiplier;
    this.lowerBand = this.middleBand - stdDev * this.stdDevMultiplier;
  }

  /**
   * Calculate bandwidth (measure of volatility)
   */
  getBandwidth(): number {
    return (this.upperBand - this.lowerBand) / this.middleBand;
  }

  /**
   * Calculate %B (position within bands)
   */
  getPercentB(price: number): number {
    return (price - this.lowerBand) / (this.upperBand - this.lowerBand);
  }

  /**
   * Detect squeeze (low volatility)
   */
  isSqueezing(threshold: number = 0.1): boolean {
    return this.getBandwidth() < threshold;
  }

  /**
   * Generate Bollinger Bands trading signals
   */
  generateSignal(): Signal | null {
    if (this.candles.length < this.period + 1) return null;
    
    const currentPrice = this.candles[this.candles.length - 1].close;
    const prevPrice = this.candles[this.candles.length - 2].close;
    
    // Buy signal: price touches lower band or breaks out
    if (currentPrice <= this.lowerBand || (prevPrice > this.lowerBand && currentPrice < this.lowerBand)) {
      return {
        type: 'buy',
        strength: 0.8,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          band: 'lower',
          price: currentPrice,
          lowerBand: this.lowerBand,
          middleBand: this.middleBand,
          upperBand: this.upperBand,
          bandwidth: this.getBandwidth(),
          percentB: this.getPercentB(currentPrice),
        },
      };
    }
    
    // Sell signal: price touches upper band or breaks out
    if (currentPrice >= this.upperBand || (prevPrice < this.upperBand && currentPrice > this.upperBand)) {
      return {
        type: 'sell',
        strength: 0.8,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          band: 'upper',
          price: currentPrice,
          lowerBand: this.lowerBand,
          middleBand: this.middleBand,
          upperBand: this.upperBand,
          bandwidth: this.getBandwidth(),
          percentB: this.getPercentB(currentPrice),
        },
      };
    }
    
    // Mean reversion: price at extremes
    const percentB = this.getPercentB(currentPrice);
    if (percentB < 0.1) {
      return {
        type: 'buy',
        strength: 0.6,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          band: 'lower_extreme',
          percentB,
          lowerBand: this.lowerBand,
          upperBand: this.upperBand,
        },
      };
    }
    
    if (percentB > 0.9) {
      return {
        type: 'sell',
        strength: 0.6,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          band: 'upper_extreme',
          percentB,
          lowerBand: this.lowerBand,
          upperBand: this.upperBand,
        },
      };
    }
    
    return null;
  }
}

// ==================== VOLATILITY BREAKOUT STRATEGY ====================

export class VolatilityBreakoutStrategy extends EventEmitter {
  private config: StrategyConfig;
  private candles: CandleData[] = [];
  private atrPeriod: number = 14;
  private atrMultiplier: number = 2;
  private atr: number = 0;
  private lookbackPeriod: number = 20;

  constructor(config: StrategyConfig, atrPeriod: number = 14, atrMultiplier: number = 2) {
    super();
    this.config = config;
    this.atrPeriod = atrPeriod;
    this.atrMultiplier = atrMultiplier;
  }

  /**
   * Add candle data point
   */
  addCandle(candle: CandleData): void {
    this.candles.push(candle);
    if (this.candles.length > 100) {
      this.candles.shift();
    }
    
    if (this.candles.length >= this.atrPeriod + 1) {
      this.calculateATR();
    }
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private calculateATR(): void {
    const periods = this.candles.slice(-this.atrPeriod);
    let atrSum = 0;
    
    for (let i = 1; i < periods.length; i++) {
      const high = periods[i].high;
      const low = periods[i].low;
      const prevClose = periods[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      atrSum += tr;
    }
    
    this.atr = atrSum / this.atrPeriod;
  }

  /**
   * Calculate volatility-adjusted levels
   */
  getVolatilityLevels(): { upper: number; lower: number; range: number } {
    if (this.candles.length === 0) {
      return { upper: 0, lower: 0, range: 0 };
    }
    
    const lastCandle = this.candles[this.candles.length - 1];
    const close = lastCandle.close;
    const upper = close + this.atr * this.atrMultiplier;
    const lower = close - this.atr * this.atrMultiplier;
    const range = upper - lower;
    
    return { upper, lower, range };
  }

  /**
   * Check if price is breaking out
   */
  isBreakout(): 'upside' | 'downside' | null {
    if (this.candles.length < 2) return null;
    
    const currentCandle = this.candles[this.candles.length - 1];
    const prevCandle = this.candles[this.candles.length - 2];
    const { upper, lower } = this.getVolatilityLevels();
    
    // Upside breakout
    if (currentCandle.high > upper && prevCandle.high <= upper) {
      return 'upside';
    }
    
    // Downside breakout
    if (currentCandle.low < lower && prevCandle.low >= lower) {
      return 'downside';
    }
    
    return null;
  }

  /**
   * Generate volatility breakout signals
   */
  generateSignal(): Signal | null {
    if (this.candles.length < this.atrPeriod + 2) return null;
    
    const currentPrice = this.candles[this.candles.length - 1].close;
    const breakout = this.isBreakout();
    const { upper, lower, range } = this.getVolatilityLevels();
    
    if (breakout === 'upside') {
      const strength = Math.min((currentPrice - upper + range) / range, 1);
      return {
        type: 'buy',
        strength: 0.5 + strength * 0.5,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          breakout: 'upside',
          atr: this.atr,
          upperLevel: upper,
          lowerLevel: lower,
          range,
          volatility: this.atr / currentPrice,
        },
      };
    }
    
    if (breakout === 'downside') {
      const strength = Math.min((lower - currentPrice + range) / range, 1);
      return {
        type: 'sell',
        strength: 0.5 + strength * 0.5,
        price: currentPrice,
        timestamp: Date.now(),
        metadata: {
          breakout: 'downside',
          atr: this.atr,
          upperLevel: upper,
          lowerLevel: lower,
          range,
          volatility: this.atr / currentPrice,
        },
      };
    }
    
    return null;
  }

  /**
   * Get current volatility metric
   */
  getVolatility(): number {
    if (this.candles.length === 0) return 0;
    return this.atr / this.candles[this.candles.length - 1].close;
  }
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

  /**
   * Create breakout strategy with support/resistance detection
   */
  static createBreakout(config: StrategyConfig, lookbackPeriod?: number): BreakoutStrategy {
    return new BreakoutStrategy(config, lookbackPeriod);
  }

  /**
   * Create RSI momentum strategy
   */
  static createRSIMomentum(config: StrategyConfig, rsiPeriod?: number): RSIMomentumStrategy {
    return new RSIMomentumStrategy(config, rsiPeriod);
  }

  /**
   * Create MACD crossover strategy
   */
  static createMACDCrossover(config: StrategyConfig, fastPeriod?: number, slowPeriod?: number): MACDCrossoverStrategy {
    return new MACDCrossoverStrategy(config, fastPeriod, slowPeriod);
  }

  /**
   * Create Bollinger Bands strategy
   */
  static createBollingerBands(config: StrategyConfig, period?: number, stdDevMultiplier?: number): BollingerBandsStrategy {
    return new BollingerBandsStrategy(config, period, stdDevMultiplier);
  }

  /**
   * Create Volatility Breakout strategy
   */
  static createVolatilityBreakout(config: StrategyConfig, atrPeriod?: number, atrMultiplier?: number): VolatilityBreakoutStrategy {
    return new VolatilityBreakoutStrategy(config, atrPeriod, atrMultiplier);
  }
}

export default StrategyFactory;
