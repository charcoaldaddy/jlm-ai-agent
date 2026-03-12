/**
 * Solana Adapter - For Solana blockchain
 */

import { ChainAdapter, ChainAdapterConfig } from './ChainAdapter';
import { Transaction, TransactionReceipt, Block } from '@jlm-ai-agent/types';
import { Connection, PublicKey } from '@solana/web3.js';

export interface SolanaConfig extends ChainAdapterConfig {
  rpcUrl: string;
}

export class SolanaAdapter extends ChainAdapter {
  private readonly connection: Connection;

  constructor(config: SolanaConfig) {
    super({ chain: 'solana', rpcUrl: config.rpcUrl });
    this.connection = new Connection(config.rpcUrl);
  }

  async getBalance(address: string): Promise<string> {
    const pubkey = new PublicKey(address);
    const balance = await this.connection.getBalance(pubkey);
    return balance.toString();
  }

  async getBlockNumber(): Promise<number> {
    const slot = await this.connection.getSlot();
    return slot;
  }

  async getGasPrice(): Promise<string> {
    // Solana uses compute units instead of gas
    const fees = await this.connection.getRecentBlockhash();
    return fees.feeCalculator.lamportsPerSignature.toString();
  }

  async sendTransaction(tx: Transaction): Promise<TransactionReceipt> {
    throw new Error('Not implemented - requires signed transaction');
  }

  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    try {
      const tx = await this.connection.getParsedTransaction(txHash);
      if (!tx) return null;
      
      return {
        transactionHash: txHash,
        blockNumber: tx.slot,
        blockHash: '',
        status: tx.meta?.err === null,
        gasUsed: tx.meta?.fee || 0,
        logs: []
      };
    } catch {
      return null;
    }
  }

  async getNonce(address: string): Promise<number> {
    const pubkey = new PublicKey(address);
    const info = await this.connection.getParsedAccountInfo(pubkey);
    return (info.value?.lamports || 0);
  }

  async call(to: string, data: string): Promise<string> {
    throw new Error('Not implemented for Solana');
  }

  async subscribeBlocks(callback: (block: Block) => void): Promise<void> {
    this.connection.on('block', (slot) => {
      callback({ number: slot, hash: '', timestamp: 0, gasLimit: 0, gasUsed: 0 });
    });
  }

  async subscribePendingTransactions(callback: (txHash: string) => void): Promise<void> {
    this.connection.on('pending', callback);
  }
}
