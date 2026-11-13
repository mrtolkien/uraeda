//! A feature's or a change's history: its stages, and what it produced.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ItemArgs;
use super::decisions::DecisionChange;
use crate::registry::Record;

/// A feature's or a change's history, by its folder: its stages and their starts, read from git.
pub struct History;

impl Record for History {
    const NAME: &'static str = "History";
    type Args = ItemArgs;
    type Value = HistoryView;
}

/// A feature's or a change's stages, and what it produced.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HistoryView {
    /// The feature's or the change's folder.
    pub folder: String,
    pub stages: Vec<StageView>,
    /// The index of the current stage; `stages.len()` once merged.
    pub current: u32,
    /// Rounds of questions, when it had any.
    pub rounds: Option<u32>,
    /// Whether a done item's commits were found on the default branch: false after a squash merge,
    /// or for one from before typed commits.
    pub found: bool,
    /// For a done item not found: its record's `finished` day, `YYYY-MM-DD`.
    pub finished: Option<String>,
    /// The time from its first commit to its finish, in seconds.
    pub total_seconds: Option<u32>,
    /// The lines and files it changed outside its folder and its record.
    pub lines: Option<LinesView>,
    /// The questions a done item asked.
    pub questions: Option<u32>,
    /// The decisions a done item changed.
    pub decisions: Vec<DecisionChange>,
}

/// A stage, and when it started.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StageView {
    /// `proposal`, `questions`, `spec`, `plan`, `build`, `fix`, `pull-request`, or `merged`.
    pub name: String,
    /// RFC 3339, UTC.
    pub started: Option<String>,
}

/// Lines added and removed, over a number of files.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LinesView {
    pub added: u32,
    pub removed: u32,
    pub files: u32,
}
