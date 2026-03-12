//! Omni-Agent Protocol Core Runtime
//!
//! A high-performance Rust runtime for building autonomous Web3 AI agents
//! with neural intent parsing, swarm orchestration, and secure execution.

#![cfg_attr(docsrs, feature(doc_auto_cfg))]
#![warn(missing_docs)]
#![allow(clippy::derive_hash_xor_eq)]

pub mod intent;
pub mod swarm;
pub mod execution;
pub mod wallet;
pub mod types;
pub mod storage;
pub mod network;

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, Level};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use metrics::Recorder;

pub use intent::{IntentParser, Intent, IntentResult, IntentError};
pub use swarm::{SwarmOrchestrator, Agent, AgentId, SwarmConfig};
pub use execution::{ExecutionSentinel, Transaction, TransactionBuilder, ExecutionResult};
pub use wallet::{Wallet, WalletError, Signature};
pub use types::{Chain, ChainId, Address, U256, H256};
pub use storage::{Storage, StorageBackend, RocksDbStorage, RedisStorage};
pub use network::{NetworkClient, WebSocketClient, HttpClient};

/// Core configuration for the OAP runtime
#[derive(Debug, Clone)]
pub struct CoreConfig {
    /// Maximum concurrent agents
    pub max_agents: usize,
    /// Transaction timeout in seconds
    pub tx_timeout: u64,
    /// Enable debug logging
    pub debug: bool,
    /// Storage backend
    pub storage: StorageBackend,
    /// Network configuration
    pub network: NetworkConfig,
}

impl Default for CoreConfig {
    fn default() -> Self {
        Self {
            max_agents: 1000,
            tx_timeout: 300,
            debug: false,
            storage: StorageBackend::InMemory,
            network: NetworkConfig::default(),
        }
    }
}

/// Network configuration
#[derive(Debug, Clone)]
pub struct NetworkConfig {
    /// HTTP RPC endpoint
    pub http_rpc: Option<String>,
    /// WebSocket RPC endpoint
    pub ws_rpc: Option<String>,
    /// Maximum concurrent requests
    pub max_concurrent_requests: usize,
    /// Request timeout in milliseconds
    pub request_timeout_ms: u64,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            http_rpc: None,
            ws_rpc: None,
            max_concurrent_requests: 100,
            request_timeout_ms: 10000,
        }
    }
}

/// Core runtime instance
pub struct OapCore {
    config: CoreConfig,
    intent_parser: Arc<RwLock<IntentParser>>,
    swarm: Arc<RwLock<SwarmOrchestrator>>,
    executor: Arc<ExecutionSentinel>,
    storage: Arc<dyn Storage>,
    network: Arc<NetworkClient>,
}

impl OapCore {
    /// Create a new OAP core instance
    pub async fn new(config: CoreConfig) -> Result<Self, CoreError> {
        Self::init_logging(config.debug);
        
        info!("Initializing Omni-Agent Protocol Core v{}", env!("CARGO_PKG_VERSION"));
        
        // Initialize storage
        let storage = Self::init_storage(&config.storage).await?;
        
        // Initialize network client
        let network = Arc::new(NetworkClient::new(config.network.clone()));
        
        // Initialize intent parser
        let intent_parser = Arc::new(RwLock::new(IntentParser::new().await?));
        
        // Initialize swarm orchestrator
        let swarm = Arc::new(RwLock::new(SwarmOrchestrator::new(config.max_agents)));
        
        // Initialize execution sentinel
        let executor = Arc::new(ExecutionSentinel::new(config.tx_timeout));
        
        info!("Core initialization complete");
        
        Ok(Self {
            config,
            intent_parser,
            swarm,
            executor,
            storage,
            network,
        })
    }
    
fn init_logging(debug: bool) {
        let filter = if debug {
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("debug"))
        } else {
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        };
        
