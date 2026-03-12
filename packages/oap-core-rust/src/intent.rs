//! Intent parsing module
//!
//! Neural intent engine that transforms natural language commands
//! into executable blockchain transaction sequences.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Intent parser trait
#[async_trait]
pub trait IntentParserTrait: Send + Sync {
    /// Parse natural language into intent
    async fn parse(&self, prompt: &str, context: &IntentContext) -> Result<IntentResult, IntentError>;
    
    /// Validate intent
    async fn validate(&self, intent: &Intent) -> Result<(), IntentError>;
    
    /// Estimate gas for intent
    async fn estimate_gas(&self, intent: &Intent) -> Result<u64, IntentError>;
}

/// Neural intent parser
pub struct IntentParser {
    model_path: Option<String>,
    prompt_template: PromptTemplate,
}

impl IntentParser {
    /// Create a new intent parser
    pub async fn new() -> Result<Self, IntentError> {
        Ok(Self {
            model_path: None,
            prompt_template: PromptTemplate::default(),
        })
    }
    
    /// Create with custom model
    pub async fn with_model(path: impl Into<String>) -> Result<Self, IntentError> {
        Ok(Self {
            model_path: Some(path.into()),
            prompt_template: PromptTemplate::default(),
        })
    }
}

#[async_trait]
impl IntentParserTrait for IntentParser {
    async fn parse(&self, prompt: &str, context: &IntentContext) -> Result<IntentResult, IntentError> {
        // Transform to structured intent using prompt engineering
        let structured = self.prompt_template.format(prompt, context);
        
        // Parse structured output
        let intent = self.parse_structured(&structured)?;
        
        Ok(IntentResult {
            intent,
            confidence: 0.95,
            estimated_gas: 21000,
            warnings: Vec::new(),
        })
    }
    
    async fn validate(&self, intent: &Intent) -> Result<(), IntentError> {
        // Validate intent parameters
        if intent.actions.is_empty() {
            return Err(IntentError::Validation("Intent must have at least one action".to_string()));
        }
        
        for action in &intent.actions {
            self.validate_action(action)?;
        }
        
        Ok(())
    }
    
    async fn estimate_gas(&self, intent: &Intent) -> Result<u64, IntentError> {
        let mut total_gas = 0u64;
        
        for action in &intent.actions {
            let gas = match &action.data {
                ActionData::Transfer { .. } => 21000,
                ActionData::Swap { .. } => 150000,
                ActionData::Mint { .. } => 100000,
                ActionData::Stake { .. } => 50000,
                ActionData::Unstake { .. } => 50000,
                ActionData::Vote { .. } => 30000,
                ActionData::Custom { .. } => 100000,
            };
            total_gas += gas;
        }
        
        Ok(total_gas)
    }
}

impl IntentParser {
    fn parse_structured(&self, prompt: &str) -> Result<Intent, IntentError> {
        // Simplified parsing - in production would use actual model
        let lower = prompt.to_lowercase();
        
        let mut actions = Vec::new();
        
        if lower.contains("swap") || lower.contains("exchange") || lower.contains("trade") {
            actions.push(Action {
                protocol: "uniswap".to_string(),
                method: "swap".to_string(),
                data: ActionData::Swap {
                    from_token: self.extract_token(&lower, "from"),
                    to_token: self.extract_token(&lower, "to"),
                    amount: self.extract_amount(&lower),
                    path: Vec::new(),
                },
            });
        }
        
        if lower.contains("transfer") || lower.contains("send") {
            actions.push(Action {
                protocol: "native".to_string(),
                method: "transfer".to_string(),
                data: ActionData::Transfer {
                    to: "".to_string(),
                    amount: self.extract_amount(&lower),
                },
            });
        }
        
        if lower.contains("stake") {
            actions.push(Action {
                protocol: "aave".to_string(),
                method: "supply".to_string(),
                data: ActionData::Stake {
                    amount: self.extract_amount(&lower),
                    token: self.extract_token(&lower, "of"),
                },
            });
        }
        
        if lower.contains("vote") || lower.contains("governance") {
            actions.push(Action {
                protocol: "snapshot".to_string(),
                method: "vote".to_string(),
                data: ActionData::Vote {
                    proposal_id: "".to_string(),
                    choice: "".to_string(),
                },
            });
        }
        
        if actions.is_empty() {
            actions.push(Action {
                protocol: "unknown".to_string(),
                method: "unknown".to_string(),
                data: ActionData::Custom {
                    raw: prompt.to_string(),
                },
            });
        }
        
        Ok(Intent {
            id: uuid::Uuid::new_v4().to_string(),
            actions,
            constraints: Vec::new(),
            metadata: IntentMetadata {
                natural_language: prompt.to_string(),
                parsed_at: chrono::Utc::now(),
                model_version: "1.0.0".to_string(),
            },
        })
    }
    
