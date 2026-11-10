//! The core's views, as the protocol's types.

// JOIN(wave 6): every records domain turns the core's views into the protocol's types.

use serde::Serialize;
use serde::de::DeserializeOwned;

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

/// A word of the protocol, as it is written in JSON: `pull-request`.
pub(super) fn word<Word: Serialize>(word: &Word) -> String {
    let json = serde_json::to_value(word).unwrap_or_default();
    json.as_str().unwrap_or_default().to_owned()
}
