//! Swarm orchestration module
//!
//! Manages multiple AI agents working collaboratively on complex tasks.

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::sync::mpsc;
use tracing::{info, warn, debug};
use uuid::Uuid;

use crate::{AgentConfig, AgentId, Chain, Strategy, LlmProvider, TaskId, TaskResult, SwarmTask, SwarmTaskType};
use crate::intent::Intent;

/// Agent ID type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentId(pub u64);

impl AgentId {
    pub fn new() -> Self {
        Self(rand::random())
    }
}

impl Default for AgentId {
    fn default() -> Self {
        Self::new()
    }
}

/// Agent status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentStatus {
    /// Agent is starting
    Starting,
    /// Agent is running
    Running,
    /// Agent is paused
    Paused,
    /// Agent is stopping
    Stopping,
    /// Agent has stopped
    Stopped,
    /// Agent has errored
    Error,
}

/// Agent instance
#[derive(Debug, Clone)]
pub struct Agent {
    /// Agent ID
    pub id: AgentId,
    /// Agent name
    pub name: String,
    /// Chain
    pub chain: Chain,
    /// Status
    pub status: AgentStatus,
    /// Current intent
    pub current_intent: Option<String>,
    /// Task count
    pub tasks_completed: u64,
    /// Errors
    pub errors: Vec<String>,
}

impl Agent {
    pub fn new(config: AgentConfig) -> Self {
        Self {
            id: AgentId::new(),
            name: config.name,
            chain: config.chain,
            status: AgentStatus::Starting,
            current_intent: None,
            tasks_completed: 0,
            errors: Vec::new(),
        }
    }
}

/// Swarm configuration
#[derive(Debug, Clone)]
pub struct SwarmConfig {
    /// Maximum agents
    pub max_agents: usize,
    /// Task queue size
    pub task_queue_size: usize,
    /// Agent communication timeout
    pub communication_timeout_ms: u64,
    /// Enable P2P communication
    pub enable_p2p: bool,
}

impl Default for SwarmConfig {
    fn default() -> Self {
        Self {
            max_agents: 1000,
            task_queue_size: 10000,
            communication_timeout_ms: 5000,
            enable_p2p: true,
        }
    }
}

/// Swarm message
#[derive(Debug, Clone)]
pub struct SwarmMessage {
    /// Sender ID
    pub from: AgentId,
    /// Receiver ID (None for broadcast)
    pub to: Option<AgentId>,
    /// Message type
    pub message_type: MessageType,
    /// Payload
    pub payload: Vec<u8>,
}

/// Message types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MessageType {
    /// Task request
    TaskRequest,
    /// Task response
    TaskResponse,
    /// Heartbeat
    Heartbeat,
    /// Error
    Error,
    /// Shutdown
    Shutdown,
}

/// Swarm orchestrator
pub struct SwarmOrchestrator {
    config: SwarmConfig,
    agents: HashMap<AgentId, Agent>,
    tasks: HashMap<TaskId, SwarmTask>,
    task_results: HashMap<TaskId, TaskResult>,
    message_queue: mpsc::UnboundedSender<SwarmMessage>,
}

impl SwarmOrchestrator {
    /// Create a new swarm orchestrator
    pub fn new(max_agents: usize) -> Self {
        let config = SwarmConfig {
            max_agents,
            ..Default::default()
        };
        
        let (tx, _rx) = mpsc::unbounded_channel();
        
        Self {
            config,
            agents: HashMap::new(),
            tasks: HashMap::new(),
            task_results: HashMap::new(),
            message_queue: tx,
        }
    }
    
    /// Spawn a new agent
    pub async fn spawn(&mut self, config: AgentConfig) -> Result<AgentId, SwarmError> {
        if self.agents.len() >= self.config.max_agents {
            return Err(SwarmError::MaxAgentsReached);
        }
        
        let agent = Agent::new(config);
        let id = agent.id;
        
        info!("Spawning agent {} with name {}", id.0, agent.name);
        
        self.agents.insert(id, agent);
        
        Ok(id)
    }
    
