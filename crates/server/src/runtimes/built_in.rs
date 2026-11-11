//! What the built-in runtimes share, Claude Code's and Codex's: each has one home here, and
//! each runtime keeps only what its own agent needs.
//!
//! - **The folders both agents are given**, the Uraeda skill and the documentation of the
//!   extension API, written in the data folder once per server: see `given.rs`.
//! - **The app's instructions**, the words every session is told besides the skill: see
//!   `instructions.rs`.
//! - **What a tool call acts on**, for its line of the transcript: see `target.rs`.
//! - **An effort's name for people**: [`effort_name`].

mod given;
mod instructions;
mod target;

pub(super) use given::{Given, SKILL_NAME, write_new};
pub(super) use instructions::instructions;
pub(super) use target::{file_target, tool_target};

/// An effort's name for people: "Extra high" for `xhigh`, any other id as given.
pub(super) fn effort_name(id: &str) -> &str {
    match id {
        "high" => "High",
        "low" => "Low",
        "max" => "Max",
        "medium" => "Medium",
        "ultra" => "Ultra",
        "xhigh" => "Extra high",
        other => other,
    }
}
