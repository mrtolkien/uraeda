//! The core's views, as the protocol's types.

// JOIN(wave 6): `workspace::views::sent` (task 7): every records domain turns the core's views
// into the protocol's types this way.

use serde::Serialize;
use serde::de::DeserializeOwned;
use uraeda_core::api::ApiError;

use crate::live::Fault;

/// A view of the core as the protocol's type of the same shape, through the JSON the core writes
/// it in: the protocol's type declares that JSON for the client, and reads it here.
///
/// # Errors
///
/// `internal` when the two differ: a field of the protocol's type the core no longer writes, or
/// writes as another type.
pub(super) fn sent<View: Serialize, Sent: DeserializeOwned>(view: &View) -> Result<Sent, Fault> {
    let differs = |error: serde_json::Error| {
        Fault::internal(format!("a view of the core is not the protocol's: {error}"))
    };
    serde_json::from_value(serde_json::to_value(view).map_err(differs)?).map_err(differs)
}

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
