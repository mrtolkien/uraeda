//! The accounts a runtime runs its sessions on, as the record `Agent` lists them: each with its
//! state and its usage, for Home's Usage pane, the sidebar, and the settings.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Whether an account can run a session: signed in, signed out, or without its folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum AccountState {
    Ready,
    SignedOut,
    Missing,
}

/// A usage window of an account, like five hours or a week.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AccountWindow {
    /// The agent's id for it: `five_hour`, `seven_day`.
    pub id: String,
    /// Its name for people: `5h`, `Week`.
    pub label: String,
    /// When it resets, in ISO 8601: none while the window is not open.
    pub resets_at: Option<String>,
    /// The share used, from 0 to 1.
    pub used: f64,
}

/// An account of a runtime, for the UI.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AccountRecord {
    /// What a session stores as its account: for Claude Code, its configuration folder.
    pub id: String,
    /// Its name for people: `b` for `~/.claude-b`, `default` for `~/.claude`.
    pub name: String,
    pub state: AccountState,
    /// Shortest first, each the freshest read of an ask or of a running process; a window past
    /// its reset reads as unused.
    pub windows: Vec<AccountWindow>,
    /// Whether a new session would start on it now.
    pub is_next: bool,
}
