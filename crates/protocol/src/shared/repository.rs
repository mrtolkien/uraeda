//! Which repository a record is of.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Which repository: what a record of one repository takes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryArgs {
    /// The repository's name in the list.
    pub repo: String,
}
