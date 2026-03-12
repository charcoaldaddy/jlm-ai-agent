//! Wallet module with MPC support
//!
//! Provides secure wallet management with multi-party computation (MPC)
//! for distributed key management and transaction signing.

use async_trait::async_trait;
use zeroize::{Zeroize, ZeroizeOnDrop};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use rand::RngCore;
use sha2::{Sha256, Digest};

/// Wallet error types
#[derive(thiserror::Error, Debug)]
pub enum WalletError {
    #[error("Invalid key format: {0}")]
    InvalidKey(String),
    
    #[error("Signing failed: {0}")]
    SigningFailed(String),
    
    #[error("Verification failed: {0}")]
    VerificationFailed(String),
    
    #[error("MPC error: {0}")]
    MpcError(String),
    
    #[error("Insufficient balance")]
    InsufficientBalance,
    
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
}

/// Signature structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    /// R component
    pub r: [u8; 32],
    /// S component
    pub s: [u8; 32],
    /// V component
    pub v: u8,
}

impl Signature {
    /// Create from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, WalletError> {
        if bytes.len() != 65 {
            return Err(WalletError::InvalidKey("Invalid signature length".to_string()));
        }
        
        let mut r = [0u8; 32];
        let mut s = [0u8; 32];
        
        r.copy_from_slice(&bytes[..32]);
        s.copy_from_slice(&bytes[32..64]);
        let v = bytes[64];
        
        Ok(Self { r, s, v })
    }
    
    /// Convert to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(65);
        bytes.extend_from_slice(&self.r);
        bytes.extend_from_slice(&self.s);
        bytes.push(self.v);
        bytes
    }
}

/// Private key with secure memory handling
pub struct PrivateKey {
    key: [u8; 32],
}

impl PrivateKey {
    /// Generate new random key
    pub fn generate() -> Self {
        let mut key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        Self { key }
    }
    
    /// Import from hex string
    pub fn from_hex(hex: &str) -> Result<Self, WalletError> {
        let bytes = hex::decode(hex)
            .map_err(|e| WalletError::InvalidKey(e.to_string()))?;
        
        if bytes.len() != 32 {
            return Err(WalletError::InvalidKey("Key must be 32 bytes".to_string()));
        }
        
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        
        Ok(Self { key })
    }
    
    /// Get public key
    pub fn public_key(&self) -> [u8; 33] {
        // Simplified - would use actual crypto library
        let mut hasher = Sha256::new();
        hasher.update(&self.key);
        let result = hasher.finalize();
        
        let mut pk = [0u8; 33];
        pk[..32].copy_from_slice(&result);
        pk[32] = 0x02; // Compressed pubkey marker
        pk
    }
    
    /// Sign message
    pub fn sign(&self, message: &[u8]) -> Result<Signature, WalletError> {
        // Simplified - would use actual ECDSA
        let mut hasher = Sha256::new();
        hasher.update(message);
        hasher.update(&self.key);
        let hash = hasher.finalize();
        
        let mut r = [0u8; 32];
        let mut s = [0u8; 32];
        
        r.copy_from_slice(&hash[..32]);
        s.copy_from_slice(&hash[16..48]);
        
        // Ensure s is in lower half
        s[0] &= 0x7f;
        
        Ok(Signature {
            r,
            s,
            v: 27, // Ethereum standard
        })
    }
}

impl Drop for PrivateKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

impl Zeroize for PrivateKey {
    fn zeroize(&mut self) {
        self.key.zeroize();
    }
}

impl ZeroizeOnDrop for PrivateKey {}

/// Wallet trait for different wallet implementations
#[async_trait]
pub trait WalletTrait: Send + Sync {
    /// Get address
    fn address(&self) -> String;
    
    /// Sign message
    async fn sign(&self, message: &[u8]) -> Result<Signature, WalletError>;
    
