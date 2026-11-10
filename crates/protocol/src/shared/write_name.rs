//! The name a client gives a write, for the write queue's record.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// What the UI names a write with in the write queue, while it lands: every action that
/// commits, or that lands as a write of its own, takes one as `write`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WriteName {
    /// The page it opens.
    pub href: String,
    /// Its running text, as "Approving the spec of Recurring tasks".
    pub label: String,
}
