/**
 * Agent types
 */

import { Chain, Wallet } from '@omni-agent-protocol/types';
import { LlmProvider } from '@omni-agent-protocol/llm-provider';

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Chain to operate on */
  chain: Chain;
  /** Strategy type */
  strategy: Strategy;
  /** LLM provider configuration */
  llmProvider: LlmProvider;
  /** Wallet instance */
  wallet: Wallet;
  /** Initial balance */
  initialBalance?: string;
  /** Maximum gas price */
  maxGasPrice?: string;
  /** Enable MEV protection */
  mevProtection?: boolean;
  /** Custom plugins */
  plugins?: string[];
  /** Agent metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent status
 */
export type AgentStatus = 
  | 'stopped' 
  | 'starting' 
  | 'running' 
  | 'paused' 
  | 'stopping' 
  | 'error';

/**
 * Strategy types
 */
export enum Strategy {
  Default = 'default',
  Arbitrage = 'arbitrage',
  YieldOptimization = 'yield_optimization',
  LiquidityProvision = 'liquidity_provision',
  NftTrading = 'nft_trading',
  DaoGovernance = 'dao_governance',
  MarketMaking = 'market_making',
  Custom = 'custom'
}

/**
 * Agent statistics
 */
export interface AgentStats {
  id: string;
  name: string;
  status: AgentStatus;
  chain: Chain;
  strategy: Strategy;
  tasksCompleted: number;
  tasksFailed: number;
  uptime: number;
  totalGasUsed: string;
  totalVolume: string;
  lastActivity: number;
}

/**
 * Agent event types
 */
export interface AgentEvents {
  statusChanged: (status: AgentStatus) => void;
  executing: (prompt: string) => void;
  intentParsed: (resultResult) => void;
  actionExecut: Intented: (action: Action, receipt: TransactionReceipt) => void;
  executed: (receipts: TransactionReceipt[]) => void;
  error: (error: Error) => void;
  block: (block: Block) => void;
  transaction: (tx: Transaction) => void;
}

/**
 * Re-export types from other modules
 */
export type { Intent, IntentResult } from '../intent/types';
export type { TransactionReceipt, Block, Transaction } from '@omni-agent-protocol/types';
export type { Action } from '../intent/types';

import type { Intent, IntentResult } from '../intent/types';
import type { TransactionReceipt, Block, Transaction } from '@omni-agent-protocol/types';
import type { Action } from '../intent/types';