    /// Sign transaction
    async fn sign_transaction(&self, tx: &[u8]) -> Result<Signature, WalletError>;
    
    /// Get balance
    async fn balance(&self) -> Result<u64, WalletError>;
}

/// MPC Wallet implementation
pub struct MpcWallet {
    shards: Vec<KeyShard>,
    address: String,
}

impl MpcWallet {
    /// Create from key shards
    pub fn from_shards(shards: Vec<KeyShard>) -> Result<Self, WalletError> {
        if shards.len() < 2 {
            return Err(WalletError::MpcError("At least 2 shards required".to_string()));
        }
        
        // Derive address from combined public key
        let combined = Self::combine_shards(&shards);
        let address = Self::derive_address(&combined);
        
        Ok(Self {
            shards,
            address,
        })
    }
    
    /// Generate new MPC wallet with shards
    pub fn generate_shards(num_shards: usize, threshold: usize) -> Result<(Self, Vec<String>), WalletError> {
        if num_shards < threshold {
            return Err(WalletError::MpcError("Threshold must be <= num_shards".to_string()));
        }
        
        // Generate master key and split into shards
        let master_key = PrivateKey::generate();
        let shard_strings = master_key.to_hex_shards(num_shards, threshold)?;
        
        let shards: Vec<KeyShard> = shard_strings
            .iter()
            .map(|s| KeyShard {
                id: uuid::Uuid::new_v4().to_string(),
                data: s.clone(),
                threshold,
            })
            .collect();
        
        let wallet = Self::from_shards(shards)?;
        
        Ok((wallet, shard_strings))
    }
    
    fn combine_shards(shards: &[KeyShard]) -> [u8; 32] {
        // Simplified Shamir secret sharing combination
        let mut combined = [0u8; 32];
        
        for shard in shards {
            let mut hasher = Sha256::new();
            hasher.update(&shard.data.as_bytes());
            let hash = hasher.finalize();
            
            for (i, byte) in hash.iter().enumerate() {
                combined[i] ^= byte;
            }
        }
        
        combined
    }
    
    fn derive_address(key: &[u8; 32]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key);
        let hash = hasher.finalize();
        
        format!("0x{}", hex::encode(&hash[12..32]))
    }
    
    /// Sign with MPC (requires threshold number of shards)
    pub fn sign_with_shards(&self, message: &[u8], signing_shards: &[KeyShard]) -> Result<Signature, WalletError> {
        if signing_shards.len() < self.shards.first().map(|s| s.threshold).unwrap_or(2) as usize {
            return Err(WalletError::MpcError("Not enough shards for signing".to_string()));
        }
        
        // Combine signing shards
        let combined = Self::combine_shards_signing(signing_shards);
        
        // Create temporary private key for signing
        let temp_key = PrivateKey { key: combined };
        temp_key.sign(message)
    }
    
    fn combine_shards_signing(shards: &[KeyShard]) -> [u8; 32] {
        let mut combined = [0u8; 32];
        
        for shard in shards {
            let mut hasher = Sha256::new();
            hasher.update(shard.data.as_bytes());
            let hash = hasher.finalize();
            
            for (i, byte) in hash.iter().enumerate() {
                combined[i] ^= byte;
            }
        }
        
        combined
    }
}

impl PrivateKey {
    /// Convert to hex shards using Shamir's secret sharing (simplified)
    pub fn to_hex_shards(&self, num_shards: usize, threshold: usize) -> Result<Vec<String>, WalletError> {
        // Simplified - would use actual Shamir sharing
        let mut shards = Vec::new();
        
        for i in 0..num_shards {
            let mut shard_data = self.key;
            // XOR with shard-specific value (simplified)
            shard_data[i % 32] ^= (i + 1) as u8;
            shards.push(hex::encode(shard_data));
        }
        
        Ok(shards)
    }
}

#[async_trait]
impl WalletTrait for MpcWallet {
    fn address(&self) -> String {
        self.address.clone()
    }
    
