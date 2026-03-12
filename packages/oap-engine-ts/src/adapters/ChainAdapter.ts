/**
 * Chain Adapter - Abstract interface for blockchain interactions
 */

import { EventEmitter } from 'events';
import { Chain, Transaction, TransactionReceipt, Block } from '@jlm-ai-agent/types';

export interface ChainAdapterConfig {
  chain: Chain;
  rpcUrl: string;
  wsUrl?: string;
}

export abstract class ChainAdapter extends EventEmitter {
  protected readonly config: ChainAdapterConfig;

  constructor(config: ChainAdapterConfig) {
    super();
    this.config = config;
  }

  /**
   * Get balance for address
   */
  abstract getBalance(address: string): Promise<string>;

  /**
   * Get block number
   */
  abstract getBlockNumber(): Promise<number>;

  /**
   * Get gas price
   */
  abstract getGasPrice(): Promise<string>;

  /**
   * Send transaction
   */
  abstract sendTransaction(tx: Transaction): Promise<TransactionReceipt>;

  /**
   * Get transaction receipt
   */
  abstract getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null>;

  /**
   * Get nonce for address
   */
  abstract getNonce(address: string): Promise<number>;

  /**
   * Call contract
   */
  abstract call(to: string, data: string): Promise<string>;

  /**
   * Subscribe to new blocks
   */
  abstract subscribeBlocks(callback: (block: Block) => void): Promise<void>;

  /**
   * Subscribe to pending transactions
   */
  abstract subscribePendingTransactions(callback: (txHash: string) => void): Promise<void>;
}
