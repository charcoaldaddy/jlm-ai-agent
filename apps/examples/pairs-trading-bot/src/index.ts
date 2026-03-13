/**
 * Pairs Trading Bot
 * 
 * Statistical arbitrage using correlated asset pairs
 * Monitors spread and executes when divergence is detected
 */

import { StocksPlugin } from '@jlm-ai-agent/plugin-stocks';
import { PairsTradingStrategy } from '@jlm-ai-agent/strategy';

interface Pair {
  asset1: string;
  asset2: string;
  correlation: number;
}

interface PairPosition {
  asset1: { side: 'long' | 'short' | null; size: number; price: number };
  asset2: { side: 'long' | 'short' | null; size: number; price: number };
  openedAt: number;
  spread: number;
}

const CORRELATED_PAIRS: Pair[] = [
  { asset1: 'AAPL', asset2: 'MSFT', correlation: 0.85 },
  { asset1: 'GOOGL', asset2: 'META', correlation: 0.72 },
  { asset1: 'AMZN', asset2: 'NVDA', correlation: 0.68 },
  { asset1: 'XOM', asset2: 'CVX', correlation: 0.82 },
  { asset1: 'JPM', asset2: 'BAC', correlation: 0.79 },
  { asset1: 'TSLA', asset2: 'RIVN', correlation: 0.55 },
];

class PairsTradingBot {
  private stocks: StocksPlugin;
  private pairs: Pair[];
  private positions: Map<string, PairPosition> = new Map();
  private zScoreThreshold = 2.0;
  private exitThreshold = 0.5;

  constructor(pairs?: Pair[]) {
    this.stocks = new StocksPlugin({
      apiKey: process.env.ALPACA_API_KEY || '',
      apiSecret: process.env.ALPACA_SECRET_KEY || '',
      provider: 'alpaca',
      paperTrading: true,
    });

    this.pairs = pairs || CORRELATED_PAIRS;
  }

  async initialize(): Promise<void> {
    console.log('[PairsTrading] Initializing...');
    await this.stocks.connect();
    console.log(`[PairsTrading] Monitoring ${this.pairs.length} pairs`);
  }

  async analyzePairs(): Promise<void> {
    console.log('\n=== Analyzing Pairs ===\n');

    for (const pair of this.pairs) {
      console.log(`\n📊 Pair: ${pair.asset1} / ${pair.asset2}`);
      console.log(`   Correlation: ${(pair.correlation * 100).toFixed(1)}%`);

      try {
        // Get current prices
        const [price1, price2] = await Promise.all([
          this.stocks.getQuote(pair.asset1),
          this.stocks.getQuote(pair.asset2),
        ]);

        console.log(`   ${pair.asset1}: $${price1.last.toFixed(2)}`);
        console.log(`   ${pair.asset2}: $${price2.last.toFixed(2)}`);

        // Calculate spread ratio
        const spread = price1.last / price2.last;
        console.log(`   Spread: ${spread.toFixed(4)}`);

        // Check if we have an existing position
        const pairKey = `${pair.asset1}-${pair.asset2}`;
        const position = this.positions.get(pairKey);

        if (position) {
          // Check if we should exit
          await this.checkExit(pairKey, spread, position);
        } else {
          // Check if we should enter
          await this.checkEntry(pair, spread, price1.last, price2.last);
        }
      } catch (error) {
        console.error(`   Error analyzing pair: ${error}`);
      }
    }
  }

  private async checkEntry(pair: Pair, spread: number, price1: number, price2: number): Promise<void> {
    // Simplified - in production would calculate z-score from historical data
    const randomZ = (Math.random() - 0.5) * 4;
    
    console.log(`   Z-Score (simulated): ${randomZ.toFixed(2)}`);

    if (Math.abs(randomZ) > this.zScoreThreshold) {
      const pairKey = `${pair.asset1}-${pair.asset2}`;
      
      // Enter spread trade
      // If spread too wide (positive z), short asset1, long asset2
      // If spread too narrow (negative z), long asset1, short asset2
      
      const side1 = randomZ > 0 ? 'short' : 'long';
      const side2 = randomZ > 0 ? 'long' : 'short';

      console.log(`\n   ✅ Entering spread trade:`);
      console.log(`      ${pair.asset1}: ${side1.toUpperCase()}`);
      console.log(`      ${pair.asset2}: ${side2.toUpperCase()}`);

      this.positions.set(pairKey, {
        asset1: { side: side1, size: 100, price: price1 },
        asset2: { side: side2, size: 100, price: price2 },
        openedAt: Date.now(),
        spread,
      });
    } else {
      console.log(`   No entry signal (Z-score within threshold)`);
    }
  }

  private async checkExit(pairKey: string, currentSpread: number, position: PairPosition): Promise<void> {
    // Calculate spread change
    const spreadChange = (currentSpread - position.spread) / position.spread;
    console.log(`   Spread change: ${(spreadChange * 100).toFixed(2)}%`);

    // Exit if spread has reverted close to mean (z-score near 0)
    if (Math.abs(spreadChange) < this.exitThreshold * 0.01) {
      console.log(`\n   🔄 Exiting spread trade (spread reverted)`);
      this.positions.delete(pairKey);
      
      const pnl = this.calculatePnL(position, currentSpread);
      console.log(`   PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
    } else if (spreadChange > 0.05) {
      // Stop loss if spread moved against us by 5%
      console.log(`\n   🛑 Stop loss triggered`);
      this.positions.delete(pairKey);
    }
  }

  private calculatePnL(position: PairPosition, currentSpread: number): number {
    let pnl = 0;

    // Asset 1 PnL
    if (position.asset1.side === 'long') {
      pnl += (currentSpread - position.spread) * position.asset1.size;
    } else if (position.asset1.side === 'short') {
      pnl -= (currentSpread - position.spread) * position.asset1.size;
    }

    return pnl;
  }

  getPositions(): Map<string, PairPosition> {
    return this.positions;
  }

  getActivePairs(): Pair[] {
    return this.pairs;
  }

  async start(): Promise<void> {
    await this.initialize();

    // Run immediately
    await this.analyzePairs();

    // Then run every 15 minutes
    setInterval(() => {
      this.analyzePairs();
    }, 15 * 60 * 1000);
  }
}

// Entry point
const bot = new PairsTradingBot();
bot.start().catch(console.error);