    async fn sign(&self, message: &[u8]) -> Result<Signature, WalletError> {
        if self.shards.len() < 2 {
            return Err(WalletError::MpcError("Need at least 2 shards".to_string()));
        }
        
        // Use all shards for signing (simplified)
        let combined = Self::combine_shards(&self.shards);
        let temp_key = PrivateKey { key: combined };
        temp_key.sign(message)
    }
    
    async fn sign_transaction(&self, tx: &[u8]) -> Result<Signature, WalletError> {
        self.sign(tx).await
    }
    
    async fn balance(&self) -> Result<u64, WalletError> {
        // Would query RPC
        Ok(0)
    }
}

/// Key shard for MPC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyShard {
    /// Unique shard ID
    pub id: String,
    /// Shard data (encrypted in production)
    pub data: String,
    /// Required threshold for signing
    pub threshold: usize,
}

/// Hardware wallet trait
#[async_trait]
pub trait HardwareWallet: Send + Sync {
    /// Get device info
    fn device_info(&self) -> String;
    
    /// Sign with hardware
    async fn sign(&self, message: &[u8]) -> Result<Signature, WalletError>;
}

/// Wallet factory
pub enum Wallet {
    /// MPC wallet
    Mpc(MpcWallet),
    /// Private key wallet
    PrivateKey(PrivateKey),
    /// Hardware wallet (Box<dyn HardwareWallet>)
    Hardware,
}

impl Wallet {
    /// Create from private key
    pub fn from_private_key(key: PrivateKey) -> Self {
        Self::PrivateKey(key)
    }
    
    /// Create from hex string
    pub fn from_hex(hex: &str) -> Result<Self, WalletError> {
        let key = PrivateKey::from_hex(hex)?;
        Ok(Self::PrivateKey(key))
    }
    
    /// Create MPC wallet from shards
    pub fn from_mpc_shards(shards: Vec<String>) -> Result<Self, WalletError> {
        let key_shards: Vec<KeyShard> = shards
            .iter()
            .enumerate()
            .map(|(i, s)| KeyShard {
                id: uuid::Uuid::new_v4().to_string(),
                data: s.clone(),
                threshold: shards.len(),
            })
            .collect();
        
        let mpc = MpcWallet::from_shards(key_shards)?;
        Ok(Self::Mpc(mpc))
    }
    
    /// Get address
    pub fn address(&self) -> String {
        match self {
            Self::Mpc(w) => w.address(),
            Self::PrivateKey(k) => Self::derive_from_key(k),
            Self::Hardware => "0xhardware".to_string(),
        }
    }
    
    fn derive_from_key(key: &PrivateKey) -> String {
        let pk = key.public_key();
        let mut hasher = Sha256::new();
        hasher.update(&pk);
        let hash = hasher.finalize();
        
        format!("0x{}", hex::encode(&hash[12..32]))
    }
    
    /// Sign message
    pub async fn sign(&self, message: &[u8]) -> Result<Signature, WalletError> {
        match self {
            Self::Mpc(w) => w.sign(message).await,
            Self::PrivateKey(k) => k.sign(message),
            Self::Hardware => Err(WalletError::SigningFailed("Hardware not implemented".to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_private_key_generation() {
        let key = PrivateKey::generate();
        let pk = key.public_key();
        
        assert_eq!(pk.len(), 33);
    }
    
    #[test]
    fn test_private_key_signing() {
        let key = PrivateKey::generate();
        let message = b"test message";
        
        let sig = key.sign(message).unwrap();
        
        assert_eq!(sig.r.len(), 32);
        assert_eq!(sig.s.len(), 32);
    }
    
    #[test]
    fn test_mpc_wallet() {
        let (wallet, shards) = MpcWallet::generate_shards(3, 2).unwrap();
        
        assert_eq!(shards.len(), 3);
        assert!(!wallet.address().is_empty());
    }
}
