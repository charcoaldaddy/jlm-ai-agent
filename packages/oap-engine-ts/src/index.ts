/**
 * JLM AI Agent - TypeScript Engine
 * 
 * High-level API for building AI-powered Web3 agents
 */

export { Agent } from './agent/Agent';
export { AgentConfig, AgentStatus, Strategy } from './agent/types';
export { Engine } from './engine/Engine';
export { IntentParser } from './intent/IntentParser';
export { SwarmOrchestrator } from './swarm/SwarmOrchestrator';
export { PluginManager } from './plugin/PluginManager';
export { EventBus } from './events/EventBus';
export { Logger } from './utils/Logger';

// Re-export types
export type { 
  Chain, 
  Address, 
  Transaction, 
  TransactionReceipt,
  TokenBalance,
  Intent,
  IntentResult,
  Action,
  CallData
} from '@jlm-ai-agent/types';

// Re-export adapters
export { SolanaAdapter } from './adapters/SolanaAdapter';
export { EvmAdapter } from './adapters/EvmAdapter';
