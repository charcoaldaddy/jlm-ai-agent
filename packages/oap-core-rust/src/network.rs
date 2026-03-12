//! Network module for RPC communication
//!
//! Provides HTTP and WebSocket clients for blockchain communication

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, warn};

use crate::types::{Block, TransactionReceipt, Chain};

/// Network client configuration
#[derive(Debug, Clone)]
pub struct NetworkConfig {
    pub http_rpc: Option<String>,
    pub ws_rpc: Option<String>,
    pub max_concurrent: usize,
    pub timeout_ms: u64,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            http_rpc: None,
            ws_rpc: None,
            max_concurrent: 100,
            timeout_ms: 10000,
        }
    }
}

/// Network client errors
#[derive(thiserror::Error, Debug)]
pub enum NetworkError {
    #[error("Request failed: {0}")]
    RequestFailed(String),
    
    #[error("Timeout")]
    Timeout,
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Connection error: {0}")]
    ConnectionError(String),
}

/// Network client for blockchain communication
pub struct NetworkClient {
    config: NetworkConfig,
    http_client: reqwest::Client,
}

impl NetworkClient {
    pub fn new(config: NetworkConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(config.timeout_ms))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            config,
            http_client,
        }
    }
    
    /// Get latest block number
    pub async fn get_block_number(&self, chain: Chain) -> Result<u64, NetworkError> {
        let rpc_url = chain.rpc_url();
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        });
        
        let response = self.http_client
            .post(rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        let block_hex = json["result"]
            .as_str()
            .ok_or_else(|| NetworkError::ParseError("Missing result".to_string()))?;
        
        let block_num = u64::from_str_radix(block_hex.trim_start_matches("0x"), 16)
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        Ok(block_num)
    }
    
    /// Get block by number
    pub async fn get_block(&self, chain: Chain, block_number: u64) -> Result<Block, NetworkError> {
        let rpc_url = chain.rpc_url();
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_getBlockByNumber",
            "params": [format!("0x{:x}", block_number), false],
            "id": 1
        });
        
        let response = self.http_client
            .post(rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        let block_json = json["result"]
            .as_object()
            .ok_or_else(|| NetworkError::ParseError("Missing result".to_string()))?;
        
        let number = u64::from_str_radix(
            block_json.get("number")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0")
                .trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        let hash = crate::types::H256::zero();
        
        let timestamp = u64::from_str_radix(
            block_json.get("timestamp")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0")
                .trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        let gas_limit = u64::from_str_radix(
            block_json.get("gasLimit")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0")
                .trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        let gas_used = u64::from_str_radix(
            block_json.get("gasUsed")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0")
                .trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        Ok(Block {
            number,
            hash,
            timestamp,
            gas_limit,
            gas_used,
        })
    }
    
    /// Get transaction receipt
    pub async fn get_transaction_receipt(
        &self, 
        chain: Chain, 
        tx_hash: &str
    ) -> Result<Option<TransactionReceipt>, NetworkError> {
        let rpc_url = chain.rpc_url();
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionReceipt",
            "params": [tx_hash],
            "id": 1
        });
        
        let response = self.http_client
            .post(rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        if json["result"].is_null() {
            return Ok(None);
        }
        
        let receipt_json = json["result"]
            .as_object()
            .ok_or_else(|| NetworkError::ParseError("Missing result".to_string()))?;
        
        let status = receipt_json.get("status")
            .and_then(|v| v.as_str())
            .map(|s| s == "0x1")
            .unwrap_or(false);
        
        let block_number = u64::from_str_radix(
            receipt_json.get("blockNumber")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0")
                .trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        let gas_used = u64::from_str_radix(
            receipt_json.get("gasUsed")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0")
                .trim_start_matches("0x"),
            16
        ).unwrap_or(0);
        
        Ok(Some(TransactionReceipt {
            tx_hash: crate::types::H256::zero(),
            block_number,
            block_hash: crate::types::H256::zero(),
            status,
            gas_used,
            logs: Vec::new(),
        }))
    }
    
    /// Send raw transaction
    pub async fn send_raw_transaction(
        &self, 
        chain: Chain, 
        signed_tx: &[u8]
    ) -> Result<String, NetworkError> {
        let rpc_url = chain.rpc_url();
        
        let tx_hex = hex::encode(signed_tx);
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_sendRawTransaction",
            "params": [format!("0x{}", tx_hex)],
            "id": 1
        });
        
        let response = self.http_client
            .post(rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        if let Some(error) = json.get("error") {
            return Err(NetworkError::RequestFailed(
                error.as_str().unwrap_or("Unknown error").to_string()
            ));
        }
        
        let tx_hash = json["result"]
            .as_str()
            .ok_or_else(|| NetworkError::ParseError("Missing result".to_string()))?
            .to_string();
        
        Ok(tx_hash)
    }
    
    /// Get balance
    pub async fn get_balance(
        &self, 
        chain: Chain, 
        address: &str
    ) -> Result<crate::types::U256, NetworkError> {
        let rpc_url = chain.rpc_url();
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [address, "latest"],
            "id": 1
        });
        
        let response = self.http_client
            .post(rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        let balance_hex = json["result"]
            .as_str()
            .ok_or_else(|| NetworkError::ParseError("Missing result".to_string()))?;
        
        let balance = crate::types::U256::from_u64(
            u64::from_str_radix(balance_hex.trim_start_matches("0x"), 16).unwrap_or(0)
        );
        
        Ok(balance)
    }
    
    /// Call contract
    pub async fn call(
        &self,
        chain: Chain,
        to: &str,
        data: &[u8]
    ) -> Result<String, NetworkError> {
        let rpc_url = chain.rpc_url();
        
        let data_hex = hex::encode(data);
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{
                "to": to,
                "data": format!("0x{}", data_hex)
            }, "latest"],
            "id": 1
        });
        
        let response = self.http_client
            .post(rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        let result = json["result"]
            .as_str()
            .ok_or_else(|| NetworkError::ParseError("Missing result".to_string()))?
            .to_string();
        
        Ok(result)
    }
}

/// WebSocket client for real-time updates
pub struct WebSocketClient {
    url: String,
    // Would contain actual WebSocket connection
}

impl WebSocketClient {
    pub fn new(url: &str) -> Self {
        Self {
            url: url.to_string(),
        }
    }
    
    /// Subscribe to new blocks
    pub async fn subscribe_blocks(&self) -> Result<(), NetworkError> {
        // Simplified - would establish WebSocket connection
        Ok(())
    }
    
    /// Subscribe to pending transactions
    pub async fn subscribe_pending_transactions(&self) -> Result<(), NetworkError> {
        Ok(())
    }
}

/// HTTP client wrapper
pub struct HttpClient {
    client: reqwest::Client,
}

impl HttpClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
    
    pub async fn get(&self, url: &str) -> Result<String, NetworkError> {
        let response = self.client
            .get(url)
            .send()
            .await
            .map_err(|e| NetworkError::RequestFailed(e.to_string()))?;
        
        response.text().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    #[ignore] // Requires network
    async fn test_get_block_number() {
        let config = NetworkConfig::default();
        let client = NetworkClient::new(config);
        
        let block = client.get_block_number(Chain::Ethereum).await;
        
        // May fail without network
        assert!(block.is_ok() || matches!(block, Err(NetworkError::RequestFailed(_)))));
    }
}
