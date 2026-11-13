//! A tool call of Claude Code's, as the transcript names it: what it does, and what it acts on.

use super::super::built_in;
use crate::runner::ToolKind;

/// The tools that start a sub-agent: `Task` in Claude Code 2.1.296, `Agent` in others.
pub(super) const SUBAGENT_TOOLS: [&str; 2] = ["Task", "Agent"];

/// What a Claude Code tool does, in the Agent Client Protocol's words.
pub(super) fn kind(name: &str) -> ToolKind {
    match name {
        "Bash" | "BashOutput" | "KillShell" => ToolKind::Execute,
        "Edit" | "MultiEdit" | "NotebookEdit" | "Write" => ToolKind::Edit,
        "Glob" | "Grep" | "LS" => ToolKind::Search,
        "Read" => ToolKind::Read,
        "WebFetch" | "WebSearch" => ToolKind::Fetch,
        _ => ToolKind::Other,
    }
}

/// The target of a tool call whose input is still being written, once it holds a file's path.
pub(super) fn file_target(path: &str, cwd: &str) -> Option<String> {
    Some(built_in::file_target(path, cwd))
}