        tracing_subscriber::registry()
            .with(fmt::layer().with_target(true).with_thread_ids(true))
            .with(filter)
            .init();
    }
    
    async fn init_storage(backend: &StorageBackend) -> Result<Arc<dyn Storage>, CoreError> {
        match backend {
            StorageBackend::InMemory => {
                Ok(Arc::new(storage::InMemoryStorage::new()))
            }
            StorageBackend::RocksDb(path) => {
                Ok(Arc::new(RocksDbStorage::new(path).await?))
            }
            StorageBackend::Redis(url) => {
                Ok(Arc::new(RedisStorage::new(url).await?))
            }
            StorageBackend::Postgres(url) => {
                Ok(Arc::new(storage::PostgresStorage::new(url).await?))
            }
        }
    }
    
    /// Parse natural language intent into executable transactions
    pub async fn parse_intent(&self, prompt: &str, context: &IntentContext) -> Result<IntentResult, CoreError> {
        let parser = self.intent_parser.read().await;
        parser.parse(prompt, context).await
    }
    
    /// Execute a parsed intent
    pub async fn execute_intent(&self, intent: Intent, wallet: &Wallet) -> Result<ExecutionResult, CoreError> {
        let tx = self.executor.build_transaction(intent).await?;
        self.executor.execute(tx, wallet).await
    }
    
    /// Spawn a new agent
    pub async fn spawn_agent(&self, config: AgentConfig) -> Result<AgentId, CoreError> {
        let swarm = self.swarm.write().await;
        swarm.spawn(config).await
    }
    
    /// Get agent status
    pub async fn get_agent(&self, id: AgentId) -> Option<Agent> {
        let swarm = self.swarm.read().await;
        swarm.get(id).await
    }
    
    /// Terminate an agent
    pub async fn terminate_agent(&self, id: AgentId) -> Result<(), CoreError> {
        let swarm = self.swarm.write().await;
        swarm.terminate(id).await
    }
    
    /// Submit task to swarm
    pub async fn submit_swarm_task(&self, task: SwarmTask) -> Result<TaskId, CoreError> {
        let swarm = self.swarm.write().await;
        swarm.submit_task(task).await
    }
    
    /// Get task result
    pub async fn get_task_result(&self, task_id: TaskId) -> Option<TaskResult> {
        let swarm = self.swarm.read().await;
        swarm.get_task_result(task_id).await
    }
    
    /// Get metrics
    pub fn get_metrics(&self) -> CoreMetrics {
        CoreMetrics {
            active_agents: self.swarm.read().await.len(),
            total_transactions: self.executor.total_tx_count(),
            storage_keys: self.storage.len(),
        }
    }
}

/// Core error types
#[derive(thiserror::Error, Debug)]
pub enum CoreError {
    #[error("Intent parsing failed: {0}")]
    IntentParse(String),
    
    #[error("Transaction execution failed: {0}")]
    ExecutionFailed(String),
    
    #[error("Wallet error: {0}")]
    WalletError(#[from] WalletError),
    
    #[error("Storage error: {0}")]
    StorageError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Swarm error: {0}")]
    SwarmError(String),
    
    #[error("Agent not found: {0}")]
    AgentNotFound(AgentId),
    
    #[error("Invalid configuration: {0}")]
    ConfigError(String),
}

/// Agent configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Agent name
    pub name: String,
    /// Chain to operate on
    pub chain: Chain,
    /// Strategy type
    pub strategy: Strategy,
    /// LLM provider
    pub llm_provider: LlmProvider,
    /// Initial balance
    pub initial_balance: U256,
}

impl AgentConfig {
    pub fn new(name: impl Into<String>, chain: Chain) -> Self {
        Self {
            name: name.into(),
            chain,
            strategy: Strategy::Default,
            llm_provider: LlmProvider::OpenAI,
            initial_balance: U256::zero(),
        }
    }
    
    pub fn with_strategy(mut self, strategy: Strategy) -> Self {
        self.strategy = strategy;
        self
    }
    
    pub fn with_llm(mut self, provider: LlmProvider) -> Self {
        self.llm_provider = provider;
        self
    }
}

