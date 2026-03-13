/**
 * Scalping Bot
 * 
 * High-frequency micro-profit trading strategy
 * Targets small price movements in volatile markets
 */

import { CryptoPlugin } from '@jlm-ai-agent/plugin-uniswap';
import { ForexMetalsPlugin } from '@jlm-ai-agent/plugin-forex-metals';

interface ScalpConfig {
  asset: string;
  assetClass: 'crypto' | 'forex';
  minProfit: number; // Minimum profit per trade (percentage)
  maxSpread: number; // Maximum spread to allow trading
  positionSize: number;
  maxPositions: number;
  cooldown: number; // ms between trades
}

interface Trade {
  id: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  pnl: number;
  timestamp: number;
}

class ScalpingBot {
  private config: ScalpConfig;
  private crypto?: CryptoPlugin;
  private forex?: ForexMetalsPlugin;
  private positions: Map<string, { side: string; price: number; size: number }> = new Map();
  private trades: Trade[] = [];
  private lastTradeTime: number = 0;
  private totalPnL: number = 0;
  private winningTrades: number = 0;
  private losingTrades: number = 0;

  constructor(config: ScalpConfig) {
    this.config = config;
    
    if (config.assetClass === 'crypto') {
      this.crypto = new CryptoPlugin({} as any);
    } else {
      this.forex = new ForexMetalsPlugin({
        apiKey: '',
        apiSecret: '',
        provider: 'oanda',
      });
    }
  }

  async initialize(): Promise<void> {
    console.log(`[Scalping] Initializing ${this.config.asset} scalper...`);
    console.log(`Min Profit: ${this.config.minProfit}% | Max Spread: ${this.config.maxSpread}%`);
    console.log(`Position Size: ${this.config.positionSize} | Max Positions: ${this.config.maxPositions}`);

    if (this.crypto) {
      await this.crypto.connect();
    } else if (this.forex) {
      await this.forex.connect();
    }
    
    console.log('[Scalping] Connected and ready');
  }

  async scanAndTrade(): Promise<void> {
    console.log('\n=== Scalp Scan ===\n');

    let bid: number, ask: number;

    if (this.config.assetClass === 'crypto' && this.crypto) {
      const price = await this.crypto.getPrice(this.config.asset);
      bid = price.price * 0.999;
      ask = price.price * 1.001;
    } else if (this.forex) {
      const quote = await this.forex.getForexQuote(this.config.asset);
      bid = quote.bid;
      ask = quote.ask;
    } else {
      return;
    }

    const spread = ((ask - bid) / bid) * 100;
    const midPrice = (bid + ask) / 2;

    console.log(`${this.config.asset} | Bid: $${bid.toFixed(2)} | Ask: $${ask.toFixed(2)} | Spread: ${spread.toFixed(3)}%`);

    // Check if spread is acceptable
    if (spread > this.config.maxSpread) {
      console.log(`⚠️ Spread too high (${spread.toFixed(2)}% > ${this.config.maxSpread}%)`);
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastTradeTime < this.config.cooldown) {
      console.log(`⏳ Cooldown active (${Math.round((this.config.cooldown - (now - this.lastTradeTime)) / 1000)}s remaining)`);
      return;
    }

    // Simple momentum signal (in production, use more sophisticated indicators)
    const signal = this.detectSignal(bid, ask);
    
    if (signal) {
      await this.executeTrade(signal, midPrice);
    } else {
      console.log(`No signal detected`);
    }

    // Check existing positions
    await this.monitorPositions(midPrice);

    // Display stats
    this.displayStats();
  }

  private detectSignal(bid: number, ask: number): 'buy' | 'sell' | null {
    // Simple random signal for demo
    // In production, use RSI, MACD, Bollinger Bands, etc.
    const random = Math.random();
    
    if (random > 0.7) return 'buy';
    if (random < 0.3) return 'sell';
    
    return null;
  }

  private async executeTrade(side: 'buy' | 'sell', price: number): Promise<void> {
    const profitTarget = price * (1 + this.config.minProfit / 100);
    const stopLoss = price * (1 - this.config.minProfit / 100);

    const positionKey = `${this.config.asset}-${Date.now()}`;
    this.positions.set(positionKey, {
      side,
      price: side === 'buy' ? profitTarget : stopLoss,
      size: this.config.positionSize,
    });

    this.lastTradeTime = Date.now();

    console.log(`\n✅ Opened ${side.toUpperCase()} position @ $${price.toFixed(2)}`);
    console.log(`   Target: $${profitTarget.toFixed(2)} | Stop: $${stopLoss.toFixed(2)}`);
  }

  private async monitorPositions(currentPrice: number): Promise<void> {
    const positionsToClose: string[] = [];

    for (const [key, pos] of this.positions) {
      const targetPrice = pos.price;
      const shouldClose = 
        (pos.side === 'buy' && currentPrice >= targetPrice) ||
        (pos.side === 'sell' && currentPrice <= targetPrice);

      if (shouldClose) {
        const pnl = this.calculatePnL(pos, currentPrice);
        this.totalPnL += pnl;
        
        if (pnl > 0) {
          this.winningTrades++;
        } else {
          this.losingTrades++;
        }

        this.trades.push({
          id: key,
          side: pos.side,
          price: currentPrice,
          size: pos.size,
          pnl,
          timestamp: Date.now(),
        });

        positionsToClose.push(key);
        
        console.log(`\n💰 ${pnl >= 0 ? 'WIN' : 'LOSS'}: ${pos.side.toUpperCase()} @ $${currentPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)}`);
      }
    }

    // Close positions
    for (const key of positionsToClose) {
      this.positions.delete(key);
    }
  }

  private calculatePnL(position: { side: string; price: number; size: number }, currentPrice: number): number {
    if (position.side === 'buy') {
      return (currentPrice - position.price) * position.size;
    } else {
      return (position.price - currentPrice) * position.size;
    }
  }

  private displayStats(): void {
    const totalTrades = this.winningTrades + this.losingTrades;
    const winRate = totalTrades > 0 ? (this.winningTrades / totalTrades) * 100 : 0;
    const avgWin = this.winningTrades > 0 ? this.trades.filter(t => t.pnl > 0).reduce((a, b) => a + b.pnl, 0) / this.winningTrades : 0;
    const avgLoss = this.losingTrades > 0 ? this.trades.filter(t => t.pnl < 0).reduce((a, b) => a + b.pnl, 0) / this.losingTrades : 0;

    console.log('\n=== Statistics ===');
    console.log(`Total PnL: $${this.totalPnL.toFixed(2)}`);
    console.log(`Trades: ${totalTrades} (W: ${this.winningTrades} | L: ${this.losingTrades})`);
    console.log(`Win Rate: ${winRate.toFixed(1)}%`);
    console.log(`Avg Win: $${avgWin.toFixed(2)} | Avg Loss: $${avgLoss.toFixed(2)}`);
    console.log(`Active Positions: ${this.positions.size}`);
  }

  async start(): Promise<void> {
    await this.initialize();

    // Run scan immediately
    await this.scanAndTrade();

    // Then run every 30 seconds
    setInterval(() => {
      this.scanAndTrade();
    }, 30000);
  }
}

// Example: Bitcoin scalping
const config: ScalpConfig = {
  asset: 'BTC',
  assetClass: 'crypto',
  minProfit: 0.2, // 0.2% profit target
  maxSpread: 0.1, // Max 0.1% spread
  positionSize: 0.01, // 0.01 BTC
  maxPositions: 3,
  cooldown: 5000, // 5 seconds between trades
};

const bot = new ScalpingBot(config);
bot.start().catch(console.error);
