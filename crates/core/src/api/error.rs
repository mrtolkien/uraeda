//! What an operation of the core refuses or fails with, from its own errors.

use crate::actions::{ActionError, place};
use crate::git::GitError;

/// An operation refused or failed: `code` is `refused`, or `conflict` for a change made elsewhere.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiError {
    pub code: &'static str,
    pub message: String,
    pub output: Option<String>,
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

pub(super) fn refused(message: impl Into<String>) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

impl From<ActionError> for ApiError {
    fn from(error: ActionError) -> ApiError {
        match error {
            error if error.is_stale() => ApiError {
                code: "conflict",
                message: error.to_string(),
                output: None,
            },
            error => refused(error.to_string()),
        }
    }
}

impl From<GitError> for ApiError {
    fn from(error: GitError) -> ApiError {
        refused(error.to_string())
    }
}

impl From<place::PlaceError> for ApiError {
    fn from(error: place::PlaceError) -> ApiError {
        refused(error.to_string())
    }
}