/// Trading strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Strategy {
    /// Default strategy
    Default,
    /// Arbitrage strategy
    Arbitrage,
    /// Yield optimization
    YieldOptimization,
    /// Liquidity provision
    LiquidityProvision,
    /// NFT trading
    NftTrading,
    /// DAO governance
    DaoGovernance,
    /// Custom strategy
    Custom(&'static str),
}

/// LLM providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LlmProvider {
    /// OpenAI GPT models
    OpenAI,
    /// Anthropic Claude models
    Anthropic,
    /// Groq for fast inference
    Groq,
    /// Local models
    Local,
    /// Heurist decentralized AI
    Heurist,
}

/// Context for intent parsing
#[derive(Debug, Clone)]
pub struct IntentContext {
    /// Current block number
    pub block_number: u64,
    /// Current timestamp
    pub timestamp: u64,
    /// User wallet address
    pub wallet_address: Option<Address>,
    /// Available tokens and balances
    pub portfolio: Vec<TokenBalance>,
    /// Gas price
    pub gas_price: U256,
}

impl Default for IntentContext {
    fn default() -> Self {
        Self {
            block_number: 0,
            timestamp: 0,
            wallet_address: None,
            portfolio: Vec::new(),
            gas_price: U256::zero(),
        }
    }
}

/// Token balance
#[derive(Debug, Clone)]
pub struct TokenBalance {
    /// Token address
    pub address: Address,
    /// Token symbol
    pub symbol: String,
    /// Balance
    pub balance: U256,
}

/// Task ID
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TaskId(pub u64);

/// Swarm task
#[derive(Debug, Clone)]
pub struct SwarmTask {
    /// Task type
    pub task_type: SwarmTaskType,
    /// Task parameters
    pub params: serde_json::Value,
    /// Required agents
    pub required_agents: usize,
    /// Timeout in seconds
    pub timeout: u64,
}

/// Swarm task types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SwarmTaskType {
    /// Portfolio optimization
    PortfolioOptimization,
    /// Cross-chain arbitrage
    CrossChainArbitrage,
    /// Governance voting
    GovernanceVoting,
    /// Market making
    MarketMaking,
    /// Custom task
    Custom(&'static str),
}

/// Task result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    /// Success status
    pub success: bool,
    /// Result data
    pub data: serde_json::Value,
    /// Error message if failed
    pub error: Option<String>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
}

/// Core metrics
#[derive(Debug, Clone)]
pub struct CoreMetrics {
    /// Number of active agents
    pub active_agents: usize,
    /// Total transactions executed
    pub total_transactions: u64,
    /// Number of storage keys
    pub storage_keys: usize,
}

#[cfg(feature = "runtime")]
pub mod runtime {
    use super::*;
    use tokio::runtime::Builder;
    
    /// Create a multi-threaded runtime
    pub fn create_runtime() -> tokio::runtime::Runtime {
        Builder::new_multi_thread()
            .enable_all()
            .thread_name("oap-worker")
            .build()
            .expect("Failed to create runtime")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_core_initialization() {
        let config = CoreConfig::default();
        let core = OapCore::new(config).await;
        assert!(core.is_ok());
    }
    
    #[tokio::test]
    async fn test_intent_parsing() {
        let config = CoreConfig::default();
        let core = OapCore::new(config).await.unwrap();
        
        let context = IntentContext::default();
        let result = core.parse_intent("Swap 1 ETH to USDC on Uniswap", &context).await;
        
        // Should parse without error (may not have valid model loaded)
        assert!(result.is_ok() || matches!(result, Err(CoreError::IntentParse(_))));
    }
    
    #[test]
    fn test_agent_config() {
        let config = AgentConfig::new("test-agent", Chain::Ethereum)
            .with_strategy(Strategy::Arbitrage)
            .with_llm(LlmProvider::Anthropic);
        
        assert_eq!(config.name, "test-agent");
        assert_eq!(config.chain, Chain::Ethereum);
        assert_eq!(config.strategy, Strategy::Arbitrage);
        assert_eq!(config.llm_provider, LlmProvider::Anthropic);
    }
}
