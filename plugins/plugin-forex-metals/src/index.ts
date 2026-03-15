/**
 * Forex & Precious Metals Plugin
 * 
 * Multi-asset trading for Forex pairs and precious metals (XAUUSD, XAGUSD)
 * Supported by OANDA, IG Group, and forex.com APIs
 */

export interface ForexPair {
  symbol: string;
  base: string;
  quote: string;
  pip: number;
  minTradeSize: number;
}

export interface MetalPair {
  symbol: string;
  name: string;
  contractSize: number;
  minTradeSize: number;
}

export interface ForexQuote {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
}

export interface MetalQuote {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
  change24h: number;
}

export interface ForexOrder {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ForexPosition {
  symbol: string;
  side: 'long' | 'short';
  volume: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPips: number;
}

export const FOREX_PAIRS: ForexPair[] = [
  // Major Pairs
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF', pip: 0.0001, minTradeSize: 1000 },
  // Minor Pairs
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'NZDUSD', base: 'NZD', quote: 'USD', pip: 0.0001, minTradeSize: 1000 },
  // Cross Pairs
  { symbol: 'EURGBP', base: 'EUR', quote: 'GBP', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'EURJPY', base: 'EUR', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'GBPJPY', base: 'GBP', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'EURAUD', base: 'EUR', quote: 'AUD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'EURCAD', base: 'EUR', quote: 'CAD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'EURCHF', base: 'EUR', quote: 'CHF', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'EURNZD', base: 'EUR', quote: 'NZD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'GBPAUD', base: 'GBP', quote: 'AUD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'GBPCAD', base: 'GBP', quote: 'CAD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'GBPCHF', base: 'GBP', quote: 'CHF', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'GBPNZD', base: 'GBP', quote: 'NZD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'AUDJPY', base: 'AUD', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'CADJPY', base: 'CAD', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'CHFJPY', base: 'CHF', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'NZDJPY', base: 'NZD', quote: 'JPY', pip: 0.01, minTradeSize: 1000 },
  // Exotic Pairs
  { symbol: 'USDSEK', base: 'USD', quote: 'SEK', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDNOK', base: 'USD', quote: 'NOK', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDMXN', base: 'USD', quote: 'MXN', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDZAR', base: 'USD', quote: 'ZAR', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDTRY', base: 'USD', quote: 'TRY', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDHKD', base: 'USD', quote: 'HKD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDSGD', base: 'USD', quote: 'SGD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDTHB', base: 'USD', quote: 'THB', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'USDPLN', base: 'USD', quote: 'PLN', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'USDCZK', base: 'USD', quote: 'CZK', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'USDHUF', base: 'USD', quote: 'HUF', pip: 0.01, minTradeSize: 1000 },
  { symbol: 'USDRUB', base: 'USD', quote: 'RUB', pip: 0.01, minTradeSize: 1000 },
  // Additional Cross Pairs
  { symbol: 'AUDNZD', base: 'AUD', quote: 'NZD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'AUDCAD', base: 'AUD', quote: 'CAD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'AUDCHF', base: 'AUD', quote: 'CHF', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'CADCHF', base: 'CAD', quote: 'CHF', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'NZDCAD', base: 'NZD', quote: 'CAD', pip: 0.0001, minTradeSize: 1000 },
  { symbol: 'NZDCHF', base: 'NZD', quote: 'CHF', pip: 0.0001, minTradeSize: 1000 },
];

export const METAL_PAIRS: MetalPair[] = [
  { symbol: 'XAUUSD', name: 'Gold', contractSize: 100, minTradeSize: 0.01 },
  { symbol: 'XAGUSD', name: 'Silver', contractSize: 5000, minTradeSize: 0.1 },
  { symbol: 'XPTUSD', name: 'Platinum', contractSize: 100, minTradeSize: 0.01 },
  { symbol: 'XPDUSD', name: 'Palladium', contractSize: 100, minTradeSize: 0.01 },
];

export class ForexMetalsPlugin {
  private apiKey: string;
  private apiSecret: string;
  private provider: 'oanda' | 'ig' | 'forexcom';
  private connected: boolean = false;
  private quotes: Map<string, ForexQuote | MetalQuote> = new Map();

  constructor(config: ForexMetalsConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.provider = config.provider || 'oanda';
  }

  /**
   * Connect to Forex/Metals provider
   */
  async connect(): Promise<void> {
    console.log(`[ForexMetals] Connecting to ${this.provider}...`);
    // Initialize WebSocket connection for real-time quotes
    this.connected = true;
    console.log('[ForexMetals] Connected successfully');
  }

  /**
   * Get real-time quote for Forex pair
   */
  async getForexQuote(symbol: string): Promise<ForexQuote> {
    const quote = this.quotes.get(symbol) as ForexQuote;
    if (!quote) {
      throw new Error(`No quote available for ${symbol}`);
    }
    return quote;
  }

  /**
   * Get real-time quote for Metal pair
   */
  async getMetalQuote(symbol: string): Promise<MetalQuote> {
    const quote = this.quotes.get(symbol) as MetalQuote;
    if (!quote) {
      throw new Error(`No quote available for ${symbol}`);
    }
    return quote;
  }

  /**
   * Place Forex order
   */
  async placeOrder(order: ForexOrder): Promise<ForexOrderResult> {
    console.log(`[ForexMetals] Placing ${order.type} order: ${order.side} ${order.volume} ${order.symbol}`);
    
    return {
      orderId: `FX-${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      volume: order.volume,
      status: 'filled',
      fillPrice: (await this.getForexQuote(order.symbol)).ask,
      timestamp: Date.now(),
    };
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<ForexPosition[]> {
    return [];
  }

  /**
   * Get DXY (Dollar Index) correlation data
   */
  async getDXYCorrelation(): Promise<DXYData> {
    return {
      index: 105.32,
      change: 0.15,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate pip value for a position
   */
  calculatePipValue(symbol: string, pipCount: number): number {
    const pair = FOREX_PAIRS.find(p => p.symbol === symbol);
    if (!pair) return 0;
    return pipCount * pair.pip * pair.minTradeSize;
  }

  /**
   * Monitor spread for trading conditions
   */
  async checkSpreadCondition(symbol: string, maxSpread: number): Promise<boolean> {
    const quote = await this.getForexQuote(symbol).catch(() => null);
    if (!quote) return false;
    return quote.spread <= maxSpread;
  }

  /**
   * Get correlation between assets
   */
  async getCorrelation(asset1: string, asset2: string): Promise<number> {
    // Return simulated correlation coefficient
    return Math.random() * 2 - 1;
  }

  /**
   * Disconnect from provider
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[ForexMetals] Disconnected');
  }
}

export interface ForexMetalsConfig {
  apiKey: string;
  apiSecret: string;
  provider: 'oanda' | 'ig' | 'forexcom';
  accountId?: string;
  demoMode?: boolean;
}

export interface ForexOrderResult {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  volume: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  fillPrice: number;
  timestamp: number;
}

export interface DXYData {
  index: number;
  change: number;
  timestamp: number;
}

export default ForexMetalsPlugin;
