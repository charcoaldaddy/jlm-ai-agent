/**
 * Event Bus - Global event system
 */

import { EventEmitter } from 'events';

export interface EventMap {
  // Agent events
  'agent:created': (agentId: string) => void;
  'agent:destroyed': (agentId: string) => void;
  'agent:statusChanged': (data: { agentId: string; status: string }) => void;
  'agent:error': (data: { agentId: string; error: Error }) => void;
  'agent:executed': (data: { agentId: string; receipts: any[] }) => void;
  
  // Swarm events
  'swarm:created': (swarmId: string) => void;
  'swarm:taskSubmitted': (data: { swarmId: string; taskId: string }) => void;
  'swarm:taskCompleted': (data: { swarmId: string; taskId: string; result: any }) => void;
  
  // Chain events
  'chain:block': (data: { chain: string; blockNumber: number }) => void;
  'chain:transaction': (data: { chain: string; txHash: string }) => void;
  
  // System events
  'system:ready': () => void;
  'system:error': (error: Error) => void;
}

export class EventBus extends EventEmitter {
  private readonly eventHistory: Array<{ event: string; data: any; timestamp: number }> = [];
  private readonly maxHistorySize: number = 1000;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Emit event with history tracking
   */
  emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): boolean {
    // Add to history
    this.eventHistory.push({
      event,
      data: args[0],
      timestamp: Date.now()
    });

    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    return super.emit(event, ...args);
  }

  /**
   * Get event history
   */
  getHistory(event?: string, limit?: number): Array<{ event: string; data: any; timestamp: number }> {
    let history = this.eventHistory;

    if (event) {
      history = history.filter(h => h.event === event);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Subscribe to event with handler
   */
  on<K extends keyof EventMap>(event: K, handler: EventMap[K]): this {
    return super.on(event, handler);
  }

  /**
   * Subscribe once
   */
  once<K extends keyof EventMap>(event: K, handler: EventMap[K]): this {
    return super.once(event, handler);
  }

  /**
   * Unsubscribe
   */
  off<K extends keyof EventMap>(event: K, handler: EventMap[K]): this {
    return super.off(event, handler);
  }
}