    /// Get agent by ID
    pub async fn get(&self, id: AgentId) -> Option<Agent> {
        self.agents.get(&id).cloned()
    }
    
    /// Terminate an agent
    pub async fn terminate(&mut self, id: AgentId) -> Result<(), SwarmError> {
        if let Some(agent) = self.agents.remove(&id) {
            info!("Terminating agent {} ({})", agent.name, id.0);
            Ok(())
        } else {
            Err(SwarmError::AgentNotFound(id))
        }
    }
    
    /// Submit a task to the swarm
    pub async fn submit_task(&mut self, task: SwarmTask) -> Result<TaskId, SwarmError> {
        let task_id = TaskId(Uuid::new_v4().as_u64());
        
        debug!("Submitting swarm task: {:?}", task.task_type);
        
        // Distribute task to available agents
        let agents_needed = task.required_agents.min(self.agents.len());
        
        if agents_needed == 0 {
            return Err(SwarmError::NoAvailableAgents);
        }
        
        self.tasks.insert(task_id, task);
        
        Ok(task_id)
    }
    
    /// Get task result
    pub async fn get_task_result(&self, task_id: TaskId) -> Option<TaskResult> {
        self.task_results.get(&task_id).cloned()
    }
    
    /// Get number of active agents
    pub fn len(&self) -> usize {
        self.agents.len()
    }
    
    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.agents.is_empty()
    }
    
    /// Send message to agent
    pub async fn send_message(&self, message: SwarmMessage) -> Result<(), SwarmError> {
        self.message_queue.send(message)
            .map_err(|_| SwarmError::MessageQueueClosed)
    }
    
    /// Broadcast to all agents
    pub async fn broadcast(&self, message_type: MessageType, payload: Vec<u8>) -> Result<(), SwarmError> {
        for id in self.agents.keys() {
            let msg = SwarmMessage {
                from: AgentId(0),
                to: Some(*id),
                message_type,
                payload: payload.clone(),
            };
            
            if let Err(_) = self.message_queue.send(msg) {
                return Err(SwarmError::MessageQueueClosed);
            }
        }
        
        Ok(())
    }
    
    /// Get swarm statistics
    pub fn stats(&self) -> SwarmStats {
        SwarmStats {
            total_agents: self.agents.len(),
            active_agents: self.agents.values().filter(|a| a.status == AgentStatus::Running).count(),
            pending_tasks: self.tasks.len(),
            completed_tasks: self.task_results.values().filter(|r| r.success).count(),
        }
    }
}

/// Swarm statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmStats {
    /// Total agents
    pub total_agents: usize,
    /// Active agents
    pub active_agents: usize,
    /// Pending tasks
    pub pending_tasks: usize,
    /// Completed tasks
    pub completed_tasks: usize,
}

/// Swarm errors
#[derive(thiserror::Error, Debug)]
pub enum SwarmError {
    #[error("Max agents reached")]
    MaxAgentsReached,
    
    #[error("Agent not found: {0:?}")]
    AgentNotFound(AgentId),
    
    #[error("No available agents")]
    NoAvailableAgents,
    
    #[error("Task not found: {0:?}")]
    TaskNotFound(TaskId),
    
    #[error("Message queue closed")]
    MessageQueueClosed,
    
    #[error("Task execution failed: {0}")]
    TaskFailed(String),
    
    #[error("Communication timeout")]
    CommunicationTimeout,
}

use serde::{Serialize, Deserialize};
use rand::random;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_spawn_agent() {
        let mut swarm = SwarmOrchestrator::new(100);
        
        let config = AgentConfig::new("test-agent", Chain::Ethereum);
        let id = swarm.spawn(config).await.unwrap();
        
        let agent = swarm.get(id).await;
        assert!(agent.is_some());
    }
    
    #[tokio::test]
    async fn test_terminate_agent() {
        let mut swarm = SwarmOrchestrator::new(100);
        
        let config = AgentConfig::new("test-agent", Chain::Ethereum);
        let id = swarm.spawn(config).await.unwrap();
        
        swarm.terminate(id).await.unwrap();
        
        let agent = swarm.get(id).await;
        assert!(agent.is_none());
    }
}
