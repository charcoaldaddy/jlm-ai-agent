/**
 * Swarm Orchestrator - Manages multiple agents working together
 */

import { Agent, AgentConfig } from '../agent/Agent';
import { Logger } from '../utils/Logger';

export interface SwarmConfig {
  name: string;
  maxAgents: number;
  taskQueueSize: number;
  communicationTimeout: number;
}

export interface SwarmTask {
  id: string;
  type: SwarmTaskType;
  params: Record<string, any>;
  requiredAgents: number;
  timeout: number;
}

export enum SwarmTaskType {
  PortfolioOptimization = 'portfolio_optimization',
  CrossChainArbitrage = 'cross_chain_arbitrage',
  GovernanceVoting = 'governance_voting',
  MarketMaking = 'market_making',
  Custom = 'custom'
}

export interface SwarmMessage {
  from: string;
  to?: string;
  type: MessageType;
  payload: any;
  timestamp: number;
}

export enum MessageType {
  TaskRequest = 'task_request',
  TaskResponse = 'task_response',
  Heartbeat = 'heartbeat',
  Error = 'error',
  Shutdown = 'shutdown'
}

export interface SwarmStats {
  swarmId: string;
  name: string;
  agentCount: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export class SwarmOrchestrator {
  private readonly config: SwarmConfig;
  private readonly agents: Map<string, Agent>;
  private readonly tasks: Map<string, SwarmTask>;
  private readonly taskResults: Map<string, any>;
  private readonly messageQueue: Map<string, SwarmMessage[]>;
  private readonly logger: Logger;
  private swarmCount: number = 0;

  constructor(config: Partial<SwarmConfig> = {}) {
    this.config = {
      name: config.name || 'default-swarm',
      maxAgents: config.maxAgents || 100,
      taskQueueSize: config.taskQueueSize || 10000,
      communicationTimeout: config.communicationTimeout || 5000
    };
    
    this.agents = new Map();
    this.tasks = new Map();
    this.taskResults = new Map();
    this.messageQueue = new Map();
    this.logger = new Logger('SwarmOrchestrator');
  }

  /**
   * Create a new swarm
   */
  async createSwarm(config: {
    name: string;
    agentCount: number;
    strategy: string;
    chain: string;
  }): Promise<string> {
    const swarmId = this.generateSwarmId();
    
    this.logger.info(`Creating swarm ${swarmId} with ${config.agentCount} agents`);
    
    this.swarmCount++;
    
    return swarmId;
  }

  /**
   * Add agent to swarm
   */
  async addAgent(agent: Agent): Promise<void> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error('Swarm is at maximum capacity');
    }

    const agentId = agent.getId();
    this.agents.set(agentId, agent);
    
    this.logger.info(`Agent ${agentId} added to swarm`);
  }

  /**
   * Remove agent from swarm
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    await agent.stop();
    this.agents.delete(agentId);
    
    this.logger.info(`Agent ${agentId} removed from swarm`);
  }

  /**
   * Submit task to swarm
   */
  async submitTask(task: Omit<SwarmTask, 'id'>): Promise<string> {
    const taskId = this.generateTaskId();
    
    const fullTask: SwarmTask = {
      ...task,
      id: taskId
    };

    this.tasks.set(taskId, fullTask);
    
    this.logger.info(`Task ${taskId} submitted to swarm`);
    
    // Distribute task to agents
    this.distributeTask(fullTask);

    return taskId;
  }

  /**
   * Distribute task to available agents
   */
  private distributeTask(task: SwarmTask): void {
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.getStatus() === 'running');

    if (availableAgents.length === 0) {
      this.logger.warn(`No available agents for task ${task.id}`);
      return;
    }

    // Distribute to first N agents
    const agentsToUse = availableAgents.slice(0, task.requiredAgents);
    
    for (const agent of agentsToUse) {
      this.sendToAgent(agent.getId(), {
        from: 'orchestrator',
        to: agent.getId(),
        type: MessageType.TaskRequest,
        payload: task,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Send message to specific agent
   */
  private sendToAgent(agentId: string, message: SwarmMessage): void {
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }
    
    this.messageQueue.get(agentId)!.push(message);
  }

  /**
   * Receive message for agent
   */
  receiveFromAgent(agentId: string): SwarmMessage[] {
    return this.messageQueue.get(agentId) || [];
  }

  /**
   * Clear messages for agent
   */
  clearMessages(agentId: string): void {
    this.messageQueue.delete(agentId);
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): any {
    return this.taskResults.get(taskId);
  }

  /**
   * Complete task
   */
  completeTask(taskId: string, result: any): void {
    this.taskResults.set(taskId, {
      ...result,
      completedAt: Date.now()
    });
    
    this.logger.info(`Task ${taskId} completed`);
  }

  /**
   * Fail task
   */
  failTask(taskId: string, error: string): void {
    this.taskResults.set(taskId, {
      error,
      failedAt: Date.now()
    });
    
    this.logger.error(`Task ${taskId} failed: ${error}`);
  }

  /**
   * Get swarm statistics
   */
  getStats(swarmId: string): SwarmStats {
    return {
      swarmId,
      name: this.config.name,
      agentCount: this.agents.size,
      activeTasks: this.tasks.size,
      completedTasks: Array.from(this.taskResults.values()).filter(r => !r.error).length,
      failedTasks: Array.from(this.taskResults.values()).filter(r => r.error).length
    };
  }

  /**
   * Get swarm count
   */
  getSwarmCount(): number {
    return this.swarmCount;
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(message: Omit<SwarmMessage, 'from' | 'timestamp'>): Promise<void> {
    const fullMessage: SwarmMessage = {
      ...message,
      from: 'orchestrator',
      timestamp: Date.now()
    };

    for (const agentId of this.agents.keys()) {
      this.sendToAgent(agentId, fullMessage);
    }
  }

  /**
   * Shutdown swarm
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down swarm...');
    
    // Stop all agents
    const stopPromises = Array.from(this.agents.values())
      .map(agent => agent.stop());
    
    await Promise.allSettled(stopPromises);
    
    // Clear state
    this.agents.clear();
    this.tasks.clear();
    this.taskResults.clear();
    this.messageQueue.clear();
    
    this.logger.info('Swarm shutdown complete');
  }

  /**
   * Generate swarm ID
   */
  private generateSwarmId(): string {
    return `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
