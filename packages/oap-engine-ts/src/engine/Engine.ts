/**
 * Engine - Main orchestration engine
 */

import { Agent, AgentConfig, AgentStatus } from '../agent/Agent';
import { SwarmOrchestrator } from '../swarm/SwarmOrchestrator';
import { PluginManager } from '../plugin/PluginManager';
import { EventBus } from '../events/EventBus';
import { Logger } from '../utils/Logger';
import { Chain, Wallet, ChainAdapter } from '@jlm-ai-agent/types';
import { LlmProvider } from '@jlm-ai-agent/llm-provider';

export interface EngineConfig {
  /** Maximum concurrent agents */
  maxAgents: number;
  /** Default chain */
  defaultChain: Chain;
  /** LLM provider */
  llmProvider: LlmProvider;
  /** Enable swarm mode */
  enableSwarm: boolean;
  /** Storage backend */
  storage: 'memory' | 'redis' | 'postgres';
  /** Redis URL (if using redis) */
  redisUrl?: string;
  /** Database URL (if using postgres) */
  databaseUrl?: string;
}

const DEFAULT_CONFIG: Partial<EngineConfig> = {
  maxAgents: 100,
  defaultChain: 'ethereum',
  enableSwarm: true,
  storage: 'memory'
};

export class Engine {
  private readonly config: EngineConfig;
  private readonly agents: Map<string, Agent>;
  private readonly swarm: SwarmOrchestrator;
  private readonly pluginManager: PluginManager;
  private readonly eventBus: EventBus;
  private readonly logger: Logger;
  private initialized: boolean = false;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as EngineConfig;
    this.agents = new Map();
    this.swarm = new SwarmOrchestrator({
      maxAgents: this.config.maxAgents
    });
    this.pluginManager = new PluginManager();
    this.eventBus = new EventBus();
    this.logger = new Logger('Engine');
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing Omni-Agent Protocol Engine...');

    // Initialize storage
    await this.initializeStorage();
    
    // Initialize plugins
    await this.initializePlugins();
    
    // Setup event bus
    this.setupEventBus();

    this.initialized = true;
    this.logger.info('Engine initialized successfully');
  }

  /**
   * Initialize storage backend
   */
  private async initializeStorage(): Promise<void> {
    switch (this.config.storage) {
      case 'redis':
        if (!this.config.redisUrl) {
          throw new Error('Redis URL required when storage is redis');
        }
        // Would initialize Redis client
        break;
      case 'postgres':
        if (!this.config.databaseUrl) {
          throw new Error('Database URL required when storage is postgres');
        }
        // Would initialize PostgreSQL client
        break;
      case 'memory':
      default:
        // In-memory storage is default
        break;
    }
  }

  /**
   * Initialize plugins
   */
  private async initializePlugins(): Promise<void> {
    // Register built-in plugins
    await this.pluginManager.registerBuiltInPlugins();
  }

  /**
   * Setup event bus
   */
  private setupEventBus(): void {
    // Global event handlers
    this.eventBus.on('agent:created', (agentId: string) => {
      this.logger.info(`Agent created: ${agentId}`);
    });

    this.eventBus.on('agent:destroyed', (agentId: string) => {
      this.logger.info(`Agent destroyed: ${agentId}`);
    });

    this.eventBus.on('agent:error', ({ agentId, error }: { agentId: string; error: Error }) => {
      this.logger.error(`Agent error [${agentId}]: ${error.message}`);
    });
  }

  /**
   * Create and start a new agent
   */
  async createAgent(config: Omit<AgentConfig, 'id'>): Promise<Agent> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate agent ID
    const id = this.generateAgentId();
    const agentConfig: AgentConfig = {
      ...config,
      id,
      chain: config.chain || this.config.defaultChain
    };

    this.logger.info(`Creating agent: ${agentConfig.name}`);

    // Create agent
    const agent = new Agent(agentConfig);
    this.agents.set(id, agent);

    // Setup agent events
    this.setupAgentEvents(agent);

    // Emit creation event
    this.eventBus.emit('agent:created', id);

    return agent;
  }

  /**
   * Setup agent event handlers
   */
  private setupAgentEvents(agent: Agent): void {
    agent.on('statusChanged', (status: AgentStatus) => {
      this.eventBus.emit('agent:statusChanged', {
        agentId: agent.getId(),
        status
      });
    });

    agent.on('error', (error: Error) => {
      this.eventBus.emit('agent:error', {
        agentId: agent.getId(),
        error
      });
    });

    agent.on('executed', (receipts) => {
      this.eventBus.emit('agent:executed', {
        agentId: agent.getId(),
        receipts
      });
    });
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentStatus): Agent[] {
    return this.getAllAgents().filter(agent => agent.getStatus() === status);
  }

  /**
   * Destroy an agent
   */
  async destroyAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }

    // Stop the agent if running
    if (agent.getStatus() !== 'stopped') {
      await agent.stop();
    }

    // Remove from registry
    this.agents.delete(id);
    
    this.eventBus.emit('agent:destroyed', id);
    this.logger.info(`Agent destroyed: ${id}`);
  }

  /**
   * Create a swarm of agents
   */
  async createSwarm(config: {
    name: string;
    agentCount: number;
    strategy: string;
    chain: Chain;
  }): Promise<string> {
    if (!this.config.enableSwarm) {
      throw new Error('Swarm mode is not enabled');
    }

    const swarmId = await this.swarm.createSwarm({
      name: config.name,
      agentCount: config.agentCount,
      strategy: config.strategy,
      chain: config.chain
    });

    this.logger.info(`Swarm created: ${swarmId} with ${config.agentCount} agents`);
    
    return swarmId;
  }

  /**
   * Get swarm orchestrator
   */
  getSwarm(): SwarmOrchestrator {
    return this.swarm;
  }

  /**
   * Get plugin manager
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  /**
   * Get event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get engine statistics
   */
  getStats(): EngineStats {
    const agents = this.getAllAgents();
    
    return {
      totalAgents: agents.length,
      runningAgents: agents.filter(a => a.getStatus() === 'running').length,
      stoppedAgents: agents.filter(a => a.getStatus() === 'stopped').length,
      errorAgents: agents.filter(a => a.getStatus() === 'error').length,
      swarmCount: this.swarm.getSwarmCount(),
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down engine...');

    // Stop all agents
    const stopPromises = this.getAllAgents()
      .filter(agent => agent.getStatus() !== 'stopped')
      .map(agent => agent.stop());
    
    await Promise.allSettled(stopPromises);
    
    // Clear registries
    this.agents.clear();
    this.eventBus.removeAllListeners();

    this.logger.info('Engine shutdown complete');
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Engine statistics
 */
export interface EngineStats {
  totalAgents: number;
  runningAgents: number;
  stoppedAgents: number;
  errorAgents: number;
  swarmCount: number;
  uptime: number;
}

export { Agent, AgentConfig, AgentStatus } from '../agent/Agent';
export { SwarmOrchestrator } from '../swarm/SwarmOrchestrator';
export { PluginManager } from '../plugin/PluginManager';
export { EventBus } from '../events/EventBus';