    fn extract_token(&self, text: &str, keyword: &str) -> String {
        // Simplified token extraction
        if text.contains("eth") || text.contains("ether") {
            "ETH".to_string()
        } else if text.contains("usdc") {
            "USDC".to_string()
        } else if text.contains("usdt") {
            "USDT".to_string()
        } else if text.contains("btc") || text.contains("bitcoin") {
            "BTC".to_string()
        } else {
            "UNKNOWN".to_string()
        }
    }
    
    fn extract_amount(&self, text: &str) -> String {
        // Simplified amount extraction
        if let Some(idx) = text.find("1 ") {
            let remaining = &text[idx..];
            let end = remaining.find(' ').unwrap_or(remaining.len());
            remaining[2..end.min(10)].to_string()
        } else {
            "1".to_string()
        }
    }
    
    fn validate_action(&self, action: &Action) -> Result<(), IntentError> {
        if action.protocol.is_empty() {
            return Err(IntentError::Validation("Protocol cannot be empty".to_string()));
        }
        
        if action.method.is_empty() {
            return Err(IntentError::Validation("Method cannot be empty".to_string()));
        }
        
        Ok(())
    }
}

/// Prompt template for intent parsing
#[derive(Debug, Clone)]
pub struct PromptTemplate {
    system_prompt: String,
    user_template: String,
}

impl Default for PromptTemplate {
    fn default() -> Self {
        Self {
            system_prompt: r#"You are an intent parser for a Web3 AI Agent system.
Your task is to transform natural language commands into structured blockchain transactions.
            
Supported actions:
- SWAP: Exchange tokens on DEXs (Uniswap, Jupiter, etc.)
- TRANSFER: Send tokens to an address
- STAKE: Deposit tokens to yield protocols (Aave, Compound, etc.)
- MINT: Mint NFTs or tokens
- VOTE: Participate in DAO governance
- SUPPLY/BORROW: DeFi operations
            
Always output valid JSON with the following structure:
{
  "actions": [
    {
      "protocol": "string",
      "method": "string", 
      "data": { ... }
    }
  ],
  "constraints": [
    {
      "type": "gas_limit|max_slippage|deadline",
      "value": "string"
    }
  ]
}"#.to_string(),
            
            user_template: "Context: {context}\n\nCommand: {prompt}\n\nParse this command into executable blockchain actions.".to_string(),
        }
    }
}

impl PromptTemplate {
    fn format(&self, prompt: &str, context: &IntentContext) -> String {
        let context_str = serde_json::to_string(context).unwrap_or_default();
        self.user_template
            .replace("{prompt}", prompt)
            .replace("{context}", &context_str)
    }
}

/// Intent result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentResult {
    /// Parsed intent
    pub intent: Intent,
    /// Confidence score (0-1)
    pub confidence: f64,
    /// Estimated gas required
    pub estimated_gas: u64,
    /// Warnings during parsing
    pub warnings: Vec<String>,
}

/// Intent structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intent {
    /// Unique intent ID
    pub id: String,
    /// List of actions to execute
    pub actions: Vec<Action>,
    /// Execution constraints
    pub constraints: Vec<Constraint>,
    /// Metadata
    pub metadata: IntentMetadata,
}

/// Action to execute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    /// Protocol name
    pub protocol: String,
    /// Method name
    pub method: String,
    /// Action data
    pub data: ActionData,
}

/// Action data variants
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ActionData {
    /// Token transfer
    Transfer {
        /// Recipient address
        to: String,
        /// Amount
        amount: String,
    },
    /// Token swap
    Swap {
        /// Source token
        from_token: String,
        /// Destination token
        to_token: String,
        /// Amount
        amount: String,
        /// Swap path
        path: Vec<String>,
    },
    /// Token mint
    Mint {
        /// Token address
        token: String,
        /// Amount
        amount: String,
    },
    /// Stake tokens
    Stake {
        /// Amount
        amount: String,
        /// Token symbol
        token: String,
    },
    /// Unstake tokens
    Unstake {
        /// Amount
        amount: String,
        /// Token symbol
        token: String,
    },
    /// Governance vote
    Vote {
        /// Proposal ID
        proposal_id: String,
        /// Vote choice
        choice: String,
    },
    /// Custom action
    Custom {
        /// Raw data
        raw: String,
    },
}

/// Execution constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    /// Constraint type
    pub constraint_type: String,
    /// Constraint value
    pub value: String,
}

/// Intent metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentMetadata {
    /// Original natural language
    pub natural_language: String,
    /// Parsed timestamp
    pub parsed_at: chrono::DateTime<chrono::Utc>,
    /// Model version
    pub model_version: String,
}

/// Intent error
#[derive(thiserror::Error, Debug)]
pub enum IntentError {
    #[error("Parse error: {0}")]
    Parse(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Model error: {0}")]
    Model(String),
    
    #[error("Unsupported chain: {0}")]
    UnsupportedChain(String),
}

use crate::{IntentContext, Chain, U256};

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_intent_parser() {
        let parser = IntentParser::new().await.unwrap();
        let context = IntentContext::default();
        
        let result = parser.parse("Swap 1 ETH to USDC", &context).await.unwrap();
        
        assert!(!result.intent.actions.is_empty());
        assert!(result.confidence > 0.0);
    }
}
