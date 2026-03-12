/**
 * Yield Optimizer Example
 * 
 * Automatically optimizes yield across DeFi protocols
 */

import { Engine, Agent, AgentConfig } from '@jlm-ai-agent/engine';
import { Wallet } from '@jlm-ai-agent/wallet-mpc';

async function main() {
  console.log('Starting Yield Optimizer...');
  
  const engine = new Engine({ defaultChain: 'ethereum' });
  await engine.initialize();
  
  const wallet = Wallet.fromMpcShards([
    process.env.MPC_KEY_SHARD_1!,
    process.env.MPC_KEY_SHARD_2!
  ]);
  
  const config: AgentConfig = {
    id: '',
    name: 'yield-optimizer',
    chain: 'ethereum',
    strategy: 'yield_optimization',
    llmProvider: { provider: 'openai' },
    wallet
  };
  
  const agent = await engine.createAgent(config);
  await agent.start();
  
  console.log('Yield optimizer started!');
  
  // Check and optimize
  while (true) {
    await agent.execute('Check my portfolio and find better yield opportunities');
    await sleep(3600000); // Check every hour
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
