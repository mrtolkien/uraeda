//! What a read of the core gives for something that is not there.

use uraeda_core::api::ApiError;

use crate::live::Fault;
pub(super) use crate::records::views::sent;

/// Whether the core refused a read for a feature, a file, or a decision that is not there: its
/// record is answered as none, so a page says so in place of an error.
pub(super) fn missing(error: &ApiError) -> bool {
    error.message.contains(" has no ") || error.message.starts_with("no feature ")
}

/// What a read gives, or none for what is not there.
pub(super) fn found<T>(read: Result<T, ApiError>) -> Result<Option<T>, Fault> {
    match read {
        Ok(value) => Ok(Some(value)),
        Err(error) if missing(&error) => Ok(None),
        Err(error) => Err(error.into()),
    }
}
