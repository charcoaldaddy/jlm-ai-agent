/**
 * EVM Chain Adapter - For Ethereum and EVM-compatible chains
 */

import { ChainAdapter, ChainAdapterConfig } from './ChainAdapter';
import { Chain, Transaction, TransactionReceipt, Block } from '@jlm-ai-agent/types';
import axios from 'axios';

export interface EvmConfig extends ChainAdapterConfig {
  chain: Chain;
}

export class EvmAdapter extends ChainAdapter {
  private readonly chain: Chain;

  constructor(config: EvmConfig) {
    super(config);
    this.chain = config.chain;
  }

  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    const response = await axios.post(this.config.rpcUrl, {
      jsonrpc: '2.0',
      method,
      params,
      id: 1
    });
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    return response.data.result;
  }

  async getBalance(address: string): Promise<string> {
    const result = await this.rpcCall('eth_getBalance', [address, 'latest']);
    return result;
  }

  async getBlockNumber(): Promise<number> {
    const result = await this.rpcCall('eth_blockNumber');
    return parseInt(result, 16);
  }

  async getGasPrice(): Promise<string> {
    return await this.rpcCall('eth_gasPrice');
  }

  async sendTransaction(tx: Transaction): Promise<TransactionReceipt> {
    // Would sign and send transaction
    const txHash = await this.rpcCall('eth_sendRawTransaction', [tx.data]);
    
    // Wait for receipt
    return this.getTransactionReceipt(txHash) as Promise<TransactionReceipt>;
  }

  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    const receipt = await this.rpcCall('eth_getTransactionReceipt', [txHash]);
    
    if (!receipt) return null;
    
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: parseInt(receipt.blockNumber, 16),
      blockHash: receipt.blockHash,
      status: receipt.status === '0x1',
      gasUsed: parseInt(receipt.gasUsed, 16),
      logs: receipt.logs || []
    };
  }

  async getNonce(address: string): Promise<number> {
    const result = await this.rpcCall('eth_getTransactionCount', [address, 'latest']);
    return parseInt(result, 16);
  }

  async call(to: string, data: string): Promise<string> {
    return await this.rpcCall('eth_call', [{ to, data }, 'latest']);
  }

  async subscribeBlocks(callback: (block: Block) => void): Promise<void> {
    // Would use WebSocket for real-time
    throw new Error('Not implemented');
  }

  async subscribePendingTransactions(callback: (txHash: string) => void): Promise<void> {
    throw new Error('Not implemented');
  }
}
