//! The words the sessions write: the lines a turn shows, the messages Uraeda sends by itself,
//! a chat's title and its opening, and what a running turn says it does.

use std::path::{Component, Path};

use serde_json::{Map, Value};

use super::event::{Activity, BackgroundKind};
use super::turn::ContinueReason;

/// The line of a workflow message sent once it no longer applied: the feature waits on the
/// human.
pub(super) const SENT_AS_CHAT: &str = "Sent as a message: the feature now waits on you.";

/// The line of a workflow message sent once it no longer applied, at another step.
pub(super) const SENT_AS_CHAT_MOVED_ON: &str =
    "Sent as a message: the feature moved on to another step.";

/// The line of a comments message sent without a pull request to address.
pub(super) const SENT_AS_CHAT_NO_PULL_REQUEST: &str = "Sent as a message: no pull request is open.";

/// The line a turn shows when its session's transcript was gone, and a new one started.
pub(super) const REPLACED: &str = "Started a new session: the previous one is gone.";

/// The line a turn showed when a fresh run started a new agent session in its session: a fresh
/// run now starts a new session, but earlier turns keep the line.
pub(super) const FRESH: &str =
    "Started a new session for this run: the agent reads the repository, not the turns above.";

/// The line a turn shows when its agent started a new agent session in its process.
pub(super) const CLEARED: &str = "Started a new session: the agent cleared the turns above.";

/// The line a turn shows when it opened again: its agent went on after it ended.
pub(super) const RESUMED: &str = "The agent went on by itself: a background task reported back.";

/// What a running turn says when nothing more precise is known.
pub(super) const WORKING: &str = "Working";

/// What the agent writes, for people: `Thinking`, `Writing spec.md`, `Preparing Bash`.
pub(super) fn activity_label(activity: &Activity) -> String {
    let (name, target) = match activity {
        Activity::Thinking => return "Thinking".to_owned(),
        Activity::Tool { name, target } => (name.as_str(), target.as_deref()),
    };
    match (name, target) {
        ("Write", None) => "Writing a file".to_owned(),
        ("Write", Some(target)) => format!("Writing {target}"),
        ("Edit" | "MultiEdit" | "NotebookEdit", None) => "Editing a file".to_owned(),
        ("Edit" | "MultiEdit" | "NotebookEdit", Some(target)) => format!("Editing {target}"),
        _ => format!("Preparing {name}"),
    }
}

/// The line of a reply that ended while its background tasks run: its sub-agents, its commands.
pub(super) fn waiting_label(background: &[(String, BackgroundKind)]) -> String {
    let count = |kind: BackgroundKind, one: &str, many: &str| {
        let count = background.iter().filter(|(_, of)| *of == kind).count();
        match count {
            0 => None,
            1 => Some(format!("1 {one}")),
            count => Some(format!("{count} {many}")),
        }
    };
    let parts = [
        count(BackgroundKind::Subagent, "sub-agent", "sub-agents"),
        count(
            BackgroundKind::Command,
            "background command",
            "background commands",
        ),
    ];
    let parts: Vec<String> = parts.into_iter().flatten().collect();
    format!("Waiting for {}", parts.join(" and "))
}

/// The message of an automatic continue, which tells the agent why it goes on.
pub(super) fn continue_message(reason: ContinueReason) -> &'static str {
    match reason {
        ContinueReason::Restart => {
            "The server restarted while you worked. Continue where you left off."
        }
        ContinueReason::Limit => "The usage limit has reset. Continue where you left off.",
    }
}

/// The line an automatic continue's turn opens with, which tells the human why it happened.
pub(super) fn continued_line(reason: ContinueReason) -> &'static str {
    match reason {
        ContinueReason::Restart => "Continued after the server restarted.",
        ContinueReason::Limit => "Continued after the usage limit's reset.",
    }
}

/// The line a catch-up's turn opens with: the commit of the default branch it catches up with.
pub(super) fn catch_up_line(branch: &str, subject: &str) -> String {
    format!("Catching up with {branch}, which moved to “{subject}”.")
}

/// The first message of a chat on a change or a feature, which tells the agent to wait for the
/// human's requests.
pub(super) fn chat_opening(kind: &str, path: &str, branch: &str) -> String {
    format!(
        "A human is chatting with you about the {kind} {path}/, on branch {branch}: answer, and \
         change files, commit, or move the workflow only when they ask."
    )
}

/// The message that asks the agent to try again the actions the human allowed: a line each,
/// from two.
pub(super) fn retry_message(actions: &[(String, Option<String>)]) -> String {
    let named = |(tool, target): &(String, Option<String>)| match target {
        Some(target) if !target.is_empty() => format!("{tool} {target}"),
        _ => tool.clone(),
    };
    let actions: Vec<String> = actions.iter().map(named).collect();
    match actions.as_slice() {
        [action] => format!("Try the blocked action again, now allowed: {action}"),
        actions => {
            let lines: Vec<String> = actions.iter().map(|action| format!("- {action}")).collect();
            format!(
                "Try the blocked actions again, now allowed:\n{}",
                lines.join("\n")
            )
        }
    }
}

/// The longest title a chat takes from a message.
const TITLE_LENGTH: usize = 80;

/// A chat's title: its first message's first line that is not blank, cut at 80 characters, or
/// `Image` for a message of images alone.
pub(crate) fn chat_title(text: &str, images: bool) -> String {
    let line = text.lines().map(str::trim).find(|line| !line.is_empty());
    match (line, images) {
        (Some(line), _) => line.chars().take(TITLE_LENGTH).collect(),
        (None, true) => "Image".to_owned(),
        (None, false) => "New session".to_owned(),
    }
}

/// What a tool call acts on, for its line: its command, file, address, or pattern. A file
/// under `cwd`, the session's directory, is relative to it.
pub(super) fn tool_target(input: &Map<String, Value>, cwd: &Path) -> Option<String> {
    const TARGETS: [&str; 5] = ["command", "file_path", "url", "pattern", "path"];
    let (key, value) = TARGETS
        .iter()
        .find_map(|key| Some((*key, input.get(*key)?.as_str()?)))?;
    let is_path = matches!(key, "file_path" | "path");
    let inside = Path::new(value).strip_prefix(cwd).ok().filter(|inside| {
        let plain = |part: Component<'_>| matches!(part, Component::Normal(_));
        is_path && inside.components().next().is_some() && inside.components().all(plain)
    });
    Some(match inside {
        Some(inside) => inside.to_string_lossy().into_owned(),
        None => value.to_owned(),
    })
}

/// An effort's name for people: `Extra high` for `xhigh`, any other id as given.
pub(crate) fn effort_name(id: &str) -> &str {
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
