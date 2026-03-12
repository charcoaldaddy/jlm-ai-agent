//! Common types for OAP

use serde::{Deserialize, Serialize};
use std::fmt;

/// Chain type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Chain {
    /// Ethereum Mainnet
    Ethereum,
    /// Goerli Testnet
    Goerli,
    /// Sepolia Testnet
    Sepolia,
    /// Base
    Base,
    /// Arbitrum One
    Arbitrum,
    /// Arbitrum Nova
    ArbitrumNova,
    /// Optimism
    Optimism,
    /// Polygon
    Polygon,
    /// Avalanche
    Avalanche,
    /// BNB Smart Chain
    Bsc,
    /// Solana
    Solana,
    /// Cosmos Hub
    Cosmos,
    /// Osmosis
    Osmosis,
    /// Sui
    Sui,
    /// Aptos
    Aptos,
    /// Custom chain
    Custom(u64),
}

impl Chain {
    /// Get chain ID
    pub fn id(&self) -> ChainId {
        match self {
            Chain::Ethereum => ChainId(1),
            Chain::Goerli => ChainId(5),
            Chain::Sepolia => ChainId(11155111),
            Chain::Base => ChainId(8453),
            Chain::Arbitrum => ChainId(42161),
            Chain::ArbitrumNova => ChainId(42170),
            Chain::Optimism => ChainId(10),
            Chain::Polygon => ChainId(137),
            Chain::Avalanche => ChainId(43114),
            Chain::Bsc => ChainId(56),
            Chain::Solana => ChainId(0), // Special case
            Chain::Cosmos => ChainId(0),
            Chain::Osmosis => ChainId(0),
            Chain::Sui => ChainId(0),
            Chain::Aptos => ChainId(0),
            Chain::Custom(id) => ChainId(*id),
        }
    }
    
    /// Get chain name
    pub fn name(&self) -> &'static str {
        match self {
            Chain::Ethereum => "ethereum",
            Chain::Goerli => "goerli",
            Chain::Sepolia => "sepolia",
            Chain::Base => "base",
            Chain::Arbitrum => "arbitrum",
            Chain::ArbitrumNova => "arbitrum-nova",
            Chain::Optimism => "optimism",
            Chain::Polygon => "polygon",
            Chain::Avalanche => "avalanche",
            Chain::Bsc => "bsc",
            Chain::Solana => "solana",
            Chain::Cosmos => "cosmos",
            Chain::Osmosis => "osmosis",
            Chain::Sui => "sui",
            Chain::Aptos => "aptos",
            Chain::Custom(_) => "custom",
        }
    }
    
    /// Get RPC URL (placeholder)
    pub fn rpc_url(&self) -> &'static str {
        match self {
            Chain::Ethereum => "https://eth.llamarpc.com",
            Chain::Base => "https://mainnet.base.org",
            Chain::Arbitrum => "https://arb1.arbitrum.io/rpc",
            Chain::Solana => "https://api.mainnet-beta.solana.com",
            _ => "",
        }
    }
}

impl fmt::Display for Chain {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.name())
    }
}

impl Default for Chain {
    fn default() -> Self {
        Self::Ethereum
    }
}

/// Chain ID
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChainId(pub u64);

impl ChainId {
    pub fn as_u64(&self) -> u64 {
        self.0
    }
    
    pub fn as_bytes(&self) -> [u8; 8] {
        self.0.to_le_bytes()
    }
}

impl From<u64> for ChainId {
    fn from(id: u64) -> Self {
        Self(id)
    }
}

impl From<ChainId> for u64 {
    fn from(id: ChainId) -> Self {
        id.0
    }
}

/// Ethereum address
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Address(pub [u8; 20]);

impl Address {
    pub fn zero() -> Self {
        Self([0u8; 20])
    }
    
    pub fn from_hex(hex: &str) -> Result<Self, ()> {
        let hex = hex.trim_start_matches("0x");
        let bytes = hex::decode(hex).map_err(|_| ())?;
        
        if bytes.len() != 20 {
            return Err(());
        }
        
        let mut addr = [0u8; 20];
        addr.copy_from_slice(&bytes);
        
        Ok(Self(addr))
    }
    
    pub fn as_bytes(&self) -> &[u8; 20] {
        &self.0
    }
}

impl fmt::Display for Address {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{}", hex::encode(self.0))
    }
}

impl Default for Address {
    fn default() -> Self {
        Self::zero()
    }
}

/// U256 for large numbers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct U256(pub [u64; 4]);

impl U256 {
    pub fn zero() -> Self {
        Self([0u64; 4])
    }
    
    pub fn one() -> Self {
        Self([1u64, 0, 0, 0])
    }
    
    pub fn from_u64(val: u64) -> Self {
        Self([val, 0, 0, 0])
    }
    
    pub fn from_dec_str(s: &str) -> Result<Self, ()> {
        let val: u64 = s.parse().map_err(|_| ())?;
        Ok(Self::from_u64(val))
    }
    
    pub fn as_u64(&self) -> u64 {
        self.0[0]
    }
    
    pub fn as_bytes(&self) -> [u8; 32] {
        let mut bytes = [0u8; 32];
        for (i, chunk) in self.0.iter().enumerate() {
            bytes[i * 8..(i + 1) * 8].copy_from_slice(&chunk.to_le_bytes());
        }
        bytes
    }
}

impl fmt::Display for U256 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0[0])
    }
}

impl Default for U256 {
    fn default() -> Self {
        Self::zero()
    }
}

impl std::ops::Add for U256 {
    type Output = Self;
    
    fn add(self, other: Self) -> Self {
        let mut result = [0u64; 4];
        let mut carry = 0u128;
        
        for i in 0..4 {
            let sum = carry + self.0[i] as u128 + other.0[i] as u128;
            result[i] = sum as u64;
            carry = sum >> 64;
        }
        
        Self(result)
    }
}

impl std::ops::Sub for U256 {
    type Output = Self;
    
    fn sub(self, other: Self) -> Self {
        let mut result = [0u64; 4];
        let mut borrow = 0i128;
        
        for i in 0..4 {
            let diff = self.0[i] as i128 - other.0[i] as i128 - borrow;
            if diff < 0 {
                result[i] = (diff + (1i128 << 64)) as u64;
                borrow = 1;
            } else {
                result[i] = diff as u64;
                borrow = 0;
            }
        }
        
        Self(result)
    }
}

/// H256 for hashes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct H256(pub [u8; 32]);

impl H256 {
    pub fn zero() -> Self {
        Self([0u8; 32])
    }
    
    pub fn from_slice(s: &[u8]) -> Self {
        let mut hash = [0u8; 32];
        hash.copy_from_slice(s);
        Self(hash)
    }
    
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl fmt::Display for H256 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{}", hex::encode(self.0))
    }
}

impl Default for H256 {
    fn default() -> Self {
        Self::zero()
    }
}

/// Block information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub number: u64,
    pub hash: H256,
    pub timestamp: u64,
    pub gas_limit: u64,
    pub gas_used: u64,
}

/// Transaction receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionReceipt {
    pub tx_hash: H256,
    pub block_number: u64,
    pub block_hash: H256,
    pub status: bool,
    pub gas_used: u64,
    pub logs: Vec<Log>,
}

/// Log event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Log {
    pub address: Address,
    pub topics: Vec<H256>,
    pub data: Vec<u8>,
}

/// Token information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub address: Address,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub total_supply: U256,
}

/// Token balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub token: Token,
    pub balance: U256,
}
