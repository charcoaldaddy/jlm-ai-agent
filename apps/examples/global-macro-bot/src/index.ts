/**
 * Global Macro Trading Bot
 * 
 * Cross-asset correlation trading using DXY, Gold, and Bitcoin
 * Implements macro-hedging strategies
 */

import { ForexMetalsPlugin } from '@jlm-ai-agent/plugin-forex-metals';
import { CryptoPlugin } from '@jlm-ai-agent/plugin-uniswap';
import { GlobalMacroStrategy } from '@jlm-ai-agent/strategy';

interface MacroPosition {
  asset: 'BTC' | 'XAUUSD' | 'XAGUSD';
  side: 'long' | 'short';
  size: number;
  reason: string;
}

class GlobalMacroBot {
  private forex: ForexMetalsPlugin;
  private crypto: CryptoPlugin;
  private strategy: GlobalMacroStrategy;
  private positions: Map<string, MacroPosition> = new Map();
  private dxyThreshold = 104;

  constructor() {
    this.forex = new ForexMetalsPlugin({
      apiKey: process.env.OANDA_API_KEY || '',
      apiSecret: process.env.OANDA_API_SECRET || '',
      provider: 'oanda',
    });
    
    this.crypto = new CryptoPlugin({} as any);
    
    this.strategy = new GlobalMacroStrategy({
      name: 'global-macro',
      enabled: true,
      riskLevel: 'medium',
      maxPositionSize: 10000,
      stopLoss: 0.03,
      takeProfit: 0.05,
    });
  }

  async initialize(): Promise<void> {
    console.log('[GlobalMacro] Initializing...');
    await this.forex.connect();
    await this.crypto.connect();
    console.log('[GlobalMacro] Connected to all providers');
  }

  async runAnalysis(): Promise<void> {
    console.log('\n=== Running Macro Analysis ===\n');

    // Get DXY data
    const dxy = await this.forex.getDXYCorrelation();
    console.log(`DXY Index: ${dxy.index} (${dxy.change > 0 ? '+' : ''}${dxy.change}%)`);

    // Get Gold price
    const gold = await this.forex.getMetalQuote('XAUUSD');
    console.log(`Gold (XAUUSD): $${gold.bid} (${gold.change24h > 0 ? '+' : ''}${gold.change24h.toFixed(2)}%)`);

    // Get Bitcoin price
    const btc = await this.crypto.getPrice('BTC');
    console.log(`Bitcoin: $${btc.price} (${btc.change24h > 0 ? '+' : ''}${btc.change24h.toFixed(2)}%)`);

    // Update strategy with data
    this.strategy.updateDXY(dxy.index);
    this.strategy.updateGold(gold.bid);
    this.strategy.updateBitcoin(btc.price);

    // Generate signal
    const signal = this.strategy.generateSignal();

    if (signal) {
      console.log(`\nSignal: ${signal.type.toUpperCase()}`);
      console.log(`Strength: ${(signal.strength * 100).toFixed(1)}%`);
      console.log(`Rationale: ${signal.metadata?.rationale || 'Macro signal detected'}`);
      
      await this.executeTrade(signal);
    } else {
      console.log('\nNo clear macro signal detected');
    }

    // Check existing positions
    await this.monitorPositions(dxy, gold, btc);
  }

  private async executeTrade(signal: any): Promise<void> {
    const position: MacroPosition = {
      asset: 'BTC',
      side: signal.type === 'buy' ? 'long' : 'short',
      size: 1000,
      reason: signal.metadata?.rationale || 'Macro trade',
    };

    this.positions.set('BTC', position);
    console.log(`\nExecuted ${position.side} position on ${position.asset}`);
  }

  private async monitorPositions(dxy: any, gold: any, btc: any): Promise<void> {
    console.log('\n=== Position Monitoring ===\n');

    for (const [asset, position] of this.positions) {
      let currentPrice: number;
      
      if (asset === 'BTC') {
        const price = await this.crypto.getPrice('BTC');
        currentPrice = price.price;
      } else {
        const metal = await this.forex.getMetalQuote(asset);
        currentPrice = metal.bid;
      }

      // Check if we should close based on DXY reversal
      const shouldClose = 
        (position.side === 'long' && dxy.index > this.dxyThreshold + 2) ||
        (position.side === 'short' && dxy.index < this.dxyThreshold - 2);

      if (shouldClose) {
        console.log(`Closing ${position.asset} position - DXY reversal detected`);
        this.positions.delete(asset);
      } else {
        console.log(`${asset}: ${position.side} @ ${currentPrice} - Monitoring`);
      }
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    // Run immediately
    await this.runAnalysis();

    // Then run every 4 hours
    setInterval(() => {
      this.runAnalysis();
    }, 4 * 60 * 60 * 1000);
  }
}

// Entry point
const bot = new GlobalMacroBot();
bot.start().catch(console.error);
