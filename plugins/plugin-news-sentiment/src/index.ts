/**
 * News Sentiment Plugin
 * 
 * Real-time news aggregation and sentiment analysis
 * Supports crypto, forex, stocks, and macro news sources
 */

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
  sentiment: number; // -1 to 1
  keywords: string[];
  relatedAssets: string[];
}

export interface SentimentReport {
  asset: string;
  sentiment: number; // -1 to 1
  bullish: number; // percentage
  bearish: number; // percentage
  totalArticles: number;
  keyThemes: string[];
  timestamp: number;
}

export interface NewsSource {
  id: string;
  name: string;
  type: 'crypto' | 'forex' | 'stocks' | 'macro';
  url: string;
  active: boolean;
}

export const DEFAULT_SOURCES: NewsSource[] = [
  { id: 'coindesk', name: 'CoinDesk', type: 'crypto', url: 'https://coindesk.com', active: true },
  { id: 'coinTelegraph', name: 'CoinTelegraph', type: 'crypto', url: 'https://cointelegraph.com', active: true },
  { id: 'bloomberg', name: 'Bloomberg', type: 'macro', url: 'https://bloomberg.com', active: true },
  { id: 'reuters', name: 'Reuters', type: 'macro', url: 'https://reuters.com', active: true },
  { id: 'cnbc', name: 'CNBC', type: 'stocks', url: 'https://cnbc.com', active: true },
  { id: 'fxstreet', name: 'FX Street', type: 'forex', url: 'https://fxstreet.com', active: true },
];

export const CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'blockchain',
  'defi', 'nft', 'token', 'crypto', 'exchange', 'binance', 'coinbase',
  'mining', 'validator', 'smart contract', 'dao', 'protocol',
];

export const FOREX_KEYWORDS = [
  'forex', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad',
  'dollar', 'federal reserve', 'fed', 'ecb', 'central bank',
  'interest rate', 'monetary policy', 'currency',
];

export const STOCK_KEYWORDS = [
  'stock', 'equity', 'dow', 'nasdaq', 's&p', 'aapl', 'msft',
  'earnings', 'quarterly', 'ipo', 'market', 'rally',
];

export class NewsSentimentPlugin {
  private sources: NewsSource[] = DEFAULT_SOURCES;
  private articles: NewsArticle[] = [];
  private sentimentHistory: Map<string, SentimentReport[]> = new Map();
  private apiKey?: string;

  constructor(config: NewsSentimentConfig = {}) {
    this.apiKey = config.apiKey;
    this.sources = config.sources || DEFAULT_SOURCES;
  }

  /**
   * Fetch latest news from all sources
   */
  async fetchNews(options: FetchNewsOptions = {}): Promise<NewsArticle[]> {
    const { limit = 50, sources, asset } = options;
    
    console.log(`[NewsSentiment] Fetching news... (limit: ${limit})`);
    
    // In production, would fetch from actual APIs
    // For now, return simulated news
    const news = this.generateSampleNews(limit);
    
    // Filter by sources if specified
    const filtered = sources 
      ? news.filter(n => sources.includes(n.source))
      : news;
    
    // Filter by asset if specified
    const result = asset
      ? filtered.filter(n => n.relatedAssets.includes(asset.toUpperCase()))
      : filtered;
    
    // Add to articles
    this.articles = [...result, ...this.articles].slice(0, 1000);
    
    return result;
  }

  /**
   * Analyze sentiment for specific asset
   */
  async analyzeAssetSentiment(asset: string): Promise<SentimentReport> {
    const assetUpper = asset.toUpperCase();
    const relevantArticles = this.articles.filter(a => 
      a.relatedAssets.includes(assetUpper)
    );
    
    if (relevantArticles.length === 0) {
      // Fetch fresh news if no cached articles
      await this.fetchNews({ asset });
    }
    
    const finalArticles = this.articles.filter(a => 
      a.relatedAssets.includes(assetUpper)
    );
    
    // Calculate sentiment metrics
    const sentiments = finalArticles.map(a => a.sentiment);
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    
    const bullish = sentiments.filter(s => s > 0.1).length;
    const bearish = sentiments.filter(s => s < -0.1).length;
    const neutral = sentiments.length - bullish - bearish;
    
    // Extract key themes
    const allKeywords = finalArticles.flatMap(a => a.keywords);
    const keywordCounts = new Map<string, number>();
    for (const kw of allKeywords) {
      keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
    }
    const keyThemes = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    
    const report: SentimentReport = {
      asset: assetUpper,
      sentiment: avgSentiment,
      bullish: (bullish / sentiments.length) * 100,
      bearish: (bearish / sentiments.length) * 100,
      totalArticles: finalArticles.length,
      keyThemes,
      timestamp: Date.now(),
    };
    
    // Store in history
    const history = this.sentimentHistory.get(assetUpper) || [];
    history.push(report);
    this.sentimentHistory.set(assetUpper, history.slice(-100));
    
    return report;
  }

