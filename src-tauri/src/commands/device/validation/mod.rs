//! Device Validation Framework
//! 
//! This module provides unified validation abstractions for device tools and operations,
//! replacing complex, repetitive validation logic with simple, configuration-driven patterns.

pub mod tool_validator;

// Re-export main validation utilities
pub use tool_validator::{
    ToolValidationManager,
    ToolDiscoveryConfig,
    ValidatedTool,
    ToolValidationError,
}; 