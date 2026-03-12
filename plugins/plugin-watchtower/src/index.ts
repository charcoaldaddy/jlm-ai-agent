/**
 * Watchtower - Monitoring & Risk Management System
 * 
 * Real-time monitoring for all JLM AI Agent activities
 * Tracks latency, exposure, PnL, and sends alerts
 */

import { EventEmitter } from 'events';

// ==================== MONITORING TYPES ====================

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  memory: number;
  cpu: number;
  timestamp: number;
}

export interface LatencyMetrics {
  assetClass: string;
  symbol: string;
  tickToTrade: number; // ms
  lastUpdated: number;
}

export interface ExposureMetrics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: PositionExposure[];
  var: number; // Value at Risk
}

export interface PositionExposure {
  symbol: string;
  assetClass: 'crypto' | 'forex' | 'metals' | 'stocks' | 'polymarket';
  side: 'long' | 'short';
  size: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export interface APIHealth {
  exchange: string;
  rateLimitUsed: number;
  rateLimitTotal: number;
  latency: number;
  status: 'ok' | 'warning' | 'error';
  lastError?: string;
}

export interface Alert {
  id: string;
  type: 'trade' | 'error' | 'warning' | 'pnl' | 'health';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
  acknowledged: boolean;
}

export interface PnLReport {
  dailyPnL: number;
  dailyPnLPercent: number;
  weeklyPnL: number;
  monthlyPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  fees: number;
  timestamp: number;
}

// ==================== WATCHTOWER CLASS ====================

export class Watchtower extends EventEmitter {
  private name: string;
  private startTime: number;
  private positions: Map<string, PositionExposure> = new Map();
  private alerts: Alert[] = [];
  private latencyHistory: LatencyMetrics[] = [];
  private apiHealth: Map<string, APIHealth> = new Map();
  private pnlHistory: PnLReport[] = [];
  private checkInterval: NodeJS.Timer | null = null;
  private webhookUrl?: string;

  constructor(name: string = 'JLM-Watchtower') {
    super();
    this.name = name;
    this.startTime = Date.now();
  }

  /**
   * Initialize watchtower
   */
  async initialize(config: WatchtowerConfig): Promise<void> {
    console.log(`[Watchtower] Initializing ${this.name}...`);
    this.webhookUrl = config.webhookUrl;
    
    // Start periodic health checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, config.checkInterval || 60000);
    
    console.log('[Watchtower] Initialized successfully');
  }

  /**
   * Update position
   */
  updatePosition(position: PositionExposure): void {
    const key = `${position.assetClass}-${position.symbol}`;
    this.positions.set(key, position);
    this.emit('positionUpdate', position);
  }

  /**
   * Get total exposure
   */
  getExposure(): ExposureMetrics {
    let totalValue = 0;
    let totalPnL = 0;
    const positions = Array.from(this.positions.values());
    
    for (const pos of positions) {
      totalValue += Math.abs(pos.value);
      totalPnL += pos.pnl;
    }
    
    const totalValueOriginal = totalValue - totalPnL;
    const totalPnLPercent = totalValueOriginal > 0 
      ? (totalPnL / totalValueOriginal) * 100 
      : 0;
    
    // Calculate VaR (simplified - 2% daily volatility assumption)
    const varEstimate = totalValue * 0.02;
    
    return {
      totalValue: totalValueOriginal + totalPnL,
      totalPnL,
      totalPnLPercent,
      positions,
      var: varEstimate,
    };
  }

  /**
   * Update API health
   */
  updateAPIHealth(exchange: string, health: Partial<APIHealth>): void {
    const current = this.apiHealth.get(exchange) || {
      exchange,
      rateLimitUsed: 0,
      rateLimitTotal: 1000,
      latency: 0,
      status: 'ok',
    };
    
    this.apiHealth.set(exchange, { ...current, ...health });
    this.emit('apiHealthUpdate', this.apiHealth.get(exchange));
  }

  /**
   * Update latency metrics
   */
  updateLatency(metrics: LatencyMetrics): void {
    this.latencyHistory.push(metrics);
    
    // Keep last 1000 records
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory.shift();
    }
    
