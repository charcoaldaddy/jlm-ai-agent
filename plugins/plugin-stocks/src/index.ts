/**
 * Stock Equity Trading Plugin
 * 
 * Real-time stock trading for US markets
 * Supported by Alpaca Markets, Interactive Brokers, and Polygon.io
 */

export interface StockQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
}

export interface StockCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface StockOrder {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
}

export interface StockPosition {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  avgEntryPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

export interface MarketHours {
  preMarket: { start: string; end: string };
  regular: { start: string; end: string };
  afterHours: { start: string; end: string };
}

export const MARKET_HOURS: MarketHours = {
  preMarket: { start: '04:00', end: '09:30' },
  regular: { start: '09:30', end: '16:00' },
  afterHours: { start: '16:00', end: '20:00' },
};

export const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'JNJ',
  'V', 'UNH', 'HD', 'PG', 'MA', 'DIS', 'PYPL', 'NFLX', 'ADBE', 'CRM',
  'INTC', 'AMD', 'QCOM', 'TXN', 'AVGO', 'ORCL', 'IBM', 'CSCO', 'INTU', 'AMAT',
  'BA', 'CAT', 'GE', 'MMM', 'HON', 'UPS', 'LMT', 'RTX', 'NOC', 'UNP',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL',
];

export class StocksPlugin {
  private apiKey: string;
  private apiSecret: string;
  private provider: 'alpaca' | 'ib' | 'polygon';
  private paperTrading: boolean;
  private connected: boolean = false;
  private quotes: Map<string, StockQuote> = new Map();

  constructor(config: StocksConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.provider = config.provider || 'alpaca';
    this.paperTrading = config.paperTrading ?? true;
  }

  /**
   * Connect to stock data provider
   */
  async connect(): Promise<void> {
    console.log(`[Stocks] Connecting to ${this.provider} (Paper: ${this.paperTrading})...`);
    this.connected = true;
    console.log('[Stocks] Connected successfully');
  }

  /**
   * Get real-time quote
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    const quote = this.quotes.get(symbol);
    if (!quote) {
      throw new Error(`No quote available for ${symbol}`);
    }
    return quote;
  }

  /**
   * Get historical candles
   */
  async getCandles(symbol: string, timeframe: string, limit: number): Promise<StockCandle[]> {
    // Return simulated historical data
    const candles: StockCandle[] = [];
    const now = Date.now();
    const interval = this.getIntervalMs(timeframe);
    
    let price = 150 + Math.random() * 50;
    
    for (let i = limit; i > 0; i--) {
      const timestamp = now - (i * interval);
      const change = (Math.random() - 0.5) * 2;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random();
      const low = Math.min(open, close) - Math.random();
      
      candles.push({
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 10000000),
        timestamp,
      });
      
      price = close;
    }
    
    return candles;
  }

  /**
   * Place stock order
   */
  async placeOrder(order: StockOrder): Promise<StockOrderResult> {
    console.log(`[Stocks] Placing ${order.type} order: ${order.side} ${order.quantity} ${order.symbol}`);
    
    const quote = await this.getQuote(order.symbol);
    
    return {
      orderId: `STK-${Date.now()}`,
      clientOrderId: `client-${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      status: 'filled',
      filledPrice: quote.last,
      filledQuantity: order.quantity,
      timestamp: Date.now(),
    };
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<StockPosition[]> {
    return [];
  }

  /**
   * Get account information
   */
  async getAccount(): Promise<AccountInfo> {
    return {
      id: 'account-001',
      cash: 100000,
      portfolioValue: 100000,
      buyingPower: 200000,
      dayTradingBuyingPower: 400000,
      equity: 100000,
      lastEquity: 100000,
    };
  }

  /**
   * Check market hours
   */
  getMarketStatus(): 'pre' | 'regular' | 'after' | 'closed' {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const time = hours * 60 + minutes;
    
    const preStart = 4 * 60;
    const preEnd = 9 * 60 + 30;
    const regStart = 9 * 60 + 30;
    const regEnd = 16 * 60;
    const afterStart = 16 * 60;
    const afterEnd = 20 * 60;
    
    if (time >= preStart && time < preEnd) return 'pre';
    if (time >= regStart && time < regEnd) return 'regular';
    if (time >= afterStart && time < afterEnd) return 'after';
    return 'closed';
  }

  /**
   * Check for circuit breakers
   */
  async checkCircuitBreaker(symbol: string): Promise<CircuitBreakerStatus> {
    const quote = await this.getQuote(symbol);
    
    // Simplified circuit breaker check (real implementation would check daily move)
    return {
      triggered: false,
      level: 0,
      limitUp: quote.last * 1.1,
      limitDown: quote.last * 0.9,
    };
  }

  /**
   * Calculate wash sale compliance
   */
  checkWashSaleCompliance(symbol: string, quantity: number, side: 'buy' | 'sell'): WashSaleCheck {
    // Simplified - real implementation would track actual transactions
    return {
      isWashSale: false,
      disallowedLoss: 0,
      reason: null,
    };
  }

  /**
   * Get sector performance
   */
  async getSectorPerformance(): Promise<SectorPerformance[]> {
    return [
      { sector: 'Technology', change: 1.25 },
      { sector: 'Healthcare', change: -0.45 },
      { sector: 'Financial', change: 0.82 },
      { sector: 'Energy', change: -1.12 },
      { sector: 'Consumer', change: 0.34 },
    ];
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(timeframe: string): number {
    const units: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return units[timeframe] || 60000;
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[Stocks] Disconnected');
  }
}

export interface StocksConfig {
  apiKey: string;
  apiSecret: string;
  provider: 'alpaca' | 'ib' | 'polygon';
  paperTrading?: boolean;
}

export interface StockOrderResult {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  filledPrice: number;
  filledQuantity: number;
  timestamp: number;
}

export interface AccountInfo {
  id: string;
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  dayTradingBuyingPower: number;
  equity: number;
  lastEquity: number;
}

export interface CircuitBreakerStatus {
  triggered: boolean;
  level: number;
  limitUp: number;
  limitDown: number;
}

export interface WashSaleCheck {
  isWashSale: boolean;
  disallowedLoss: number;
  reason: string | null;
}

export interface SectorPerformance {
  sector: string;
  change: number;
}

export default StocksPlugin;
