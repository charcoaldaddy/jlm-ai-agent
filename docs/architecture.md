# Architecture

## Overview

Omni-Agent Protocol (OAP) is designed as a multi-layered system combining high-performance Rust core with flexible TypeScript application layer.

## Core Layers

### 1. Rust Runtime (`packages/oap-core-rust`)

The core runtime provides:
- Neural intent parsing
- Swarm orchestration  
- Secure transaction execution
- MPC wallet management

### 2. TypeScript Engine (`packages/oap-engine-ts`)

Business logic layer featuring:
- Agent management
- Plugin system
- Event handling
- Chain adapters

### 3. Adapters (`adapters/`)

Chain-specific implementations:
- EVM (Ethereum, Base, Arbitrum, etc.)
- Solana
- Cosmos
- Sui

### 4. Plugins (`plugins/`)

Extensible functionality:
- Uniswap - DEX trading
- Twitter - Social automation
- DAO Governance - Snapshot integration
- Analytics - On-chain data

## Data Flow

```
User Input → Intent Parser → Agent → Execution Sentinel → Blockchain
                ↓
         Swarm Orchestrator → Multiple Agents
                ↓
         Plugin System → External Services
```

## Security

- MPC-based key management
- TEE integration for sensitive operations
- MEV protection
- Gas optimization