    this.emit('latencyUpdate', metrics);
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(assetClass?: string): LatencyStats {
    let filtered = this.latencyHistory;
    
    if (assetClass) {
      filtered = this.latencyHistory.filter(l => l.assetClass === assetClass);
    }
    
    if (filtered.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }
    
    const sorted = filtered.map(l => l.tickToTrade).sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Send alert
   */
  async sendAlert(type: Alert['type'], severity: Alert['severity'], message: string, metadata?: Record<string, any>): Promise<void> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      metadata,
      timestamp: Date.now(),
      acknowledged: false,
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
    
    // Send to webhook if configured
    if (this.webhookUrl && severity !== 'info') {
      await this.sendWebhookAlert(alert);
    }
    
    // Log critical alerts
    if (severity === 'critical') {
      console.error(`[Watchtower-CRITICAL] ${message}`);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.webhookUrl) return;
    
    try {
      // In production, would send to Discord/Telegram webhook
      console.log(`[Watchtower] Sending ${alert.severity} alert to webhook: ${alert.message}`);
    } catch (error) {
      console.error('[Watchtower] Failed to send webhook alert:', error);
    }
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 50, severity?: Alert['severity']): Alert[] {
    let filtered = this.alerts;
    
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Check PnL drawdown
   */
  checkPnLDrawdown(currentEquity: number, threshold: number = 2): void {
    if (this.pnlHistory.length === 0) return;
    
    const peakEquity = Math.max(...this.pnlHistory.map(p => p.dailyPnL));
    const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
    
    if (drawdown > threshold) {
      this.sendAlert('pnl', 'critical', `PnL Drawdown: ${drawdown.toFixed(2)}% (Threshold: ${threshold}%)`, {
        drawdown,
        peakEquity,
        currentEquity,
      });
    }
  }

  /**
   * Record PnL
   */
  recordPnL(realizedPnL: number, unrealizedPnL: number, fees: number): void {
    const previousEquity = this.pnlHistory.length > 0 
      ? this.pnlHistory[this.pnlHistory.length - 1].dailyPnL 
      : 0;
    
    const dailyPnL = realizedPnL + unrealizedPnL - fees;
    const dailyPnLPercent = previousEquity > 0 
      ? (dailyPnL / previousEquity) * 100 
      : 0;
    
    const report: PnLReport = {
      dailyPnL,
      dailyPnLPercent,
      weeklyPnL: this.calculateWeeklyPnL(dailyPnL),
      monthlyPnL: this.calculateMonthlyPnL(dailyPnL),
      realizedPnL,
      unrealizedPnL,
      fees,
      timestamp: Date.now(),
    };
    
    this.pnlHistory.push(report);
    this.emit('pnlReport', report);
    
    // Check for significant PnL change
    if (Math.abs(dailyPnLPercent) > 5) {
      this.sendAlert(
        'pnl',
        dailyPnLPercent > 0 ? 'info' : 'warning',
        `Daily PnL: ${dailyPnLPercent.toFixed(2)}%`,
        { dailyPnL, fees }
      );
    }
  }

  /**
   * Get system health
   */
  getSystemHealth(): SystemHealth {
    const uptime = Date.now() - this.startTime;
    
    // In production, would get actual memory/CPU
    const memory = process.memoryUsage?.()?.heapUsed / 1024 / 1024 || 0;
    const cpu = 0; // Would use os.cpuUsage()
    
    return {
      status: memory > 500 ? 'degraded' : 'healthy',
      uptime,
      memory,
      cpu,
      timestamp: Date.now(),
    };
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const health = this.getSystemHealth();
    
    if (health.status === 'degraded') {
      this.sendAlert('health', 'warning', `System degraded - Memory: ${health.memory.toFixed(0)}MB`);
    }
    
    // Check API health
    for (const [exchange, api] of this.apiHealth) {
      if (api.status === 'error') {
        this.sendAlert('health', 'critical', `API Error: ${exchange}`, { lastError: api.lastError });
      } else if (api.latency > 5000) {
        this.sendAlert('health', 'warning', `High latency: ${exchange} - ${api.latency}ms`);
      }
    }
    
    // Check position exposure
    const exposure = this.getExposure();
    if (exposure.var > exposure.totalValue * 0.2) {
      this.sendAlert('warning', 'warning', `High VaR: ${exposure.var.toFixed(2)} (${((exposure.var / exposure.totalValue) * 100).toFixed(1)}% of portfolio)`);
    }
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): DashboardData {
    return {
      systemHealth: this.getSystemHealth(),
      exposure: this.getExposure(),
      apiHealth: Array.from(this.apiHealth.values()),
      latencyStats: this.getLatencyStats(),
      recentAlerts: this.getAlerts(10),
      pnlHistory: this.pnlHistory.slice(-24), // Last 24 reports
    };
  }

  /**
   * Calculate weekly PnL
   */
  private calculateWeeklyPnL(currentPnL: number): number {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekReports = this.pnlHistory.filter(p => p.timestamp > weekAgo);
    return weekReports.reduce((sum, p) => sum + p.dailyPnL, 0) + currentPnL;
  }

  /**
   * Calculate monthly PnL
   */
  private calculateMonthlyPnL(currentPnL: number): number {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthReports = this.pnlHistory.filter(p => p.timestamp > monthAgo);
    return monthReports.reduce((sum, p) => sum + p.dailyPnL, 0) + currentPnL;
  }

  /**
   * Shutdown watchtower
   */
  async shutdown(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    console.log('[Watchtower] Shutdown complete');
  }
}

export interface WatchtowerConfig {
  webhookUrl?: string;
  checkInterval?: number;
  alertThreshold?: number;
}

export interface LatencyStats {
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export interface DashboardData {
  systemHealth: SystemHealth;
  exposure: ExposureMetrics;
  apiHealth: APIHealth[];
  latencyStats: LatencyStats;
  recentAlerts: Alert[];
  pnlHistory: PnLReport[];
}

export default Watchtower;
