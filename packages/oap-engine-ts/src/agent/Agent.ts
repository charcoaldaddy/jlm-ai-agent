/**
 * Agent class - Core entity for AI agents
 */

import { EventEmitter } from 'events';
import { Wallet } from '@jlm-ai-agent/wallet-mpc';
import { Chain, Intent, IntentResult, Transaction, TransactionReceipt } from '@jlm-ai-agent/types';
import { LlmProvider } from '@jlm-ai-agent/llm-provider';
import { IntentParser } from '../intent/IntentParser';
import { ChainAdapter } from '../adapters/ChainAdapter';
import { Logger } from '../utils/Logger';
import type { AgentConfig, AgentStatus, Strategy } from './types';

export class Agent extends EventEmitter {
  private readonly config: AgentConfig;
  private readonly wallet: Wallet;
  private readonly intentParser: IntentParser;
  private readonly chainAdapter: ChainAdapter;
  private readonly llmProvider: LlmProvider;
  private readonly logger: Logger;
  
  private status: AgentStatus = 'stopped';
  private currentIntent: Intent | null = null;
  private tasksCompleted: number = 0;
  private errors: Error[] = [];

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.wallet = config.wallet;
    this.intentParser = new IntentParser(config.llmProvider);
    this.chainAdapter = this.initializeChainAdapter(config.chain);
    this.llmProvider = config.llmProvider;
    this.logger = new Logger(`Agent:${config.name}`);
  }

  /**
   * Initialize the appropriate chain adapter
   */
  private initializeChainAdapter(chain: Chain): ChainAdapter {
    switch (chain) {
      case 'solana':
        return new (require('../adapters/SolanaAdapter').SolanaAdapter)({
          rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
        });
      case 'ethereum':
      case 'base':
      case 'arbitrum':
      case 'optimism':
      case 'polygon':
        return new (require('../adapters/EvmAdapter').EvmAdapter)({
          chain,
          rpcUrl: this.getEvmRpcUrl(chain)
        });
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  /**
   * Get RPC URL for EVM chains
   */
  private getEvmRpcUrl(chain: Chain): string {
    const envVars: Record<string, string> = {
      ethereum: 'ETHEREUM_RPC_URL',
      base: 'BASE_RPC_URL',
      arbitrum: 'ARBITRUM_RPC_URL',
      optimism: 'OPTIMISM_RPC_URL',
      polygon: 'POLYGON_RPC_URL'
    };
    
    return process.env[envVars[chain] || ''] || chain.rpc_url();
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.status !== 'stopped') {
      throw new Error('Agent is already running');
    }

    this.logger.info(`Starting agent ${this.config.name}`);
    this.status = 'starting';
    this.emit('statusChanged', this.status);

    try {
      // Initialize wallet
      await this.wallet.initialize();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.status = 'running';
      this.emit('statusChanged', this.status);
      this.logger.info(`Agent ${this.config.name} started successfully`);
    } catch (error) {
      this.status = 'error';
      this.errors.push(error as Error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    this.logger.info(`Stopping agent ${this.config.name}`);
    this.status = 'stopping';
    this.emit('statusChanged', this.status);

    try {
      // Cleanup resources
      this.removeAllListeners();
      this.status = 'stopped';
      this.emit('statusChanged', this.status);
      this.logger.info(`Agent ${this.config.name} stopped`);
    } catch (error) {
      this.status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute a natural language command
   */
  async execute(prompt: string): Promise<IntentResult> {
    if (this.status !== 'running') {
      throw new Error('Agent is not running');
    }

    this.logger.info(`Executing prompt: ${prompt}`);
    this.emit('executing', prompt);

    try {
      // Parse intent from natural language
      const context = await this.buildIntentContext();
      const intentResult = await this.intentParser.parse(prompt, context);
      
      this.currentIntent = intentResult.intent;
      this.emit('intentParsed', intentResult);

      // Execute the intent
      const receipts = await this.executeIntent(intentResult.intent);
      
      this.tasksCompleted++;
      this.emit('executed', receipts);
      
      return intentResult;
    } catch (error) {
      this.errors.push(error as Error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Build intent context from current state
   */
  private async buildIntentContext() {
    const balance = await this.chainAdapter.getBalance(this.wallet.getAddress());
    const blockNumber = await this.chainAdapter.getBlockNumber();
    
    return {
      walletAddress: this.wallet.getAddress(),
      balance,
      blockNumber,
      timestamp: Date.now(),
      gasPrice: await this.chainAdapter.getGasPrice(),
      portfolio: [] // Would fetch token balances
    };
  }

  /**
   * Execute parsed intent
   */
  private async executeIntent(intent: Intent): Promise<TransactionReceipt[]> {
    const receipts: TransactionReceipt[] = [];

    for (const action of intent.actions) {
      this.logger.info(`Executing action: ${action.method} on ${action.protocol}`);
      
      try {
        const tx = await this.buildTransaction(action);
        const receipt = await this.chainAdapter.sendTransaction(tx);
        receipts.push(receipt);
        
        this.emit('actionExecuted', action, receipt);
      } catch (error) {
        this.logger.error(`Action failed: ${error}`);
        
        if (!intent.metadata.continueOnError) {
          throw error;
        }
      }
    }

    return receipts;
  }

  /**
   * Build transaction from action
   */
  private async buildTransaction(action: any): Promise<Transaction> {
    const gasPrice = await this.chainAdapter.getGasPrice();
    
    return {
      to: action.to,
      value: action.value || '0',
      data: action.data || '0x',
      gasLimit: action.gasLimit || 21000,
      gasPrice,
      nonce: await this.chainAdapter.getNonce(this.wallet.getAddress())
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Forward chain events
    this.chainAdapter.on('block', (block) => {
      this.emit('block', block);
    });

    this.chainAdapter.on('transaction', (tx) => {
      this.emit('transaction', tx);
    });
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.getAddress();
  }

  /**
   * Get tasks completed count
   */
  getTasksCompleted(): number {
    return this.tasksCompleted;
  }

  /**
   * Get errors
   */
  getErrors(): Error[] {
    return this.errors;
  }

  /**
   * Get agent config
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }
}

export { AgentConfig, AgentStatus, Strategy } from './types';
