/**
 * Intent Parser - Transforms natural language to blockchain actions
 */

import { LlmProvider, LlmResponse } from '@jlm-ai-agent/llm-provider';
import { Chain, Address } from '@jlm-ai-agent/types';
import { Logger } from '../utils/Logger';

export interface IntentContext {
  walletAddress?: string;
  balance?: string;
  blockNumber?: number;
  timestamp?: number;
  gasPrice?: string;
  portfolio?: TokenBalance[];
}

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
}

export interface Intent {
  id: string;
  actions: Action[];
  constraints: Constraint[];
  metadata: IntentMetadata;
}

export interface Action {
  protocol: string;
  method: string;
  to?: string;
  value?: string;
  data?: any;
  params?: Record<string, any>;
}

export interface Constraint {
  type: 'gas_limit' | 'max_slippage' | 'deadline' | 'max_gas_price';
  value: string;
}

export interface IntentMetadata {
  natural_language: string;
  parsed_at: number;
  model_version: string;
  confidence: number;
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  estimated_gas: number;
  warnings: string[];
}

const DEFAULT_PROMPT_TEMPLATE = `You are an intent parser for a Web3 AI Agent system.
Transform natural language commands into structured blockchain transactions.

Supported actions:
- SWAP: Exchange tokens on DEXs (Uniswap, Jupiter, etc.)
- TRANSFER: Send tokens to an address
- STAKE: Deposit tokens to yield protocols (Aave, Compound, etc.)
- MINT: Mint NFTs or tokens
- VOTE: Participate in DAO governance
- SUPPLY/BORROW: DeFi operations

Current context:
{wallet_address ? \`Wallet: {wallet_address}\` : ''}
{balance ? \`Balance: {balance}\` : ''}
{block_number ? \`Block: {block_number}\` : ''}
{gas_price ? \`Gas Price: {gas_price}\` : ''}

Output valid JSON with the following structure:
{
  "actions": [
    {
      "protocol": "string",
      "method": "string",
      "to": "address (optional)",
      "value": "amount (optional)",
      "data": {},
      "params": {}
    }
  ],
  "constraints": [
    {
      "type": "gas_limit|max_slippage|deadline",
      "value": "string"
    }
  ]
}`;

export class IntentParser {
  private readonly llmProvider: LlmProvider;
  private readonly logger: Logger;
  private readonly promptTemplate: string;

  constructor(llmProvider: LlmProvider, template?: string) {
    this.llmProvider = llmProvider;
    this.logger = new Logger('IntentParser');
    this.promptTemplate = template || DEFAULT_PROMPT_TEMPLATE;
  }

  /**
   * Parse natural language into intent
   */
  async parse(prompt: string, context: IntentContext): Promise<IntentResult> {
    this.logger.info(`Parsing intent: ${prompt}`);

    try {
      // Build prompt with context
      const fullPrompt = this.buildPrompt(prompt, context);
      
      // Call LLM
      const response = await this.llmProvider.complete({
        prompt: fullPrompt,
        temperature: 0.1,
        max_tokens: 2000
      });

      // Parse response
      const parsed = this.parseResponse(response.content);
      
      // Validate intent
      this.validateIntent(parsed);

      // Estimate gas
      const estimatedGas = this.estimateGas(parsed);

      this.logger.info(`Intent parsed successfully: ${parsed.actions.length} actions`);

      return {
        intent: {
          id: this.generateIntentId(),
          actions: parsed.actions,
          constraints: parsed.constraints || [],
          metadata: {
            natural_language: prompt,
            parsed_at: Date.now(),
            model_version: this.llmProvider.getModelVersion(),
            confidence: response.confidence || 0.9
          }
        },
        confidence: response.confidence || 0.9,
        estimated_gas: estimatedGas,
        warnings: this.generateWarnings(parsed, context)
      };
    } catch (error) {
      this.logger.error(`Intent parsing failed: ${error}`);
      throw new Error(`Failed to parse intent: ${error}`);
    }
  }

  /**
   * Build prompt with context
   */
  private buildPrompt(prompt: string, context: IntentContext): string {
    let contextStr = '';
    
    if (context.walletAddress) {
      contextStr += `Wallet: ${context.walletAddress}\n`;
    }
    if (context.balance) {
      contextStr += `Balance: ${context.balance}\n`;
    }
    if (context.blockNumber) {
      contextStr += `Block: ${context.blockNumber}\n`;
    }
    if (context.gasPrice) {
      contextStr += `Gas Price: ${context.gasPrice}\n`;
    }

    return this.promptTemplate
      .replace('{wallet_address}', context.walletAddress || '')
      .replace('{balance}', context.balance || '')
      .replace('{block_number}', String(context.blockNumber || ''))
      .replace('{gas_price}', context.gasPrice || '')
      .replace('{context}', contextStr) + `\n\nCommand: ${prompt}\n\nOutput:`;
  }

  /**
   * Parse LLM response
   */
  private parseResponse(content: string): any {
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error(`JSON parse error: ${content}`);
      throw new Error('Failed to parse LLM response as JSON');
    }
  }

  /**
   * Validate intent
   */
  private validateIntent(intent: any): void {
    if (!intent.actions || !Array.isArray(intent.actions) || intent.actions.length === 0) {
      throw new Error('Intent must have at least one action');
    }

    for (const action of intent.actions) {
      if (!action.protocol) {
        throw new Error('Action must have a protocol');
      }
      if (!action.method) {
        throw new Error('Action must have a method');
      }
    }
  }

  /**
   * Estimate gas for intent
   */
  private estimateGas(intent: any): number {
    const gasEstimates: Record<string, number> = {
      transfer: 21000,
      swap: 150000,
      mint: 100000,
      stake: 50000,
      unstake: 50000,
      vote: 30000,
      borrow: 80000,
      supply: 80000
    };

    let totalGas = 0;
    
    for (const action of intent.actions) {
      const method = action.method.toLowerCase();
      const gas = gasEstimates[method] || 100000;
      totalGas += gas;
    }

    return totalGas;
  }

  /**
   * Generate warnings based on context
   */
  private generateWarnings(intent: any, context: IntentContext): string[] {
    const warnings: string[] = [];

    // Check if wallet has sufficient balance
    if (context.balance) {
      const balance = parseFloat(context.balance);
      if (balance < 0.01) {
        warnings.push('Low wallet balance detected');
      }
    }

    // Check for high gas prices
    if (context.gasPrice) {
      const gasPrice = parseFloat(context.gasPrice);
      if (gasPrice > 100) {
        warnings.push('High gas price detected');
      }
    }

    return warnings;
  }

  /**
   * Generate unique intent ID
   */
  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export { Logger } from '../utils/Logger';
