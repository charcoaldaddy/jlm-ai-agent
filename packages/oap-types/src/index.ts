/**
 * JLM AI Agent - TypeScript Types
 */

export type Chain = 
  | 'ethereum' 
  | 'goerli' 
  | 'sepolia' 
  | 'base' 
  | 'arbitrum' 
  | 'arbitrum-nova'
  | 'optimism' 
  | 'polygon' 
  | 'avalanche' 
  | 'bsc' 
  | 'solana' 
  | 'cosmos' 
  | 'osmosis' 
  | 'sui' 
  | 'aptos';

export interface Address {
  chain: Chain;
  address: string;
}

export interface Transaction {
  to: string;
  value: string;
  data: string;
  gasLimit: number;
  gasPrice: string;
  nonce: number;
  chainId?: number;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  status: boolean;
  gasUsed: number;
  logs: Log[];
}

export interface Log {
  address: string;
  topics: string[];
  data: string;
}

export interface Block {
  number: number;
  hash: string;
  timestamp: number;
  gasLimit: number;
  gasUsed: number;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
}

export interface Wallet {
  address: string;
  chain: Chain;
}

export interface ChainAdapter {
  getBalance(address: string): Promise<string>;
  getBlockNumber(): Promise<number>;
  getGasPrice(): Promise<string>;
  sendTransaction(tx: Transaction): Promise<TransactionReceipt>;
  getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null>;
}