  /**
   * Get historical sentiment data
   */
  getSentimentHistory(asset: string, limit: number = 24): SentimentReport[] {
    const history = this.sentimentHistory.get(asset.toUpperCase()) || [];
    return history.slice(-limit);
  }

  /**
   * Get trending topics
   */
  getTrendingTopics(limit: number = 10): { topic: string; mentions: number; sentiment: number }[] {
    const allKeywords = this.articles.flatMap(a => a.keywords);
    const keywordCounts = new Map<string, { count: number; sentiment: number }>();
    
    for (const kw of allKeywords) {
      const existing = keywordCounts.get(kw) || { count: 0, sentiment: 0 };
      keywordCounts.set(kw, {
        count: existing.count + 1,
        sentiment: existing.sentiment + (this.articles.find(a => a.keywords.includes(kw))?.sentiment || 0),
      });
    }
    
    return Array.from(keywordCounts.entries())
      .map(([topic, data]) => ({
        topic,
        mentions: data.count,
        sentiment: data.sentiment / data.count,
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, limit);
  }

  /**
   * Check for breaking news
   */
  getBreakingNews(): NewsArticle[] {
    const recentArticles = this.articles.filter(
      a => Date.now() - a.publishedAt < 3600000 // Last hour
    );
    
    // Sort by absolute sentiment (most polarized)
    return recentArticles
      .sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment))
      .slice(0, 10);
  }

  /**
   * Get news by source
   */
  getNewsBySource(source: string): NewsArticle[] {
    return this.articles.filter(a => a.source === source);
  }

  /**
   * Generate sample news for testing
   */
  private generateSampleNews(count: number): NewsArticle[] {
    const sampleHeadlines = [
      { title: 'Bitcoin Surges Past Key Resistance Level', sentiment: 0.8, assets: ['BTC', 'ETH'] },
      { title: 'Federal Reserve Signals Rate Cut Possibility', sentiment: 0.6, assets: ['USD', 'STOCKS'] },
      { title: 'Ethereum Network Upgrade Successful', sentiment: 0.7, assets: ['ETH'] },
      { title: 'Regulatory Concerns Impact Crypto Markets', sentiment: -0.5, assets: ['BTC', 'CRYPTO'] },
      { title: 'Tech Stocks Rally on Strong Earnings', sentiment: 0.75, assets: ['AAPL', 'MSFT', 'STOCKS'] },
      { title: 'Gold Reaches New All-Time High', sentiment: 0.65, assets: ['XAUUSD', 'GOLD'] },
      { title: 'Oil Prices Drop on Supply Concerns', sentiment: -0.4, assets: ['OIL', 'COMMODITIES'] },
      { title: 'European Markets Mixed on Economic Data', sentiment: 0.1, assets: ['EURUSD', 'STOCKS'] },
      { title: 'Crypto Exchange Reports Record Trading Volume', sentiment: 0.5, assets: ['BTC', 'CRYPTO'] },
      { title: 'Central Bank Intervention Boosts Currency', sentiment: 0.55, assets: ['FOREX', 'USD'] },
    ];

    const articles: NewsArticle[] = [];
    const sources = ['CoinDesk', 'CoinTelegraph', 'Bloomberg', 'Reuters', 'CNBC', 'FX Street'];
    
    for (let i = 0; i < count; i++) {
      const sample = sampleHeadlines[i % sampleHeadlines.length];
      articles.push({
        id: `news-${Date.now()}-${i}`,
        title: sample.title,
        summary: `Latest update on ${sample.assets.join(', ')}...`,
        source: sources[i % sources.length],
        url: `https://example.com/news/${i}`,
        publishedAt: Date.now() - (i * 600000), // Staggered by 10 minutes
        sentiment: sample.sentiment + (Math.random() * 0.2 - 0.1),
        keywords: sample.assets.flatMap(a => [a.toLowerCase(), 'market', 'trading']),
        relatedAssets: sample.assets,
      });
    }
    
    return articles;
  }
}

export interface NewsSentimentConfig {
  apiKey?: string;
  sources?: NewsSource[];
}

export interface FetchNewsOptions {
  limit?: number;
  sources?: string[];
  asset?: string;
}

export default NewsSentimentPlugin;
