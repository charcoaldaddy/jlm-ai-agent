/**
 * Grid Trading Bot
 * 
 * Automated grid trading for volatile assets
 * Places buy and sell orders at predefined price levels
 */

import { StocksPlugin } from '@jlm-ai-agent/plugin-stocks';
import { CryptoPlugin } from '@jlm-ai-agent/plugin-uniswap';
import { GridTradingStrategy } from '@jlm-ai-agent/strategy';

interface GridOrder {
  id: string;
  price: number;
  type: 'buy' | 'sell';
  filled: boolean;
  filledAt?: number;
}

interface GridConfig {
  asset: string;
  assetClass: 'crypto' | 'stocks';
  basePrice: number;
  gridCount: number;
  gridSpacing: number; // percentage
  orderSize: number;
}

class GridTradingBot {
  private stocks: StocksPlugin;
  private crypto: CryptoPlugin;
  private config: GridConfig;
  private gridStrategy: GridTradingStrategy;
  private orders: GridOrder[] = [];
  private totalProfit: number = 0;
  private tradeCount: number = 0;

  constructor(config: GridConfig) {
    this.config = config;
    
    this.stocks = new StocksPlugin({
      apiKey: process.env.ALPACA_API_KEY || '',
      apiSecret: process.env.ALPACA_SECRET_KEY || '',
      provider: 'alpaca',
      paperTrading: true,
    });

    this.crypto = new CryptoPlugin({} as any);

    this.gridStrategy = new GridTradingStrategy(
      {
        name: 'grid-trading',
        enabled: true,
        riskLevel: 'low',
        maxPositionSize: config.orderSize * config.gridCount,
      },
      config.basePrice,
      config.gridCount
    );
  }

  async initialize(): Promise<void> {
    console.log(`[GridTrading] Initializing ${this.config.asset} grid bot...`);
    console.log(`Base Price: $${this.config.basePrice}`);
    console.log(`Grid Levels: ${this.config.gridCount}`);
    console.log(`Spacing: ${(this.config.gridSpacing * 100).toFixed(1)}%`);

    if (this.config.assetClass === 'stocks') {
      await this.stocks.connect();
    } else {
      await this.crypto.connect();
    }

    // Initialize grid orders
    await this.initializeGrid();
    
    console.log(`[GridTrading] Initialized with ${this.orders.length} grid levels`);
  }

  private async initializeGrid(): Promise<void> {
    const range = this.config.basePrice * this.config.gridSpacing * this.config.gridCount;
    const startPrice = this.config.basePrice * (1 - range);
    const step = (this.config.basePrice * 2 * range) / this.config.gridCount;

    for (let i = 0; i < this.config.gridCount; i++) {
      const price = startPrice + (i * step);
      const type = i < this.config.gridCount / 2 ? 'buy' : 'sell';

      this.orders.push({
        id: `grid-${i}`,
        price,
        type,
        filled: false,
      });
    }
  }

  async runGrid(): Promise<void> {
    console.log('\n=== Running Grid Analysis ===\n');

    // Get current price
    let currentPrice: number;
    
    if (this.config.assetClass === 'stocks') {
      const quote = await this.stocks.getQuote(this.config.asset);
      currentPrice = quote.last;
    } else {
      const price = await this.crypto.getPrice(this.config.asset);
      currentPrice = price.price;
    }

    console.log(`Current ${this.config.asset} Price: $${currentPrice.toFixed(2)}`);

    // Check each grid level
    for (const order of this.orders) {
      if (order.filled) continue;

      const shouldFill = 
        (order.type === 'buy' && currentPrice <= order.price * 1.001) ||
        (order.type === 'sell' && currentPrice >= order.price * 0.999);

      if (shouldFill) {
        await this.executeGridOrder(order, currentPrice);
      }
    }

    // Calculate current profit
    this.calculateProfit(currentPrice);

    // Display grid status
    this.displayGridStatus(currentPrice);
  }

  private async executeGridOrder(order: GridOrder, currentPrice: number): Promise<void> {
    console.log(`\n✅ Grid Order Filled: ${order.type.toUpperCase()} @ $${order.price.toFixed(2)}`);

    order.filled = true;
    order.filledAt = Date.now();

    const profit = this.config.orderSize * Math.abs(currentPrice - this.config.basePrice) / this.config.basePrice;
    this.totalProfit += profit;
    this.tradeCount++;

    // Create counter order to close position
    const counterOrder: GridOrder = {
      id: `counter-${order.id}`,
      price: order.type === 'buy' 
        ? order.price * (1 + this.config.gridSpacing)
        : order.price * (1 - this.config.gridSpacing),
      type: order.type === 'buy' ? 'sell' : 'buy',
      filled: false,
    };

    // Reset original order after some time
    setTimeout(() => {
      order.filled = false;
      console.log(`\n🔄 Grid level reset: $${order.price.toFixed(2)}`);
    }, 60 * 60 * 1000); // Reset after 1 hour
  }

  private calculateProfit(currentPrice: number): void {
    let unrealizedProfit = 0;
    let filledBuys = 0;
    let filledSells = 0;

    for (const order of this.orders) {
      if (order.filled) {
        if (order.type === 'buy') {
          filledBuys++;
          unrealizedProfit += (currentPrice - order.price) * this.config.orderSize;
        } else {
          filledSells++;
          unrealizedProfit += (order.price - currentPrice) * this.config.orderSize;
        }
      }
    }

    console.log(`\n📊 Profit Summary:`);
    console.log(`   Realized Profit: $${this.totalProfit.toFixed(2)}`);
    console.log(`   Unrealized Profit: $${unrealizedProfit.toFixed(2)}`);
    console.log(`   Total Trades: ${this.tradeCount}`);
    console.log(`   Filled Buys: ${filledBuys}`);
    console.log(`   Filled Sells: ${filledSells}`);
  }

  private displayGridStatus(currentPrice: number): void {
    console.log('\n=== Grid Status ===\n');
    
    // Show price position relative to grid
    const pricePosition = ((currentPrice - (this.config.basePrice * (1 - this.config.gridSpacing * this.config.gridCount))) / 
      (this.config.basePrice * 2 * this.config.gridSpacing * this.config.gridCount)) * 100;
    
    console.log(`Price Position: ${pricePosition.toFixed(1)}% of grid range`);

    // Show nearest unfilled orders
    const nearestBuy = this.orders
      .filter(o => o.type === 'buy' && !o.filled)
      .sort((a, b) => b.price - a.price)[0];
    
    const nearestSell = this.orders
      .filter(o => o.type === 'sell' && !o.filled)
      .sort((a, b) => a.price - b.price)[0];

    if (nearestBuy) {
      console.log(`Nearest Buy: $${nearestBuy.price.toFixed(2)} (${((currentPrice - nearestBuy.price) / currentPrice * 100).toFixed(2)}% below)`);
    }
    
    if (nearestSell) {
      console.log(`Nearest Sell: $${nearestSell.price.toFixed(2)} (${((nearestSell.price - currentPrice) / currentPrice * 100).toFixed(2)}% above)`);
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    // Run grid immediately
    await this.runGrid();

    // Then run every 5 minutes
    setInterval(() => {
      this.runGrid();
    }, 5 * 60 * 1000);
  }
}

// Example usage - Bitcoin grid trading
const config: GridConfig = {
  asset: 'BTC',
  assetClass: 'crypto',
  basePrice: 50000,
  gridCount: 10,
  gridSpacing: 0.01, // 1% between levels
  orderSize: 100,
};

const bot = new GridTradingBot(config);
bot.start().catch(console.error);
