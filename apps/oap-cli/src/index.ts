/**
 * JLM AI Agent CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Engine, AgentConfig } from '@jlm-ai-agent/engine';
import { Wallet } from '@jlm-ai-agent/wallet-mpc';

const program = new Command();

program
  .name('jlm')
  .description('JLM AI Agent CLI')
  .version('1.0.0');

program
  .command('agent')
  .description('Manage agents')
  .action(() => {
    console.log(chalk.blue('Agent Management'));
  });

program
  .command('spawn')
  .description('Spawn a new agent')
  .option('-n, --name <name>', 'Agent name')
  .option('-c, --chain <chain>', 'Chain (ethereum, solana, etc.)')
  .option('-s, --strategy <strategy>', 'Strategy (arbitrage, yield, etc.)')
  .action(async (options) => {
    console.log(chalk.green('Spawning new agent...'));
    
    const engine = new Engine();
    await engine.initialize();
    
    const wallet = Wallet.fromMpcShards([
      process.env.MPC_KEY_SHARD_1 || '',
      process.env.MPC_KEY_SHARD_2 || ''
    ]);
    
    const config: AgentConfig = {
      id: '',
      name: options.name || 'cli-agent',
      chain: options.chain || 'ethereum',
      strategy: options.strategy || 'default',
      llmProvider: { provider: 'openai' },
      wallet
    };
    
    const agent = await engine.createAgent(config);
    await agent.start();
    
    console.log(chalk.green(`Agent ${agent.getId()} spawned successfully!`));
  });

program
  .command('list')
  .description('List all agents')
  .action(async () => {
    const engine = new Engine();
    await engine.initialize();
    
    const agents = engine.getAllAgents();
    
    console.log(chalk.blue(`Total agents: ${agents.length}`));
    
    for (const agent of agents) {
      console.log(`- ${agent.getId()}: ${agent.getAddress()}`);
    }
  });

program
  .command('execute')
  .description('Execute command with agent')
  .argument('<agentId>', 'Agent ID')
  .argument('<prompt>', 'Command prompt')
  .action(async (agentId, prompt) => {
    const engine = new Engine();
    await engine.initialize();
    
    const agent = engine.getAgent(agentId);
    
    if (!agent) {
      console.log(chalk.red(`Agent ${agentId} not found`));
      return;
    }
    
    console.log(chalk.blue('Executing...'));
    const result = await agent.execute(prompt);
    
    console.log(chalk.green('Success!'));
    console.log(result);
  });

program
  .command('swarm')
  .description('Manage swarms')
  .action(() => {
    console.log(chalk.blue('Swarm Management'));
  });

program
  .parse();
